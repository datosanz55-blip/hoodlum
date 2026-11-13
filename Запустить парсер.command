#!/bin/bash
# Двойной клик — запуск парсера. При первом запуске сам установит всё нужное.
cd "$(dirname "$0")" || exit 1

pause() { echo; read -r -p "Нажмите Enter, чтобы закрыть окно."; }

if [ ! -x .venv/bin/python ]; then
  echo "Первый запуск: устанавливаю всё нужное, это займёт 5–10 минут…"
  if ! command -v python3 >/dev/null; then
    echo "Не найден Python. Установите его с python.org и запустите этот файл снова."
    pause; exit 1
  fi
  if ! { python3 -m venv .venv \
      && .venv/bin/pip install -q -r requirements.txt \
      && .venv/bin/python -m playwright install chromium; }; then
    rm -rf .venv
    echo "Установка не удалась — пришлите скриншот этого окна."
    pause; exit 1
  fi
fi

# После обновления парсера доустановит новые зависимости и браузер, если их нет.
.venv/bin/pip install -q -r requirements.txt >/dev/null 2>&1
.venv/bin/python -m playwright install chromium >/dev/null 2>&1

.venv/bin/python -m yandex_leads
pause
