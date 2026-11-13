from yandex_leads.analyzer import analyze
from yandex_leads.cli import main
from yandex_leads.export import append_raw
from yandex_leads.models import Business, SiteAudit
from yandex_leads.qualify import QualifyOptions, assess, city_centers, distance_km

CENTER = (55.1599, 61.4026)  # Челябинск
OPTS = QualifyOptions()


def biz(**kw):
    base = dict(
        org_id="1", name="Тест", city="Челябинск", categories=["Стоматология", "Имплантация"],
        phones=["+7 351 000-00-00"], rating=4.7, review_count=60, hours="ежедневно 9–21",
        lat=55.16, lon=61.40,
    )
    base.update(kw)
    return Business(**base)


def test_rejects_junk():
    assert assess(biz(review_count=None, rating_count=None), None, CENTER, OPTS).reject == "мало отзывов"
    assert assess(biz(review_count=2), None, CENTER, OPTS).reject == "мало отзывов"
    assert assess(biz(phones=[]), None, CENTER, OPTS).reject == "нет телефона"
    assert assess(biz(status="permanent-closed"), None, CENTER, OPTS).reject == "закрыта"
    assert assess(biz(hours="Закрыто навсегда"), None, CENTER, OPTS).reject == "закрыта"
    # Сосновский район, ~40 км от центра
    assert assess(biz(lat=55.45, lon=61.10), None, CENTER, OPTS).reject == "далеко от центра"


def test_night_hours_text_is_not_closed():
    assert assess(biz(hours="Закрыто до 09:00"), None, CENTER, OPTS).reject == ""


def test_options_relax_filters():
    relaxed = QualifyOptions(min_reviews=0, max_km=100, require_phone=False)
    assert assess(biz(review_count=0, phones=[], lat=55.45, lon=61.10), None, CENTER, relaxed).reject == ""


def test_score_and_label():
    strong = assess(biz(websites=["http://clinic.ru"]), SiteAudit(url="x", reachable=True), CENTER, OPTS)
    assert strong.reject == "" and strong.score >= 7 and strong.label == "сильная"
    weak = assess(biz(review_count=6, rating=3.2, hours="", categories=["Стоматология"], lat=55.30, lon=61.40),
                  None, CENTER, OPTS)
    assert weak.label == "слабая"
    big = assess(biz(review_count=2500), None, CENTER, OPTS)
    assert big.big


def test_priority_needs_live_company():
    # Много проблем (нет сайта), но компания живая → A
    live = biz(websites=[], rating=4.3, review_count=45)
    lead = analyze(live, None, quality=assess(live, None, CENTER, OPTS))
    assert lead.priority == "A"
    # Те же проблемы у крупной сети → не A
    chain = biz(websites=[], rating=4.3, review_count=3000)
    assert analyze(chain, None, quality=assess(chain, None, CENTER, OPTS)).priority != "A"


def test_city_centers_fallback_to_median():
    items = [Business(str(i), "x", city="Неизвестноград", lat=50 + i / 100, lon=40.0) for i in range(5)]
    c = city_centers(items)["Неизвестноград"]
    assert abs(c[0] - 50.02) < 1e-9 and c[1] == 40.0
    assert city_centers([biz()])["Челябинск"] == CENTER
    assert 0 < distance_km(CENTER, (55.45, 61.10)) < 50


def test_cli_analyze_filters_junk(tmp_path, capsys):
    from openpyxl import load_workbook

    raw = tmp_path / "raw.jsonl"
    append_raw(raw, biz(org_id="good", name="Живая клиника", websites=[]))
    append_raw(raw, biz(org_id="dead", name="Ноль отзывов", review_count=None, rating=None))
    append_raw(raw, biz(org_id="far", name="В посёлке", lat=55.6, lon=61.0))
    out = tmp_path / "leads.xlsx"
    main(["analyze", str(raw), "-o", str(out), "--no-audit"])
    names = [r[3] for r in load_workbook(out)["Лиды"].iter_rows(min_row=2, values_only=True)]
    assert names == ["Живая клиника"]
    assert "мало отзывов — 1" in capsys.readouterr().err

    main(["analyze", str(raw), "-o", str(out), "--no-audit", "--no-filter"])
    assert len(list(load_workbook(out)["Лиды"].iter_rows(min_row=2))) == 3
