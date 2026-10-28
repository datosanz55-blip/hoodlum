"""Разбор JSON, который отдаёт фронтенд Яндекс Карт.

Структура ответов у Яндекса периодически меняется, поэтому мы не привязываемся
к конкретному пути в JSON: рекурсивно обходим весь документ и забираем все
объекты, похожие на карточку организации.
"""

from __future__ import annotations

from collections import deque
from typing import Any, Iterator

from ..models import Business


def _walk(obj: Any) -> Iterator[dict]:
    # Обход в ширину: полные карточки из выдачи идут раньше вложенных обрывков.
    queue = deque([obj])
    while queue:
        cur = queue.popleft()
        if isinstance(cur, dict):
            yield cur
            queue.extend(cur.values())
        elif isinstance(cur, list):
            queue.extend(cur)


def _looks_like_business(d: dict) -> bool:
    if not isinstance(d.get("title"), str) or not d.get("id"):
        return False
    if d.get("type") == "business":
        return True
    # Без явного type считаем организацией то, у чего есть рубрики и адрес.
    return bool(d.get("categories")) and bool(d.get("address") or d.get("fullAddress"))


def _str_list(value: Any, *keys: str) -> list[str]:
    """Нормализует список строк/словарей в список строк по первому найденному ключу."""
    out: list[str] = []
    if isinstance(value, (str, dict)):
        value = [value]
    for item in value or []:
        if isinstance(item, str):
            s = item
        elif isinstance(item, dict):
            s = next((item[k] for k in keys if isinstance(item.get(k), str) and item[k]), "")
        else:
            s = ""
        s = s.strip()
        if s and s not in out:
            out.append(s)
    return out


def _num(value: Any, cast: type) -> Any:
    try:
        return cast(value) if value is not None and value != "" else None
    except (TypeError, ValueError):
        return None


def business_from_item(d: dict, query: str = "", city: str = "") -> Business:
    rating = d.get("ratingData") or d.get("rating") or {}
    if not isinstance(rating, dict):
        rating = {"ratingValue": rating}
    coords = d.get("coordinates") or d.get("displayCoordinates") or [None, None]
    if not (isinstance(coords, list) and len(coords) >= 2):
        coords = [None, None]
    hours = d.get("workingTimeText") or ""
    if not hours and isinstance(d.get("workingTime"), dict):
        hours = d["workingTime"].get("text", "")
    return Business(
        org_id=str(d.get("id")),
        name=d.get("title", "").strip(),
        address=d.get("fullAddress") or d.get("address") or "",
        city=city,
        query=query,
        categories=_str_list(d.get("categories"), "name"),
        phones=_str_list(d.get("phones"), "number", "value", "formatted"),
        websites=_str_list(d.get("urls"), "value", "href", "url"),
        social_links=_str_list(d.get("socialLinks"), "href", "url", "readableHref"),
        rating=_num(rating.get("ratingValue") or rating.get("score"), float),
        rating_count=_num(rating.get("ratingCount"), int),
        review_count=_num(rating.get("reviewCount"), int),
        hours=hours if isinstance(hours, str) else "",
        lon=_num(coords[0], float),
        lat=_num(coords[1], float),
        source="browser",
    )


def extract_businesses(obj: Any, query: str = "", city: str = "") -> list[Business]:
    seen: dict[str, Business] = {}
    for d in _walk(obj):
        if _looks_like_business(d):
            b = business_from_item(d, query, city)
            if b.org_id in seen:
                merge(seen[b.org_id], b)
            else:
                seen[b.org_id] = b
    return list(seen.values())


def merge(dst: Business, src: Business) -> Business:
    """Дополняет dst данными из src, ничего не затирая."""
    for name in ("address", "hours", "city", "query"):
        if not getattr(dst, name) and getattr(src, name):
            setattr(dst, name, getattr(src, name))
    for name in ("rating", "rating_count", "review_count", "lat", "lon"):
        if getattr(dst, name) is None and getattr(src, name) is not None:
            setattr(dst, name, getattr(src, name))
    for name in ("categories", "phones", "websites", "social_links"):
        lst = getattr(dst, name)
        lst.extend(x for x in getattr(src, name) if x not in lst)
    return dst
