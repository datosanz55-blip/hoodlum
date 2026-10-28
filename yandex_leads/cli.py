"""Командная строка.

Примеры:
    python -m yandex_leads collect -q "барбершоп" -q "стоматология" --city Казань -o leads.xlsx
    python -m yandex_leads collect --source api -q "автосервис" --city Самара
    python -m yandex_leads analyze data/raw.jsonl -o leads.xlsx --services site,seo
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from datetime import datetime
from pathlib import Path

from .analyzer import analyze, parse_services
from .export import append_raw, load_raw, save_leads
from .models import Business, Lead
from .site_audit import audit_many, pick_own_site


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def _read_lines(path: str | None) -> list[str]:
    if not path:
        return []
    lines = Path(path).read_text(encoding="utf-8").splitlines()
    return [l.strip() for l in lines if l.strip() and not l.lstrip().startswith("#")]


def _load_env(path: Path = Path(".env")) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip("\"'"))


async def collect_browser(args, queries: list[str], cities: list[str], raw: Path) -> list[Business]:
    from .sources.browser import BlockedError, BrowserCollector

    result: dict[str, Business] = {}
    async with BrowserCollector(
        profile_dir=args.profile_dir,
        headless=args.headless,
        delay=args.delay,
        executable_path=args.browser_path,
        proxy=args.proxy,
    ) as bc:
        for city in cities:
            for q in queries:
                log(f"→ Ищу «{q}» {city}".rstrip())
                try:
                    items = await bc.search(q, city, args.limit, skip_ids=args.seen | set(result))
                except BlockedError as e:
                    log(f"  ✗ {e}")
                    return list(result.values())
                new = [b for b in items if b.org_id not in result]
                log(f"  найдено {len(items)}, новых {len(new)}")
                if args.details:
                    for i, b in enumerate(new, 1):
                        if b.phones and b.websites:
                            continue
                        log(f"  карточка {i}/{len(new)}: {b.name}")
                        try:
                            await bc.enrich(b)
                        except BlockedError as e:
                            log(f"  ✗ {e}")
                            break
                for b in new:
                    result[b.org_id] = b
                    append_raw(raw, b)
    return list(result.values())


def collect_api(args, queries: list[str], cities: list[str], raw: Path) -> list[Business]:
    from .sources.api import ApiCollector

    api = ApiCollector(
        args.api_key or os.environ.get("YANDEX_API_KEY", ""), delay=args.delay / 4, proxy=args.proxy
    )
    result: dict[str, Business] = {}
    try:
        for city in cities:
            for q in queries:
                log(f"→ API: «{q}» {city}".rstrip())
                items = api.search(q, city, args.limit, skip_ids=args.seen | set(result))
                new = [b for b in items if b.org_id not in result]
                log(f"  найдено {len(items)}, новых {len(new)}")
                for b in new:
                    result[b.org_id] = b
                    append_raw(raw, b)
    finally:
        api.close()
    return list(result.values())


def build_leads(businesses: list[Business], args) -> list[Lead]:
    audits = {}
    if not args.no_audit:
        urls = [u for b in businesses if (u := pick_own_site(b.websites))]
        if urls:
            log(f"→ Проверяю сайты: {len(set(urls))}")
            audits = asyncio.run(audit_many(urls, concurrency=args.concurrency))
    services = parse_services(args.services)
    leads = []
    for b in businesses:
        lead = analyze(b, audits.get(pick_own_site(b.websites)), me=args.me, services=services or None)
        if lead.offers and lead.score >= args.min_score:
            leads.append(lead)
    leads.sort(key=lambda l: (-l.score, l.business.name))
    return leads


def finish(businesses: list[Business], args) -> None:
    if not businesses:
        log("Ничего не найдено.")
        return
    leads = build_leads(businesses, args)
    out = Path(args.output)
    save_leads(leads, out)
    by_p = {p: sum(1 for l in leads if l.priority == p) for p in "ABC"}
    log(
        f"✓ Организаций: {len(businesses)}, лидов: {len(leads)} "
        f"(A: {by_p['A']}, B: {by_p['B']}, C: {by_p['C']}) → {out}"
    )


def add_common(p: argparse.ArgumentParser) -> None:
    p.add_argument("-o", "--output", default=f"leads_{datetime.now():%Y%m%d_%H%M}.xlsx",
                   help="куда сохранить: .xlsx, .csv или .json")
    p.add_argument("--no-audit", action="store_true", help="не проверять сайты организаций")
    p.add_argument("--services", action="append",
                   help="предлагать только эти услуги: site, content, seo, admin, auto (через запятую)")
    p.add_argument("--min-score", type=int, default=1, help="минимальный балл лида")
    p.add_argument("--me", default="", help="подпись в конце сообщения: имя, телефон, Telegram")
    p.add_argument("--concurrency", type=int, default=10, help="параллельных проверок сайтов")


def main(argv: list[str] | None = None) -> None:
    _load_env()
    parser = argparse.ArgumentParser(
        prog="yandex_leads",
        description="Сбор организаций с Яндекс Карт и подбор услуг: сайт, контент, SEO/GEO, админ, автоматизация.",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    c = sub.add_parser("collect", help="собрать организации и сделать таблицу лидов")
    c.add_argument("-q", "--query", action="append", default=[], help="что искать, можно несколько раз")
    c.add_argument("--queries-file", help="файл с запросами, по одному на строку")
    c.add_argument("--city", action="append", default=[], help="город, можно несколько раз")
    c.add_argument("--cities-file", help="файл с городами, по одному на строку")
    c.add_argument("--limit", type=int, default=100, help="максимум организаций на запрос")
    c.add_argument("--source", choices=("browser", "api"), default="browser",
                   help="browser — через браузер; api — официальное API Яндекса (нужен ключ)")
    c.add_argument("--api-key", help="ключ API Поиска по организациям (или YANDEX_API_KEY в .env)")
    c.add_argument("--details", action="store_true",
                   help="browser: открывать карточки, где нет телефона/сайта (медленнее, точнее)")
    c.add_argument("--headless", action="store_true", help="browser: без окна (капчу решить не получится)")
    c.add_argument("--delay", type=float, default=2.0, help="пауза между действиями, сек")
    c.add_argument("--profile-dir", default=".browser-profile", help="browser: папка профиля")
    c.add_argument("--browser-path", default=None, help="browser: путь к Chrome/Chromium, если нужен свой")
    c.add_argument("--proxy", default=None,
                   help="прокси для запросов к Яндексу: http://user:pass@host:port или socks5://host:port "
                        "(или YL_PROXY в .env)")
    c.add_argument("--raw", default="data/raw.jsonl", help="куда дописывать сырые данные")
    c.add_argument("--only-new", action="store_true",
                   help="пропускать компании, которые уже есть в --raw (для ежедневного запуска)")
    add_common(c)

    a = sub.add_parser("analyze", help="пересчитать лиды из сохранённого raw.jsonl")
    a.add_argument("raw", help="путь к raw.jsonl")
    add_common(a)

    args = parser.parse_args(argv)

    if args.cmd == "analyze":
        finish(load_raw(Path(args.raw)), args)
        return

    queries = args.query + _read_lines(args.queries_file)
    cities = args.city + _read_lines(args.cities_file) or [""]
    if not queries:
        parser.error("укажите хотя бы один запрос: -q \"барбершоп\" или --queries-file")
    args.proxy = args.proxy or os.environ.get("YL_PROXY") or None
    raw = Path(args.raw)
    args.seen = set()
    if args.only_new and raw.exists():
        args.seen = {b.org_id for b in load_raw(raw)}
        log(f"Уже собрано ранее: {len(args.seen)} — их пропускаю")
    if args.source == "api":
        businesses = collect_api(args, queries, cities, raw)
    else:
        businesses = asyncio.run(collect_browser(args, queries, cities, raw))
    finish(businesses, args)
