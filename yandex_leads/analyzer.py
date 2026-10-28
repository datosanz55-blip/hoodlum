"""Подбор услуг под организацию и оценка «теплоты» лида.

Каждое правило добавляет услугу и человеческую причину, которую можно
сразу использовать в сообщении клиенту. Вес — насколько сильный повод.
"""

from __future__ import annotations

from datetime import date

from .models import Business, Lead, Offer, SiteAudit
from .pitch import build_pitch
from .site_audit import pick_own_site

SITE = "Создание сайта"
CONTENT = "Контент-завод"
SEO = "SEO/GEO"
ADMIN = "Онлайн-администратор"
AUTO = "Автоматизация"
ALL_SERVICES = (SITE, CONTENT, SEO, ADMIN, AUTO)

SERVICE_ALIASES = {
    "site": SITE, "сайт": SITE,
    "content": CONTENT, "контент": CONTENT,
    "seo": SEO, "geo": SEO,
    "admin": ADMIN, "админ": ADMIN,
    "auto": AUTO, "автоматизация": AUTO,
}

# Ниши, где клиенты записываются на услугу — там онлайн-запись и админ особенно нужны.
BOOKING_NICHES = (
    "салон", "барбер", "парикмахер", "маникюр", "ногт", "косметолог", "спа", "массаж",
    "стомат", "клиник", "медицин", "врач", "ветеринар", "автосервис", "шиномонтаж",
    "автомойк", "детейлинг", "фитнес", "тренаж", "йога", "танц", "школа", "курсы",
    "репетитор", "студия", "тату", "эпиляц", "брови", "ресниц", "солярий", "баня", "сауна",
    "ресторан", "кафе", "бар", "кальян", "гостиниц", "отель", "хостел", "квест",
)


def _is_booking_niche(b: Business) -> bool:
    text = " ".join(b.categories + [b.query]).lower()
    return any(n in text for n in BOOKING_NICHES)


def analyze(
    b: Business,
    audit: SiteAudit | None = None,
    me: str = "",
    services: set[str] | None = None,
) -> Lead:
    """services — если задано, предлагаем только эти услуги."""
    offers: dict[str, Offer] = {}

    def add(service: str, weight: int, reason: str) -> None:
        o = offers.setdefault(service, Offer(service, 0))
        o.weight += weight
        o.reasons.append(reason)

    own_site = pick_own_site(b.websites)
    socials = list(dict.fromkeys(b.social_links + (audit.social_links if audit else [])))
    booking_niche = _is_booking_niche(b)
    reviews = b.review_count if b.review_count is not None else b.rating_count

    # --- Сайт ---
    if not own_site:
        if not b.websites:
            add(SITE, 6, "нет сайта в карточке на Картах")
        else:
            add(SITE, 5, "вместо сайта — соцсеть/агрегатор/таплинк")
        add(SITE, 1, "без своего сайта Алиса/YandexGPT/ChatGPT почти не рекомендуют бизнес")
    elif audit and not audit.reachable:
        add(SITE, 5, f"сайт не открывается ({audit.error or audit.status})")
    elif audit:
        if not audit.mobile_viewport:
            add(SITE, 3, "сайт не адаптирован под телефоны")
        if not audit.https:
            add(SITE, 1, "сайт без HTTPS — браузер помечает его как небезопасный")
        if audit.copyright_year and date.today().year - audit.copyright_year >= 3:
            add(SITE, 2, f"сайт давно не обновлялся (© {audit.copyright_year})")
        if audit.builder in ("uCoz", "Nethouse", "Taplink"):
            add(SITE, 2, f"сайт на устаревшем конструкторе ({audit.builder})")
        if audit.response_ms and audit.response_ms > 4000:
            add(SITE, 1, f"сайт медленно грузится (~{audit.response_ms / 1000:.1f} с)")

    # --- SEO/GEO ---
    if audit and audit.reachable:
        if not audit.title or not audit.meta_description:
            add(SEO, 2, "у сайта нет нормального title/description для поиска")
        if not audit.structured_data:
            add(SEO, 2, "нет микроразметки — нейросети и поиск хуже понимают, что за бизнес")
    if b.rating is not None and b.rating < 4.5:
        add(SEO, 3, f"рейтинг на Картах {b.rating:.1f} — ниже конкурентов")
    if reviews is not None and reviews < 30:
        add(SEO, 2, f"мало отзывов на Картах ({reviews})")
    if b.categories and len(b.categories) == 1:
        add(SEO, 1, "в карточке всего одна рубрика")

    # --- Контент ---
    if not socials:
        add(CONTENT, 4, "нет соцсетей в карточке и на сайте")
    elif len(socials) == 1:
        add(CONTENT, 1, "всего одна соцсеть")
    if audit and audit.reachable and not audit.blog:
        add(CONTENT, 2, "на сайте нет блога/статей — нечем ранжироваться и цитироваться в нейровыдаче")

    # --- Онлайн-администратор ---
    if reviews and reviews >= 30 and b.rating is not None and b.rating < 4.7:
        add(ADMIN, 3, "много отзывов при среднем рейтинге — нужно отрабатывать негатив")
    if audit and audit.reachable and not audit.messengers and not audit.chat_widget:
        add(ADMIN, 2, "на сайте нет мессенджеров и чата — заявки теряются")
    if b.phones and not own_site and not socials:
        add(ADMIN, 2, "связаться можно только по телефону")
    if booking_niche and not (audit and audit.online_booking):
        add(ADMIN, 1, "запись, похоже, только по звонку")

    # --- Автоматизация ---
    if booking_niche and not (audit and audit.online_booking):
        add(AUTO, 3, "не нашли онлайн-записи/бронирования")
    if audit and audit.reachable and not audit.analytics:
        add(AUTO, 2, "на сайте нет Яндекс Метрики — не видно, откуда клиенты")
    if audit and audit.reachable and not audit.chat_widget:
        add(AUTO, 1, "нет чат-бота/виджета для заявок")

    offer_list = sorted(
        (o for o in offers.values() if not services or o.service in services),
        key=lambda o: -o.weight,
    )
    score = sum(o.weight for o in offer_list)
    priority = "A" if score >= 14 else "B" if score >= 8 else "C"
    lead = Lead(b, audit, own_site, offer_list, score, priority, "")
    lead.pitch = build_pitch(lead, me)
    return lead


def parse_services(raw: list[str] | None) -> set[str]:
    if not raw:
        return set()
    out: set[str] = set()
    for item in raw:
        for part in item.split(","):
            key = part.strip().lower()
            if not key:
                continue
            if key not in SERVICE_ALIASES:
                raise SystemExit(f"Неизвестная услуга '{part}'. Доступно: {', '.join(sorted(SERVICE_ALIASES))}")
            out.add(SERVICE_ALIASES[key])
    return out
