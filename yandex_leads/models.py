"""Модели данных: организация с карт, результат аудита сайта, лид."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class Business:
    """Организация, найденная на Яндекс Картах."""

    org_id: str
    name: str
    address: str = ""
    city: str = ""
    query: str = ""
    categories: list[str] = field(default_factory=list)
    phones: list[str] = field(default_factory=list)
    websites: list[str] = field(default_factory=list)
    social_links: list[str] = field(default_factory=list)
    rating: float | None = None
    rating_count: int | None = None
    review_count: int | None = None
    hours: str = ""
    lat: float | None = None
    lon: float | None = None
    source: str = ""

    @property
    def maps_url(self) -> str:
        return f"https://yandex.ru/maps/org/{self.org_id}/" if self.org_id else ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Business":
        known = {f for f in cls.__dataclass_fields__}
        return cls(**{k: v for k, v in data.items() if k in known})


@dataclass
class SiteAudit:
    """Результат быстрой проверки сайта организации."""

    url: str
    final_url: str = ""
    reachable: bool = False
    status: int | None = None
    error: str = ""
    https: bool = False
    mobile_viewport: bool = False
    title: str = ""
    meta_description: bool = False
    structured_data: bool = False
    analytics: bool = False
    online_booking: bool = False
    chat_widget: bool = False
    messengers: bool = False
    blog: bool = False
    builder: str = ""
    copyright_year: int | None = None
    social_links: list[str] = field(default_factory=list)
    response_ms: int | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Offer:
    """Услуга, которую имеет смысл предложить, и причины."""

    service: str
    weight: int
    reasons: list[str] = field(default_factory=list)


@dataclass
class Lead:
    business: Business
    audit: SiteAudit | None
    own_site: str
    offers: list[Offer]
    score: int
    priority: str
    pitch: str
