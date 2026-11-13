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

    var allRaw = yupoo.parseListing(firstHtml);
    state.page = 1;
    state.items = allRaw.length;

    var pages = [];
    for (var p = 2; p <= totalPages; p++) pages.push(p);

    await mapLimit(pages, 3, async function (page) {
      var url = yupoo.BASE + '/categories/712891?page=' + page;
      try {
        var html = await yupoo.fetchWithRetries(url, { timeout: 35000 }, 3);
        var items = yupoo.parseListing(html);
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

    state.phase = 'parsing';
    var resolver = parser.buildResolver(sidebar);
    var seen = {};
    var items = [];

    allRaw.forEach(function (raw) {
      if (!raw.id || seen[raw.id]) return;
      if (/加密相册|加密/.test(raw.title)) return; // álbumes privados sin datos
      if (!raw.cover) return;
      seen[raw.id] = true;
      try {
        items.push(parser.parseItem(raw, resolver));
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
