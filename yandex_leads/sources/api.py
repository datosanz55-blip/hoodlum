"""Сбор через официальный «API Поиска по организациям» Яндекса.

Нужен API-ключ (developer.tech.yandex.ru). API не отдаёт рейтинг и отзывы —
только название, адрес, сайт, телефоны, рубрики и часы работы.
"""

from __future__ import annotations

import time
from typing import Any, Callable

import httpx

from ..models import Business

API_URL = "https://search-maps.yandex.ru/v1/"
PAGE_SIZE = 50  # максимум, который принимает API
MAX_SKIP = 1000


def business_from_feature(feature: dict[str, Any], query: str = "", city: str = "") -> Business | None:
    props = feature.get("properties") or {}
    meta = props.get("CompanyMetaData")
    if not meta:
        return None
    coords = (feature.get("geometry") or {}).get("coordinates") or [None, None]
    url = meta.get("url")
    links = [l.get("href") for l in meta.get("Links") or [] if isinstance(l, dict) and l.get("href")]
    return Business(
        org_id=str(meta.get("id", "")),
        name=meta.get("name") or props.get("name", ""),
        address=meta.get("address") or props.get("description", ""),
        city=city,
        query=query,
        categories=[c["name"] for c in meta.get("Categories") or [] if c.get("name")],
        phones=[p["formatted"] for p in meta.get("Phones") or [] if p.get("formatted")],
        websites=[url] if url else [],
        social_links=links,
        hours=(meta.get("Hours") or {}).get("text", ""),
        lon=coords[0],
        lat=coords[1],
        source="api",
    )


class ApiCollector:
    def __init__(
        self, api_key: str, delay: float = 0.3, timeout: float = 15.0, proxy: str | None = None
    ) -> None:
        if not api_key:
            raise SystemExit("Нужен API-ключ: --api-key или переменная YANDEX_API_KEY")
        self.api_key = api_key
        self.delay = delay
        self.client = httpx.Client(timeout=timeout, proxy=proxy or None)

    def close(self) -> None:
        self.client.close()

    def search(
        self,
        query: str,
        city: str = "",
        limit: int = 100,
        on_found: Callable[[Business], None] | None = None,
    ) -> list[Business]:
        text = f"{query} {city}".strip()
        found: dict[str, Business] = {}
        skip = 0
        while len(found) < limit and skip <= MAX_SKIP:
            resp = self.client.get(
                API_URL,
                params={
                    "apikey": self.api_key,
                    "text": text,
                    "type": "biz",
                    "lang": "ru_RU",
                    "results": PAGE_SIZE,
                    "skip": skip,
                },
            )
            if resp.status_code == 403:
                raise SystemExit("API вернул 403: проверьте ключ и что он подключён к «API Поиска по организациям».")
            resp.raise_for_status()
            features = resp.json().get("features") or []
            for f in features:
                b = business_from_feature(f, query, city)
                if b and b.org_id not in found:
                    found[b.org_id] = b
                    if on_found:
                        on_found(b)
            if len(features) < PAGE_SIZE:
                break
            skip += PAGE_SIZE
            time.sleep(self.delay)
        return list(found.values())[:limit]
