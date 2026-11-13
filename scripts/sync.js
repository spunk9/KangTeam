'use strict';

var fs = require('fs');
var path = require('path');
var util = require('../lib/util');
var yupoo = require('../lib/yupoo');
var parser = require('../lib/parse');

util.loadEnv(path.join(__dirname, '..', '.env'));

var ROOT = path.join(__dirname, '..');
var DATA_DIR = path.join(ROOT, 'data');
var CATALOG_FILE = path.join(DATA_DIR, 'catalog.json');

var args = process.argv.slice(2);
var force = args.indexOf('--force') !== -1;
var pageArg = args.filter(function (a) { return a.indexOf('--pages=') === 0; })[0];

var state = {
  running: false,
  phase: 'idle',
  page: 0,
  totalPages: 0,
  items: 0,
  startedAt: null,
  finishedAt: null,
  error: null,
  lastSync: null
};

function log() {
  var parts = Array.prototype.slice.call(arguments);
  console.log('[' + new Date().toISOString().slice(11, 19) + '] ' + parts.join(' '));
}

async function mapLimit(list, limit, worker) {
  var results = new Array(list.length);
  var next = 0;
  async function run() {
    while (next < list.length) {
      var index = next++;
      results[index] = await worker(list[index], index);
      await util.sleep(120);
    }
  }
  var workers = [];
  for (var i = 0; i < Math.min(limit, list.length); i++) workers.push(run());
  await Promise.all(workers);
  return results;
}

var GXG_CATEGORIES = [
  { id: '994258', parent: '5332912', audience: 'adult', department: 'training', subcategory: 'Chaleco + pantalón corto' },
  { id: '994257', parent: '5332912', audience: 'adult', department: 'training', subcategory: 'Manga corta + pantalón corto' },
  { id: '994259', parent: '5332912', audience: 'adult', department: 'training', subcategory: 'Polo + pantalón largo' },
  { id: '994254', parent: '5332912', audience: 'adult', department: 'training', subcategory: 'Media cremallera + pantalón largo' },
  { id: '994255', parent: '5332912', audience: 'adult', department: 'training', subcategory: 'Cremallera completa + pantalón largo' },
  { id: '994256', parent: '5332912', audience: 'adult', department: 'training', subcategory: 'Con capucha + pantalón largo' },
  { id: '996377', parent: '5332913', audience: 'kids', department: 'training', subcategory: 'Niños · Manga corta + pantalón corto' },
  { id: '994250', parent: '5332913', audience: 'kids', department: 'training', subcategory: 'Niños · Media cremallera + pantalón largo' },
  { id: '994251', parent: '5332913', audience: 'kids', department: 'training', subcategory: 'Niños · Cremallera completa + pantalón largo' },
  { id: '994252', parent: '5332913', audience: 'kids', department: 'training', subcategory: 'Niños · Con capucha + pantalón largo' },
  { id: '5332918', parent: 'albums', audience: 'adult', department: 'training', subcategory: 'Entrenamiento sin escudo', type: 'training' },
  { id: '5332915', parent: 'albums', audience: 'adult', department: 'walk', subcategory: 'Cortavientos', type: 'jacket' },
  { id: '5380167', parent: 'albums', audience: 'adult', department: 'walk', subcategory: 'Chaqueta softshell', type: 'jacket' },
  { id: '5385471', parent: 'albums', audience: 'adult', department: 'walk', subcategory: 'Sudadera', type: 'hoodie' },
  { id: '5374107', parent: 'albums', audience: 'adult', department: 'walk', subcategory: 'Chaleco acolchado', type: 'jacket' },
  { id: '5373314', parent: 'albums', audience: 'adult', department: 'walk', subcategory: 'Chaqueta acolchada', type: 'jacket' }
];

async function fetchCategory(base, category) {
  var referer = category.parent === 'albums' ? base + '/albums' : base + '/categories/' + category.parent;
  var suffix = category.subcategory.indexOf('Niños') === 0 || category.id.match(/^9942(5[0-9])$/) || /^99[0-9]{4}$/.test(category.id)
    ? '?isSubCate=true' : '';
  // IDs of nested filters are requested with Yupoo's subcategory flag.
  if (category.id === '5332918' || category.id === '5332915' || category.id === '5380167' ||
      category.id === '5385471' || category.id === '5374107' || category.id === '5373314') suffix = '';
  var requestOptions = { timeout: 35000, headers: { 'Referer': referer } };
  var url = base + '/categories/' + category.id + suffix;
  var firstHtml = await yupoo.fetchWithRetries(url, requestOptions, 3);
  var totalPages = yupoo.parsePageCount(firstHtml);
  if (pageArg) totalPages = Math.min(totalPages, parseInt(pageArg.split('=')[1], 10) || totalPages);
  var raw = yupoo.parseListing(firstHtml);
  var pages = [];
  for (var p = 2; p <= totalPages; p++) pages.push(p);

  var pageResults = await mapLimit(pages, 3, async function (page) {
    var separator = suffix ? '&' : '?';
    var pageHtml = await yupoo.fetchWithRetries(url + separator + 'page=' + page, requestOptions, 3);
    return yupoo.parseListing(pageHtml);
  });
  pageResults.forEach(function (items) { raw = raw.concat(items); });
  return raw.map(function (item) {
    return Object.assign(item, {
      source: 'gxg',
      collection: 'primavera-invierno',
      department: category.department,
      subcategory: category.subcategory,
      audience: category.audience,
      typeOverride: category.type || 'training',
      customOverride: false
    });
  });
}

async function runSync(options) {
  options = options || {};
  if (state.running) return state;

  state.running = true;
  state.phase = 'listing';
  state.startedAt = new Date().toISOString();
  state.finishedAt = null;
  state.error = null;
  state.page = 0;
  state.items = 0;

  var started = Date.now();

  try {
    log('Descargando portada del catálogo…');
    var firstHtml = await yupoo.fetchWithRetries(yupoo.BASE + '/categories/712891?page=1');
    var totalPages = yupoo.parsePageCount(firstHtml);
    if (pageArg) totalPages = Math.min(totalPages, parseInt(pageArg.split('=')[1], 10) || totalPages);
    state.totalPages = totalPages;
    log('Páginas detectadas:', totalPages);

    var sidebar = yupoo.parseSidebar(firstHtml);
    log('Equipos en el menú de Yupoo:', sidebar.length);

    var allRaw = yupoo.parseListing(firstHtml).map(function (item) {
      item.source = 'minkang';
      return item;
    });
    state.page = 1;
    state.items = allRaw.length;

    var pages = [];
    for (var p = 2; p <= totalPages; p++) pages.push(p);

    await mapLimit(pages, 3, async function (page) {
      var url = yupoo.BASE + '/categories/712891?page=' + page;
      try {
        var html = await yupoo.fetchWithRetries(url, { timeout: 35000 }, 3);
        var items = yupoo.parseListing(html).map(function (item) {
          item.source = 'minkang';
          return item;
        });
        allRaw = allRaw.concat(items);
        state.page = page;
        state.items = allRaw.length;
        if (page % 5 === 0 || page === totalPages) {
          log('Página', page + '/' + totalPages, '·', allRaw.length, 'prendas');
        }
      } catch (err) {
        log('ERROR en la página', page + ':', err.message);
      }
    });

    var gxgBase = yupoo.SOURCES.gxg.base;
    var gxgRows = await mapLimit(GXG_CATEGORIES, 2, async function (category, index) {
      try {
        var rows = await fetchCategory(gxgBase, category);
        log('GXG', category.subcategory, '·', rows.length, 'prendas');
        state.page = totalPages + index + 1;
        state.items += rows.length;
        return rows;
      } catch (err) {
        log('ERROR en GXG', category.subcategory + ':', err.message);
        return [];
      }
    });
    gxgRows.forEach(function (rows) { allRaw = allRaw.concat(rows); });

    state.phase = 'parsing';
    var resolver = parser.buildResolver(sidebar);
    var seen = {};
    var items = [];

    allRaw.forEach(function (raw) {
      var itemKey = String(raw.source || 'minkang') + ':' + String(raw.id || '');
      if (!raw.id || seen[itemKey]) return;
      if (/加密相册|加密/.test(raw.title)) return; // álbumes privados sin datos
      if (!raw.cover) return;
      seen[itemKey] = true;
      try {
        var itemRaw = Object.assign({}, raw);
        if (raw.source === 'gxg') { itemRaw.albumId = String(raw.id); itemRaw.id = 'gxg-' + raw.id; }
        items.push(parser.parseItem(itemRaw, resolver));
      } catch (err) {
        log('ERROR al procesar', raw.id, err.message);
      }
    });

    items.sort(function (a, b) {
      return Number(b.id) - Number(a.id);
    });

    var previous = null;
    try { previous = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8')); } catch (e) {}

    var catalog = {
      meta: {
        generatedAt: new Date().toISOString(),
      source: 'https://minkang.x.yupoo.com/categories/712891',
      sources: ['https://minkang.x.yupoo.com/categories/712891', 'https://gxgtrainingwear.x.yupoo.com/albums'],
        store: 'KANG Team Official',
        total: items.length,
        pages: totalPages
      },
      items: items
    };

    util.writeJsonAtomic(CATALOG_FILE, catalog);

    // Estadísticas útiles para la consola.
    var byTeam = {};
    var bySeason = {};
    var otros = 0;
    items.forEach(function (item) {
      byTeam[item.team] = (byTeam[item.team] || 0) + 1;
      bySeason[item.season] = (bySeason[item.season] || 0) + 1;
      if (item.team === 'Otros') otros++;
    });
    var topTeams = Object.keys(byTeam).sort(function (a, b) { return byTeam[b] - byTeam[a]; }).slice(0, 12);

    state.phase = 'done';
    state.finishedAt = new Date().toISOString();
    state.items = items.length;
    state.lastSync = catalog.meta.generatedAt;
    state.running = false;

    log('✔ Catálogo guardado:', items.length, 'prendas ·', Object.keys(byTeam).length, 'equipos ·', Object.keys(bySeason).length, 'temporadas');
    log('Sin equipo reconocido:', otros, '(' + (otros / Math.max(items.length, 1) * 100).toFixed(1) + '%)');
    log('Top equipos:', topTeams.map(function (t) { return t + ' (' + byTeam[t] + ')'; }).join(', '));
    log('Tiempo:', ((Date.now() - started) / 1000).toFixed(1) + 's');

    if (previous && previous.meta) {
      log('Anterior:', previous.meta.total, 'prendas ·', previous.meta.generatedAt);
    }

    return state;
  } catch (err) {
    state.running = false;
    state.phase = 'error';
    state.error = err.message;
    state.finishedAt = new Date().toISOString();
    log('✘ Error:', err.stack || err.message);
    throw err;
  }
}

module.exports = {
  runSync: runSync,
  state: state,
  CATALOG_FILE: CATALOG_FILE
};

if (require.main === module) {
  runSync({ force: force }).catch(function () {
    process.exitCode = 1;
  });
}
