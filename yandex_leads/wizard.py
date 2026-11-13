"""Простой режим: спрашивает нишу, город и количество — и сам запускает сбор.

Запускается двойным кликом по «Запустить парсер.command» или командой
`python -m yandex_leads` без параметров.
"""

from __future__ import annotations

import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

DEFAULT_CITY = "Челябинск"
DEFAULT_LIMIT = 200
RESULTS_DIR = Path("Результаты")


def ask(prompt: str, default: str = "") -> str:
    hint = f" [{default}]" if default else ""
    answer = input(f"{prompt}{hint}: ").strip()
    return answer or default


def ask_int(prompt: str, default: int) -> int:
    while True:
        raw = ask(prompt, str(default))
        digits = re.sub(r"\D", "", raw)
        if digits and int(digits) > 0:
            return int(digits)
        print("  Напишите число, например 100.")


def split_niches(raw: str) -> list[str]:
    return [n.strip().strip("\"'«»") for n in re.split(r"[,;\n]", raw) if n.strip().strip("\"'«»")]


def output_path(niches: list[str], city: str, now: datetime | None = None) -> Path:
    now = now or datetime.now()
    name = niches[0] if len(niches) == 1 else f"{niches[0]} и ещё {len(niches) - 1}"
    safe = re.sub(r'[\\/:*?"<>|]+', " ", f"{name} {city}").strip()
    return RESULTS_DIR / f"{safe} {now:%Y-%m-%d %H-%M}.xlsx"


def build_argv(niches: list[str], city: str, limit: int, out: Path) -> list[str]:
    argv = ["collect", "--only-new"]
    for n in niches:
        argv += ["-q", n]
    if city:
        argv += ["--city", city]
    return argv + ["--limit", str(limit), "--details", "--delay", "3", "-o", str(out)]


def open_file(path: Path) -> None:
    if sys.platform == "darwin":
        subprocess.run(["open", str(path)], check=False)
    elif sys.platform.startswith("win"):
        subprocess.run(["cmd", "/c", "start", "", str(path)], check=False)


def run() -> None:
    from .cli import main

    print("\n=== Парсер Яндекс Карт ===")
    print("Пишите обычными словами, как ищете на Картах. Несколько ниш — через запятую.\n")
    while True:
        niches: list[str] = []
        while not niches:
            niches = split_niches(ask("Какую нишу ищем (например: мебельный магазин)"))
        city = ask("Город", DEFAULT_CITY)
        per = "по каждой нише" if len(niches) > 1 else ""
        limit = ask_int(f"Сколько компаний собрать {per}".rstrip(), DEFAULT_LIMIT)
        out = output_path(niches, city)

        print(f"\nИщу: {', '.join(niches)} — {city}, до {limit} новых компаний.")
        print("Сейчас откроется браузер. Ничего в нём не трогайте; если будет капча — решите её.\n")
        try:
            main(build_argv(niches, city, limit, out))
        except SystemExit as e:
            if e.code not in (0, None):
                print(f"\nОшибка: {e.code}")
        except KeyboardInterrupt:
            print("\nОстановлено.")
        except Exception as e:  # не пугаем трейсбэком: коротко, что сломалось
            print(f"\nОшибка: {type(e).__name__}: {str(e).splitlines()[0] if str(e) else ''}")

        if out.exists():
            print(f"\nГотово! Таблица: {out}")
            open_file(out)
        else:
            print("\nТаблица не создана. Если непонятно почему — пришлите скриншот этого окна.")

        if ask("\nСобрать ещё одну нишу? (да/нет)", "нет").lower() not in ("да", "д", "y", "yes", "ага"):
            break
