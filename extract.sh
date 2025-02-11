#!/bin/bash

# Функция для минификации текста
minify() {
    local content="$1"
    # Удаление комментариев, лишних пробелов, табуляций и переносов строк
    echo "$content" | sed '/^\s*$/d' | sed 's/#.*$//' | tr -s '[:space:]' ' ' | tr -d '\t'
}

# Проверка аргументов
if [ -z "$1" ]; then
    echo "Usage: extract <project_directory> [<output_directory>]"
    exit 1
fi

PROJECT_DIR="$1"
OUTPUT_DIR="${2:-$(dirname "$PROJECT_DIR")}"

# Проверка существования директории проекта
if [ ! -d "$PROJECT_DIR" ]; then
    echo "Error: Project directory does't exist"
    exit 1
fi

# Создание выходного файла
OUTPUT_FILE="$OUTPUT_DIR/$(basename "$PROJECT_DIR").txt"

# Получение списка игнорируемых файлов из .gitignore
IGNORED_FILES=$(grep -v '^#' "$PROJECT_DIR/.gitignore" 2>/dev/null | grep -v '^$')

# Рекурсивный обход директорий
find "$PROJECT_DIR" -type f | while read -r file; do
    # Проверка на соответствие .gitignore
    if [ -n "$IGNORED_FILES" ]; then
        skip=false
        for pattern in $IGNORED_FILES; do
            if [[ "$file" =~ $pattern ]]; then
                skip=true
                break
            fi
        done
        if [ "$skip" = true ]; then
            continue
        fi
    fi

    # Минификация содержимого файла
    content=$(cat "$file" 2>/dev/null)
    minified_content=$(minify "$content")

    # Запись в выходной файл
    echo "$(realpath --relative-to="$PROJECT_DIR" "$file")" >> "$OUTPUT_FILE"
    echo "$minified_content" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE" # Пустая строка между файлами
done

echo "Extraction completed. Output saved to $OUTPUT_FILE"#!/bin/bash

# Проверка наличия аргументов
if [ "$#" -lt 1 ]; then
    echo "Использование: extract <путь_к_проекту> [путь_для_сохранения]"
    exit 1
fi

PROJECT_DIR="$1"
OUTPUT_DIR="${2:-$(dirname "$PROJECT_DIR")}"

# Функция минификации файла
minify_file() {
    local file="$1"
    # Удаление комментариев, пробелов, табуляций и переносов строк
    cat "$file" | sed '/^\s*#/d' | tr -d '\t' | tr -s ' ' | tr -d '\n'
}

# Создание выходного файла
output_file="${OUTPUT_DIR}/$(basename "$PROJECT_DIR").txt"

echo "" > "$output_file" # Очистка файла перед записью

# Обработка .gitignore
ignored_patterns=()
if [ -f "${PROJECT_DIR}/.gitignore" ]; then
    while IFS= read -r line; do
        if [[ ! $line =~ ^\s*# && -n $line ]]; then
            ignored_patterns+=("$line")
        fi
    done < "${PROJECT_DIR}/.gitignore"
fi

# Рекурсивный обход директорий
while IFS= read -r -d '' file; do
    skip=false
    for pattern in "${ignored_patterns[@]}"; do
        if [[ "$file" == ${PROJECT_DIR}/${pattern} || "$file" == ${PROJECT_DIR}/${pattern}* ]]; then
            skip=true
            break
        fi
    done

    if [ "$skip" = false ]; then
        relative_path="${file/#$PROJECT_DIR\//}"
        echo "$relative_path" >> "$output_file"
        minify_file "$file" >> "$output_file"
        echo "" >> "$output_file"
    fi
done < <(find "$PROJECT_DIR" -type f -print0)

echo "Файл сохранён в: $output_file"