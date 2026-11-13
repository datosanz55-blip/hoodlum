"""Быстрая проверка сайта организации: жив ли, мобильный ли, есть ли
аналитика, онлайн-запись, чат, блог, микроразметка и т.п."""

from __future__ import annotations

import asyncio
import re
import time
from datetime import date
from urllib.parse import urlparse

import httpx

from .models import SiteAudit

# Домены, которые не являются «своим сайтом»: соцсети, агрегаторы, мини-лендинги.
NOT_OWN_SITE = (
    "vk.com", "vk.ru", "instagram.com", "facebook.com", "ok.ru", "t.me", "telegram.me",
    "wa.me", "whatsapp.com", "youtube.com", "tiktok.com", "dzen.ru", "zen.yandex.ru",
    "taplink.cc", "taplink.ws", "taplink.at", "linktr.ee", "hipolink.me", "mssg.me",
    "yclients.com", "n.yclients.com", "dikidi.net", "dikidi.ru", "sonline.su",
    "2gis.ru", "zoon.ru", "yell.ru", "flamp.ru", "avito.ru", "profi.ru", "uslugi.yandex.ru",
    "prodoctorov.ru", "napopravku.ru", "sberhealth.ru", "restoclub.ru", "afisha.ru",
    "tripadvisor.ru", "booking.com", "ostrovok.ru", "delivery-club.ru", "eda.yandex.ru",
    "market.yandex.ru", "ozon.ru", "wildberries.ru", "business.site", "clients.site",
)

SOCIAL_RE = re.compile(
    r"https?://(?:www\.)?(?:vk\.com|vk\.ru|t\.me|ok\.ru|instagram\.com|youtube\.com|dzen\.ru|tiktok\.com|rutube\.ru)/[\w\-./@]+",
    re.I,
)
PATTERNS = {
    "analytics": r"mc\.yandex\.ru|ym\(\s*\d+|googletagmanager\.com|google-analytics\.com|top-fwz1\.mail\.ru",
    "online_booking": (
        r"yclients|dikidi|sonline|altegio|arnica|medods|1c-?fitness|bookform|bnovo|"
        r"travelline|restoplace|leclick|записаться онлайн|онлайн-запись|онлайн запись|забронировать"
    ),
    "chat_widget": r"jivosite|jivo\.ru|code\.jivo|bitrix24|b24-|livetex|carrotquest|envybox|"
                   r"callbackkiller|chatra|talk-me|wazzup|marquiz|umnico|tawk\.to",
    "messengers": r"wa\.me/|api\.whatsapp\.com|whatsapp://|t\.me/|tg://resolve|viber://",
    "blog": r"href=[\"'][^\"']*/(?:blog|articles|stati|news|novosti|journal|poleznoe)[/\"'?]|>\s*(?:Блог|Статьи|Полезное)\s*<",
    "structured_data": r"application/ld\+json|itemtype=[\"']https?://schema\.org",
}
BUILDERS = {
    "Tilda": r"tilda\.ws|tildacdn|data-tilda",
    "Wix": r"wixstatic|wix\.com",
    "Taplink": r"taplink",
    "Nethouse": r"nethouse",
    "uCoz": r"ucoz|narod\.ru",
    "Flexbe": r"flexbe",
    "LPgenerator": r"lpgenerator",
    "Битрикс": r"bitrix/(?:js|templates)",
    "WordPress": r"wp-content|wp-includes",
}


def is_own_site(url: str) -> bool:
    host = (urlparse(url if "://" in url else f"http://{url}").hostname or "").lower()
    host = host.removeprefix("www.")
    return bool(host) and not any(host == d or host.endswith("." + d) for d in NOT_OWN_SITE)


def pick_own_site(urls: list[str]) -> str:
    return next((u for u in urls if is_own_site(u)), "")


def analyze_html(audit: SiteAudit, html: str) -> SiteAudit:
    low = html.lower()
    audit.mobile_viewport = bool(re.search(r"<meta[^>]+name=[\"']?viewport", low))
    m = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
    audit.title = re.sub(r"\s+", " ", m.group(1)).strip()[:150] if m else ""
    audit.meta_description = bool(
        re.search(r"<meta[^>]+name=[\"']?description[\"']?[^>]+content=[\"'][^\"']{20,}", low)
        or re.search(r"<meta[^>]+content=[\"'][^\"']{20,}[\"'][^>]+name=[\"']?description", low)
    )
    for attr, pattern in PATTERNS.items():
        setattr(audit, attr, bool(re.search(pattern, html, re.I)))
    audit.builder = next((name for name, p in BUILDERS.items() if re.search(p, low)), "")
    years = [int(y) for y in re.findall(r"(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–—]\s*)?(20\d{2})", low)]
    this_year = date.today().year
    years = [y for y in years if y <= this_year]
    audit.copyright_year = max(years) if years else None
    audit.social_links = sorted(set(SOCIAL_RE.findall(html)))[:10]
    return audit


async def audit_site(client: httpx.AsyncClient, url: str) -> SiteAudit:
    if "://" not in url:
        url = "http://" + url
    audit = SiteAudit(url=url)
    started = time.monotonic()
    try:
        resp = await client.get(url)
        audit.response_ms = int((time.monotonic() - started) * 1000)
        audit.status = resp.status_code
        audit.final_url = str(resp.url)
        audit.https = audit.final_url.startswith("https://")
        audit.reachable = resp.status_code < 400
        if audit.reachable and "html" in resp.headers.get("content-type", "html"):
            analyze_html(audit, resp.text[:800_000])
    except httpx.HTTPError as e:
        audit.error = type(e).__name__
    return audit


async def audit_many(urls: list[str], concurrency: int = 10, timeout: float = 15.0) -> dict[str, SiteAudit]:
    sem = asyncio.Semaphore(concurrency)
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; site-audit/1.0)",
        "Accept-Language": "ru-RU,ru;q=0.9",
    }
    async with httpx.AsyncClient(
        timeout=timeout, follow_redirects=True, headers=headers, verify=False
    ) as client:

        async def one(u: str) -> tuple[str, SiteAudit]:
            async with sem:
                return u, await audit_site(client, u)

        results = await asyncio.gather(*(one(u) for u in dict.fromkeys(urls)))
    return dict(results)
