#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const IGNORE_FLAG_SHORT = '-i';
const IGNORE_FLAG_LONG = '-ignore';

const LANG_EXTENSIONS = {
  js: 'javascript',
  ts: 'typescript',
  css: 'css',
  html: 'html',
  json: 'json',
  py: 'python',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  php: 'php',
};

const COMMENT_PATTERNS = {
  javascript: [
    /\/\/.*$/gm,                       // однострочные //
    /\/\*[\s\S]*?\*\//gm,             // многострочные /* */
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
    // JSON строго не содержит комментариев, но можно фильтровать строки с //
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
};

function minifyText(lang, text) {
  const patterns = COMMENT_PATTERNS[lang];
  if (!patterns) return text;

  for (const pat of patterns) {
    text = text.replace(pat, '');
  }
  // Минификация — удаление лишних пробелов и переносов строк
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

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

function getLangFromExt(ext) {
  return LANG_EXTENSIONS[ext.toLowerCase()];
}

async function main() {
  const args = process.argv.slice(2);

  // Папка (по умолчанию .)
  let targetDir = '.';
  // Список игнорируемых путей
  let ignoreRaw = '';
  
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

  // Ограничение параллелизма для чтения — количество ядер процессора
  const concurrency = os.cpus().length;
  let index = 0;
  const results = [];

  async function worker() {
    while (index < files.length) {
      const currentIndex = index++;
      const file = files[currentIndex];
      const ext = path.extname(file).slice(1);
      const lang = getLangFromExt(ext);
      if (!lang) continue; // пропускаем неподдерживаемые файлы

      try {
        const text = await fs.readFile(file, 'utf8');
        const minified = minifyText(lang, text);
        const relativePath = path.relative(targetDir, file);
        results[currentIndex] = `// File: ${relativePath}\n${minified}`;
      } catch (e) {
        // игнорируем ошибки чтения
        results[currentIndex] = '';
      }
    }
  }

  await Promise.all(Array(concurrency).fill(null).map(worker));

  // Вывод объединённого текста в stdout
  console.log(results.filter(Boolean).join('\n'));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
