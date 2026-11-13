"""Проверка механики браузерного сборщика на подставной странице.

Запросы к yandex.ru перехватываются через page.route, в сеть ничего не уходит.
Тест пропускается, если Playwright или браузер не установлены.
"""

import asyncio
import json
import os

import pytest

pytest.importorskip("playwright")

from yandex_leads.sources.browser import BrowserCollector  # noqa: E402


def item(i):
    return {
        "type": "business", "id": str(i), "title": f"Салон {i}", "address": f"ул. Тестовая, {i}",
        "categories": [{"name": "Салон красоты"}], "phones": [{"number": f"+7 900 000-00-{i:02d}"}],
        "ratingData": {"ratingValue": 4.5, "reviewCount": i},
    }


PAGE = """<!doctype html><html><body>
<script type="application/json" class="state-view">%s</script>
<div class="scroll__container" style="height:300px;overflow:auto">
  <div id="list" style="height:3000px"></div>
</div>
<script>
  let page = 1;
  const box = document.querySelector('.scroll__container');
  box.addEventListener('scroll', () => {
    if (page < 3) fetch('/maps/api/search?page=' + (page++));
    box.querySelector('#list').style.height = (3000 * (page + 1)) + 'px';
  });
</script></body></html>"""


async def run(tmp_path, limit=12, skip_ids=None):
    state = json.dumps({"stack": [{"results": {"items": [item(i) for i in range(1, 6)]}}]})

    async def fulfill(route):
        url = route.request.url
        if "/maps/api/search" in url:
            n = int(url.rsplit("=", 1)[1])
            items = [item(i) for i in range(n * 5 + 1, n * 5 + 6)]
            await route.fulfill(json={"data": {"items": items}})
        else:
            await route.fulfill(body=PAGE % state, content_type="text/html")

    bc = BrowserCollector(
        profile_dir=tmp_path / "profile", headless=True, delay=0.2,
        executable_path=os.environ.get("YL_BROWSER_PATH"),
    )
    try:
        await bc.__aenter__()
    except Exception as e:  # браузер не установлен
        pytest.skip(f"браузер недоступен: {e}")
    try:
        await bc._ctx.route("https://yandex.ru/**", fulfill)
        return await bc.search("салон", "Казань", limit=limit, skip_ids=skip_ids)
    finally:
        await bc.__aexit__()


def test_browser_collects_state_and_scroll(tmp_path):
    found = asyncio.run(run(tmp_path))
    ids = [b.org_id for b in found]
    assert len(ids) == 12 and len(set(ids)) == 12
    assert ids[:5] == ["1", "2", "3", "4", "5"]  # из state-view
    assert all(b.city == "Казань" and b.query == "салон" for b in found)
    assert found[0].phones == ["+7 900 000-00-01"]


def test_browser_skips_already_collected(tmp_path):
    found = asyncio.run(run(tmp_path, limit=5, skip_ids={"1", "2", "3", "4", "5", "7"}))
    assert [b.org_id for b in found] == ["6", "8", "9", "10", "11"]
