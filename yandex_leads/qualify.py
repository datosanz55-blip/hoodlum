"""Оценка, живая ли компания и есть ли у неё деньги на услуги.

Балл потребности (analyzer) считает проблемы — у мёртвой карточки их больше
всего. Поэтому отдельно оцениваем «надёжность»: отзывы, рейтинг, заполненность
карточки, присутствие в сети, — и отсеиваем то, чему звонить бессмысленно:
закрытые, без телефона, без отзывов, далеко за городом.
"""

from __future__ import annotations

import math
import re
import statistics
from dataclasses import dataclass, field

from .models import Business, SiteAudit
from .site_audit import pick_own_site

# Центры городов (широта, долгота). Для остальных центр берётся как медиана
# координат найденных компаний.
CITY_CENTERS = {
    "челябинск": (55.1599, 61.4026),
    "екатеринбург": (56.8380, 60.5975),
    "магнитогорск": (53.4071, 58.9800),
    "миасс": (55.0450, 60.1080),
    "златоуст": (55.1720, 59.6720),
    "копейск": (55.1170, 61.6250),
    "тюмень": (57.1530, 65.5343),
    "курган": (55.4410, 65.3410),
    "уфа": (54.7350, 55.9580),
    "пермь": (58.0100, 56.2290),
    "казань": (55.7963, 49.1088),
    "самара": (53.1959, 50.1002),
    "новосибирск": (55.0302, 82.9204),
    "москва": (55.7558, 37.6173),
    "санкт-петербург": (59.9386, 30.3141),
}

# Только явные формулировки: «Закрыто до 10:00» ночью — не признак закрытия.
CLOSED_RE = re.compile(r"закрыт\w* навсегда|временно не работает|больше не работает", re.I)


@dataclass
class QualifyOptions:
    min_reviews: int = 5
    max_km: float = 20.0
    require_phone: bool = True


@dataclass
class Quality:
    score: int = 0
    label: str = ""
    reasons: list[str] = field(default_factory=list)
    reject: str = ""
    big: bool = False


def reviews_of(b: Business) -> int:
    for v in (b.review_count, b.rating_count):
        if v is not None:
            return v
    return 0


def distance_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def city_centers(businesses: list[Business]) -> dict[str, tuple[float, float]]:
    """Центр для каждого города из запроса: известный или медиана координат."""
    centers: dict[str, tuple[float, float]] = {}
    for city in {b.city for b in businesses if b.city}:
        known = CITY_CENTERS.get(city.strip().lower())
        if known:
            centers[city] = known
            continue
        pts = [(b.lat, b.lon) for b in businesses if b.city == city and b.lat is not None and b.lon is not None]
        if pts:
            centers[city] = (statistics.median(p[0] for p in pts), statistics.median(p[1] for p in pts))
    return centers


def is_closed(b: Business) -> bool:
    return "closed" in b.status.lower() or bool(CLOSED_RE.search(b.hours or ""))


def assess(
    b: Business,
    audit: SiteAudit | None,
    center: tuple[float, float] | None,
    opts: QualifyOptions,
) -> Quality:
    q = Quality()
    reviews = reviews_of(b)

    # --- Отсев ---
    if is_closed(b):
        q.reject = "закрыта"
        return q
    if opts.require_phone and not b.phones:
        q.reject = "нет телефона"
        return q
    if reviews < opts.min_reviews:
        q.reject = "мало отзывов"
        return q
    km = None
    if center and b.lat is not None and b.lon is not None:
        km = distance_km(center, (b.lat, b.lon))
        if km > opts.max_km:
            q.reject = "далеко от центра"
            return q

    # --- Баллы надёжности (0–10) ---
    def plus(points: int, reason: str) -> None:
        q.score += points
        q.reasons.append(reason)

    if reviews >= 200:
        plus(4, f"{reviews} отзывов")
    elif reviews >= 50:
        plus(3, f"{reviews} отзывов")
    elif reviews >= 20:
        plus(2, f"{reviews} отзывов")
    else:
        plus(1, f"{reviews} отзывов")

    if b.rating is not None:
        if b.rating >= 4.5:
            plus(2, f"рейтинг {b.rating:.1f}")
        elif b.rating >= 4.0:
            plus(1, f"рейтинг {b.rating:.1f}")
        elif b.rating < 3.5:
            q.score -= 1
            q.reasons.append(f"низкий рейтинг {b.rating:.1f}")

    site_alive = bool(pick_own_site(b.websites)) and (audit is None or audit.reachable)
    if site_alive or b.social_links:
        plus(1, "есть сайт или соцсети")
    if b.hours:
        plus(1, "указаны часы работы")
    if len(b.categories) >= 2:
        plus(1, "заполнены рубрики")
    if km is not None and km <= opts.max_km / 2:
        plus(1, f"{km:.0f} км от центра")

    q.score = max(0, min(q.score, 10))
    q.label = "сильная" if q.score >= 7 else "нормальная" if q.score >= 4 else "слабая"
    # Крупные сети обычно уже с маркетологом — звонить можно, но не в первую очередь.
    if reviews >= 1000:
        q.big = True
        q.reasons.append("крупная — вероятно, есть свой маркетинг")
    return q
