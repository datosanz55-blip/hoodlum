"""Сбор организаций через обычный браузер (Playwright).

Открывает yandex.ru/maps в видимом окне, листает список результатов и
забирает JSON, который сайт сам загружает для отображения выдачи.
Никаких обходов защиты: если Яндекс показал капчу, её решаете вы в окне
браузера, а скрипт ждёт. Профиль браузера сохраняется, поэтому капча
обычно нужна один раз.
"""

from __future__ import annotations

import asyncio
import json
import random
import sys
from pathlib import Path
from typing import Callable
from urllib.parse import quote, unquote, urlparse

from ..models import Business
from .extract import extract_businesses, merge

MAPS_URL = "https://yandex.ru/maps/"
LIST_SELECTORS = (".search-list-view .scroll__container", ".scroll__container")


class BlockedError(RuntimeError):
    pass


def playwright_proxy(url: str | None) -> dict | None:
    """'http://user:pass@host:port' → формат proxy для Playwright."""
    if not url:
        return None
    u = urlparse(url if "://" in url else f"http://{url}")
    if not u.hostname:
        raise SystemExit(f"Не понял адрес прокси: {url}")
    server = f"{u.scheme}://{u.hostname}" + (f":{u.port}" if u.port else "")
    proxy = {"server": server}
    if u.username:
        proxy["username"] = unquote(u.username)
        proxy["password"] = unquote(u.password or "")
    return proxy


def _log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


async def _wait_captcha(page, headless: bool, timeout: int) -> None:
    """Если открыта капча — ждём, пока человек решит её в окне браузера."""

    async def state() -> str:
        if "showcaptcha" in page.url or "/captcha" in page.url:
            return "captcha"
        try:
            text = (await page.inner_text("body", timeout=3000)).strip()
        except Exception:
            return "ok"
        if text == "limited":
            return "limited"
        return "ok"

    st = await state()
    if st == "limited":
        raise BlockedError(
            "Яндекс ограничил запросы с вашего IP (ответ 'limited'). "
            "Подождите, увеличьте --delay и уменьшите объём сбора."
        )
    if st != "captcha":
        return
    if headless:
        raise BlockedError("Яндекс показал капчу. Запустите без --headless и решите её в окне браузера.")
    _log(f"  ! Яндекс показал капчу — решите её в окне браузера (жду до {timeout} с)…")
    for _ in range(timeout // 2):
        await asyncio.sleep(2)
        if await state() == "ok":
            _log("  капча пройдена, продолжаю")
            await page.wait_for_timeout(2000)
            return
    raise BlockedError("Капча не была решена вовремя.")


async def _state_view(page) -> object | None:
    raw = await page.evaluate(
        "() => { const s = document.querySelector('script.state-view');"
        " return s ? s.textContent : null; }"
    )
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


async def _scroll_list(page) -> None:
    for sel in LIST_SELECTORS:
        loc = page.locator(sel).first
        if await loc.count():
            await loc.evaluate("el => el.scrollTo(0, el.scrollHeight)")
            return
    # Запасной вариант: колесо мыши над левой панелью со списком.
    await page.mouse.move(250, 500)
    await page.mouse.wheel(0, 4000)


class BrowserCollector:
    def __init__(
        self,
        profile_dir: str | Path = ".browser-profile",
        headless: bool = False,
        delay: float = 2.0,
        captcha_timeout: int = 300,
        executable_path: str | None = None,
        proxy: str | None = None,
    ) -> None:
        self.proxy = playwright_proxy(proxy)
        self.profile_dir = Path(profile_dir)
        self.headless = headless
        self.delay = delay
        self.captcha_timeout = captcha_timeout
        self.executable_path = executable_path
        self._pw = None
        self._ctx = None

    async def __aenter__(self) -> "BrowserCollector":
        try:
            from playwright.async_api import async_playwright
        except ImportError as e:  # pragma: no cover
            raise SystemExit(
                "Не установлен Playwright: pip install playwright && playwright install chromium"
            ) from e
        self._pw = await async_playwright().start()
        self._ctx = await self._pw.chromium.launch_persistent_context(
            str(self.profile_dir),
            headless=self.headless,
            locale="ru-RU",
            viewport={"width": 1400, "height": 900},
            executable_path=self.executable_path,
            proxy=self.proxy,
        )
        return self

    async def __aexit__(self, *exc) -> None:
        if self._ctx:
            await self._ctx.close()
        if self._pw:
            await self._pw.stop()

    async def _pause(self, k: float = 1.0) -> None:
        await asyncio.sleep(self.delay * k * random.uniform(0.7, 1.3))

    async def search(
        self,
        query: str,
        city: str = "",
        limit: int = 100,
        on_found: Callable[[Business], None] | None = None,
        skip_ids: set[str] | None = None,
    ) -> list[Business]:
        """Ищет query (+ город) и листает выдачу, пока не наберёт limit организаций.

        skip_ids — уже собранные ранее: они не считаются в limit и не возвращаются,
        поэтому выдача листается глубже, до новых компаний.
        """
        page = await self._ctx.new_page()
        skip = skip_ids or set()
        found: dict[str, Business] = {}
        skipped: set[str] = set()
        pending: list[asyncio.Task] = []

        def add(items: list[Business]) -> None:
            for b in items:
                if b.org_id in skip:
                    skipped.add(b.org_id)
                elif b.org_id in found:
                    merge(found[b.org_id], b)
                else:
                    found[b.org_id] = b
                    if on_found:
                        on_found(b)

        async def handle(resp) -> None:
            try:
                add(extract_businesses(await resp.json(), query, city))
            except Exception:
                pass

        def on_response(resp) -> None:
            if "/maps/api/search" in resp.url:
                pending.append(asyncio.ensure_future(handle(resp)))

        page.on("response", on_response)
        text = f"{query} {city}".strip()
        try:
            await page.goto(f"{MAPS_URL}?text={quote(text)}", wait_until="domcontentloaded")
            await page.wait_for_timeout(3000)
            await _wait_captcha(page, self.headless, self.captcha_timeout)
            state = await _state_view(page)
            if state is not None:
                add(extract_businesses(state, query, city))

            stale = 0
            while len(found) < limit and stale < 5:
                before = len(found) + len(skipped)
                await _scroll_list(page)
                await self._pause()
                await _wait_captcha(page, self.headless, self.captcha_timeout)
                if pending:
                    await asyncio.gather(*pending)
                    pending.clear()
                stale = stale + 1 if len(found) + len(skipped) == before else 0
            if pending:
                await asyncio.gather(*pending)
        finally:
            await page.close()
        return list(found.values())[:limit]

    async def enrich(self, b: Business) -> Business:
        """Открывает карточку организации и добирает телефоны, сайт, соцсети, рейтинг."""
        page = await self._ctx.new_page()
        payloads: list[object] = []
        pending: list[asyncio.Task] = []

        async def handle(resp) -> None:
            try:
                payloads.append(await resp.json())
            except Exception:
                pass

        def on_response(resp) -> None:
            if "/maps/api/" in resp.url:
                pending.append(asyncio.ensure_future(handle(resp)))

        page.on("response", on_response)
        try:
            await page.goto(b.maps_url, wait_until="domcontentloaded")
            await page.wait_for_timeout(2500)
            await _wait_captcha(page, self.headless, self.captcha_timeout)
            state = await _state_view(page)
            if state is not None:
                payloads.append(state)
            if pending:
                await asyncio.gather(*pending)
            for payload in payloads:
                for other in extract_businesses(payload):
                    if other.org_id == b.org_id:
                        merge(b, other)
        finally:
            await page.close()
        await self._pause(0.5)
        return b
