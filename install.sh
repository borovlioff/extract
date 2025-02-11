#!/bin/bash

# Установка зависимостей (если есть)
echo "Установка зависимостей..."
sudo apt-get update
sudo apt-get install -y sed

# Добавление скрипта в глобальную область видимости
EXTRACT_PATH="$(pwd)/extract.sh"
GLOBAL_BIN="/usr/local/bin/extract"

if [ -f "$GLOBAL_BIN" ]; then
    echo "Обновление глобальной команды..."
else
    echo "Добавление глобальной команды..."
fi

sudo ln -sf "$EXTRACT_PATH" "$GLOBAL_BIN"

echo "Установка завершена!"