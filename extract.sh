#!/bin/bash

# Функция для минификации текста
minify_file() {
    local file="$1"
    # Удаление комментариев, пробелов, табуляций и переносов строк
    cat "$file" | sed '/^\s*#/d' | tr -d '\t' | tr -s ' ' | tr -d '\n'
}

# Проверка наличия аргументов
if [ "$#" -lt 1 ]; then
    echo "Использование: extract <путь_к_проекту> [--output <директория>] [--ignore паттерн1 паттерн2 ...]"
    exit 1
fi

PROJECT_DIR="$1"

# Определяем OUTPUT_DIR (по умолчанию рядом с проектом)
shift
while [[ "$1" == "--"* ]]; do
    case "$1" in
        --output)
            shift
            OUTPUT_DIR="$1"
            ;;
        --ignore)
            shift
            IGNORE_PATTERNS=()
            while [[ "$1" != "--"* && -n "$1" ]]; do
                IGNORE_PATTERNS+=("$1")
                shift
            done
            ;;
        *)
            echo "Неизвестный параметр: $1"
            exit 1
            ;;
    esac
    shift
done

# Если OUTPUT_DIR не указан, используем директорию проекта
OUTPUT_DIR="${OUTPUT_DIR:-$(dirname "$PROJECT_DIR")}"

# Проверка существования директории проекта
if [ ! -d "$PROJECT_DIR" ]; then
    echo "Ошибка: Директория проекта не существует."
    exit 1
fi

# Создание выходного файла
output_file="${OUTPUT_DIR}/$(basename "$PROJECT_DIR").txt.gz"

# Создание выходной директории, если её нет
mkdir -p "$OUTPUT_DIR" || { echo "Ошибка: Не удалось создать выходную директорию."; exit 1; }

# Функция для проверки соответствия пути игнорируемым паттернам
is_ignored() {
    local file="$1"
    relative_path="${file/#$PROJECT_DIR\//}" # Относительный путь от корня проекта

    for pattern in "${IGNORE_PATTERNS[@]}"; do
        # Преобразуем паттерн в регулярное выражение
        regex=$(echo "$pattern" | sed 's/\./\\./g' | sed 's/\*/.*/g' | sed 's/?/./g' | sed 's#/#\\/#g')
        # Добавляем обработку паттернов, заканчивающихся на /
        if [[ "$pattern" == */ ]]; then
            regex="^${regex}.*"
        fi
        # Проверяем, соответствует ли относительный путь паттерну
        if [[ "$relative_path" =~ ^$regex$ ]]; then
            return 0 # Файл игнорируется
        fi
    done
    return 1 # Файл не игнорируется
}

# Создаем временный файл для хранения объединенного текста
temp_file="$(mktemp)"

# Рекурсивный обход директорий
while IFS= read -r -d '' file; do
    if is_ignored "$file"; then
        continue # Пропускаем игнорируемые файлы
    fi

    relative_path="${file/#$PROJECT_DIR\//}"
    # Запись пути и содержимого файла во временный файл
    {
        echo "$relative_path"
        minify_file "$file"
        echo ""
    } >> "$temp_file"
done < <(find "$PROJECT_DIR" -type f -print0)

# Сжатие всего содержимого временного файла
gzip < "$temp_file" > "$output_file"

# Удаляем временный файл
rm -f "$temp_file"

echo "Сжатый файл сохранён в: $output_file"