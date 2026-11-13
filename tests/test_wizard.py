from datetime import datetime
from pathlib import Path

from yandex_leads import cli, wizard


def test_split_and_paths():
    assert wizard.split_niches(" мебельный магазин, «кухни на заказ»;  ") == ["мебельный магазин", "кухни на заказ"]
    out = wizard.output_path(["мебельный магазин"], "Челябинск", datetime(2026, 11, 13, 14, 5))
    assert out == Path("Результаты/мебельный магазин Челябинск 2026-11-13 14-05.xlsx")
    assert "и ещё 1" in wizard.output_path(["a", "b"], "X").name
    argv = wizard.build_argv(["мебельный магазин", "кухни"], "Челябинск", 150, out)
    assert argv[:2] == ["collect", "--only-new"]
    assert argv.count("-q") == 2 and "--limit" in argv and argv[argv.index("--limit") + 1] == "150"


def test_wizard_runs_collect_with_defaults(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    answers = iter(["мебельный магазин", "", "сто50", "нет"])  # город и число — по умолчанию/с мусором
    monkeypatch.setattr("builtins.input", lambda prompt="": next(answers))
    calls = []

    def fake_main(argv):
        calls.append(argv)
        out = Path(argv[argv.index("-o") + 1])
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text("x")

    monkeypatch.setattr(cli, "main", fake_main)
    monkeypatch.setattr(wizard, "open_file", lambda p: calls.append(["open", str(p)]))
    wizard.run()
    argv = calls[0]
    assert argv[argv.index("-q") + 1] == "мебельный магазин"
    assert argv[argv.index("--city") + 1] == "Челябинск"
    assert argv[argv.index("--limit") + 1] == "50"
    assert calls[1][0] == "open"


def test_no_args_starts_wizard(monkeypatch):
    started = []
    monkeypatch.setattr(wizard, "run", lambda: started.append(True))
    cli.main([])
    cli.main(["start"])
    assert started == [True, True]
