'use strict';

/** Decodifica las entidades HTML más habituales en los títulos de Yupoo. */
function decodeEntities(input) {
  return String(input || '')
    .replace(/&#x([0-9a-f]+);/gi, function (_, hex) {
      try { return String.fromCodePoint(parseInt(hex, 16)); } catch (e) { return ''; }
    })
    .replace(/&#(\d+);/g, function (_, dec) {
      try { return String.fromCodePoint(parseInt(dec, 10)); } catch (e) { return ''; }
    })
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

/** Texto normalizado para búsquedas y comparaciones (sin acentos ni signos). */
function normalizeText(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘`´]/g, "'")
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Clave de equipo estable. */
function teamKey(name) {
  return normalizeText(name)
    .replace(/\b(fc|cf|sc|afc|cd|club|de|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Limpia espacios y caracteres de control. */
function cleanText(input) {
  return decodeEntities(input)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Convierte un nombre a un slug para URLs. */
function slugify(input) {
  return normalizeText(input).replace(/\s+/g, '-');
}

/** Escribe un JSON de forma atómica (tmp + rename). */
function writeJsonAtomic(file, data) {
  const fs = require('fs');
  const path = require('path');
  const tmp = file + '.tmp-' + process.pid;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(data), 'utf8');
  fs.renameSync(tmp, file);
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

/** Lee .env sin dependencias externas. */
function loadEnv(file) {
  const fs = require('fs');
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.charAt(0) === '#') continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') ||
        (value.charAt(0) === "'" && value.charAt(value.length - 1) === "'")) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

module.exports = {
  decodeEntities: decodeEntities,
  normalizeText: normalizeText,
  teamKey: teamKey,
  cleanText: cleanText,
  slugify: slugify,
  writeJsonAtomic: writeJsonAtomic,
  sleep: sleep,
  loadEnv: loadEnv
};
