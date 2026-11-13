"""Черновик первого сообщения для организации.

Это заготовка, а не готовая рассылка: перед отправкой прочитайте и
поправьте под конкретного человека.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .models import Lead

WHAT_WE_DO = {
    "Создание сайта": "сделать быстрый сайт с онлайн-заявками, который хорошо смотрится с телефона",
    "Контент-завод": "наладить регулярный контент для соцсетей и сайта без участия владельца",
    "SEO/GEO": "поднять карточку и сайт в Яндексе и в ответах нейросетей (Алиса, YandexGPT, ChatGPT)",
    "Онлайн-администратор": "взять на себя ответы клиентам в мессенджерах и отработку отзывов",
    "Автоматизация": "настроить онлайн-запись, чат-бота и CRM, чтобы заявки не терялись",
}


def build_pitch(lead: "Lead", me: str = "") -> str:
    if not lead.offers:
        return ""
    b = lead.business
    niche = (b.categories[0].lower() if b.categories else "").strip()
    top = lead.offers[:3]
    observations = []
    for o in top:
        r = o.reasons[0]
        if r not in observations:
            observations.append(r)

    lines = [
        "Здравствуйте!",
        "",
        f"Нашли {b.name}{f' ({niche})' if niche else ''} на Яндекс Картах и посмотрели, "
        "как вас видят клиенты в интернете. Что бросилось в глаза:",
    ]
    lines += [f"— {r}" for r in observations]
    lines += ["", "Можем помочь:"]
    lines += [f"— {WHAT_WE_DO[o.service]}" for o in top if o.service in WHAT_WE_DO]
    lines += [
        "",
        "Если интересно — пришлём короткий разбор по вашему бизнесу бесплатно, "
        "а дальше решите сами, нужно ли что-то из этого.",
    ]
    if me:
        lines += ["", me]
    return "\n".join(lines)
