#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const IGNORE_FLAG_SHORT = '-i';
const IGNORE_FLAG_LONG = '--ignore';

// Поддерживаемые расширения и маппинг на тип языка
const LANG_EXTENSIONS = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  svelte: 'svelte',
  vue: 'vue',
  css: 'css',
  html: 'html',
  json: 'json',
  py: 'python',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  php: 'php',
};

// Паттерны для удаления комментариев по языку
const COMMENT_PATTERNS = {
  javascript: [
    /\/\/.*$/gm,
    /\/\*[\s\S]*?\*\//gm,
  ],
  typescript: [
    /\/\/.*$/gm,
    /\/\*[\s\S]*?\*\//gm,
  ],
  css: [
    /\/\*[\s\S]*?\*\//gm,
  ],
  html: [
    /<!--[\s\S]*?-->/gm,
  ],
  json: [
    /\/\/.*$/gm,
  ],
  python: [
    /#.*$/gm,
    /'''[\s\S]*?'''/gm,
    /"""[\s\S]*?"""/gm,
  ],
  java: [
    /\/\/.*$/gm,
    /\/\*[\s\S]*?\*\//gm,
  ],
  c: [
    /\/\/.*$/gm,
    /\/\*[\s\S]*?\*\//gm,
  ],
  cpp: [
    /\/\/.*$/gm,
    /\/\*[\s\S]*?\*\//gm,
  ],
  php: [
    /\/\/.*$/gm,
    /#.*$/gm,
    /\/\*[\s\S]*?\*\//gm,
  ],
  svelte: [
    /\/\/.*$/gm,
    /\/\*[\s\S]*?\*\//gm,
    /<!--[\s\S]*?-->/gm,
  ],
  vue: [
    /\/\/.*$/gm,
    /\/\*[\s\S]*?\*\//gm,
    /<!--[\s\S]*?-->/gm,
  ],
  unknown: [
    /\/\/.*$/gm,                     // C-style однострочные
    /\/\*[\s\S]*?\*\//gm,           // C-style многострочные
    /<!--[\s\S]*?-->/gm,            // HTML-style
    /#.*$/gm,                       // Shell, Python, INI
    /""\"[\s\S]*?"""/gm,           // Многострочные строки (Python/JS)
    /'''[\s\S]*?'''/gm,
  ],
};

/**
 * Удаляет комментарии и минифицирует текст
 */
function minifyText(lang, text) {
  const patterns = COMMENT_PATTERNS[lang];
  if (!patterns) return text;

  for (const pat of patterns) {
    text = text.replace(pat, '');
  }
  // Заменяем все последовательности пробелов на один пробел
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

/**
 * Рекурсивно проходит по директории, пропуская пути по ignorePatterns
 */
async function* walk(dir, ignorePatterns) {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  for (const dirent of dirents) {
    const res = path.resolve(dir, dirent.name);
    if (ignorePatterns.some(ig => res.includes(ig))) continue;
    if (dirent.isDirectory()) {
      yield* walk(res, ignorePatterns);
    } else {
      yield res;
    }
  }
}

/**
 * Определяет язык по расширению
 * Возвращает 'unknown' для неподдерживаемых/неизвестных расширений
 */
function getLangFromExt(ext) {
  const lowerExt = ext.toLowerCase();
  if (lowerExt === 'svelte') return 'svelte';
  if (lowerExt === 'vue') return 'vue';
  return LANG_EXTENSIONS[lowerExt] || 'unknown';
}

/**
 * Главная функция
 */
async function main() {
  const args = process.argv.slice(2);

  let targetDir = '.';
  let ignoreRaw = '';

  // Парсинг аргументов
  for (let i = 0; i < args.length; i++) {
    if (args[i] === IGNORE_FLAG_LONG || args[i] === IGNORE_FLAG_SHORT) {
      ignoreRaw = args[i + 1] || '';
      i++;
    } else {
      targetDir = args[i];
    }
  }

  const ignorePatterns = ignoreRaw.split(',').filter(Boolean);

  const files = [];
  for await (const f of walk(targetDir, ignorePatterns)) {
    files.push(f);
  }

  // Параллельная обработка: число потоков = число ядер CPU
  const concurrency = os.cpus().length;
  let index = 0;
  const results = [];

  async function worker() {
    while (index < files.length) {
      const currentIndex = index++;
      const file = files[currentIndex];
      const ext = path.extname(file).slice(1); // убираем точку
      const lang = getLangFromExt(ext);

      try {
        const text = await fs.readFile(file, 'utf8');
        const minified = minifyText(lang, text);
        const relativePath = path.relative(targetDir, file);
        results[currentIndex] = `// File: ${relativePath}\n${minified}`;
      } catch (e) {
        // Пропускаем файлы, которые нельзя прочитать
        results[currentIndex] = '';
      }
    }
  }

  // Запускаем несколько worker’ов
  await Promise.all(Array(concurrency).fill(null).map(worker));

  // Выводим результат
  console.log(results.filter(Boolean).join('\n'));
}

// Запуск с обработкой ошибок
main().catch(err => {
  console.error('Ошибка выполнения:', err);
  process.exit(1);
});