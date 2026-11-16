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

var NON_PRODUCT_TITLE_RE = /^(new\s*catalog|aviso\s+importante|important\s+notice|payment|about\s+price|about\s+us|shipment|shipping|size\s+chart|size\s+table|notice|whatsapp|contact|how\s+to\s+order|catalog)\b/i;
var DIVIDER_EXACT_RE = /^(women|video|size\s+table|adult\/kid\s+kits?|player\s+version|retro\s+shirt|training\s+wear|adult\/kid\s+socks)$/i;

var PLACEHOLDER_LOCKED_RE = /^(?:加密相册|加密|liver[-_\s]*paal|juva[-_\s]*ntus|roma)$/i;

function isNonProductRaw(raw, excludedIds) {
  if (!raw || !raw.id || !raw.cover) return true;
  if (excludedIds && excludedIds[String(raw.id)]) return true;
  var title = String(raw.title || '').trim();
  if (!title) return true;
  if ((raw.encrypted || /加密相册|加密/.test(title)) && !raw.allowEncrypted) return true;
  if (/\u26bd/.test(title)) return true;
  if (NON_PRODUCT_TITLE_RE.test(title) || DIVIDER_EXACT_RE.test(title)) return true;
  if (/\b(?:world\s+cup|league|club)\s+patch(?:es)?$/i.test(title)) return true;
  return false;
}

var LOCKED_CLUB_SUBCATEGORIES = [
  { source: 'minkang', catId: '720293', isSubCate: true, team: 'Liverpool', league: 'Premier League' },
  { source: 'minkang', catId: '724785', isSubCate: true, team: 'Juventus', league: 'Serie A' },
  { source: 'minkang', catId: '724793', isSubCate: true, team: 'Roma', league: 'Serie A' },
  { source: 'gxgfootball', catId: '818835', isSubCate: true, team: 'Liverpool', league: 'Premier League', typeOverride: 'jersey', customOverride: true },
  { source: 'gxgfootball', catId: '818836', isSubCate: true, team: 'Juventus', league: 'Serie A', typeOverride: 'jersey', customOverride: true },
  { source: 'gxg', catId: '5332886', isSubCate: false, team: 'Liverpool', league: 'Premier League', collection: 'primavera-invierno', department: 'training', typeOverride: 'training', customOverride: false },
  { source: 'gxg', catId: '5332888', isSubCate: false, team: 'Juventus', league: 'Serie A', collection: 'primavera-invierno', department: 'training', typeOverride: 'training', customOverride: false }
];

function mapLockedGxgVariant(rawTitle, team) {
  var clean = String(rawTitle || '').split('/')[0].trim();
  var specs = [
    { re: /\bkids?\b.*\bshort\s+sleeve\b/i, sub: 'Niños · Manga corta + pantalón corto', audience: 'kids', size: '16-28', label: 'Conjunto Niño Manga Corta + Pantalón Corto' },
    { re: /\bkids?\b.*\bhalf\s*zip\b/i, sub: 'Niños · Media cremallera + pantalón largo', audience: 'kids', size: '16-28', label: 'Chándal Niño Media Cremallera + Pantalón Largo' },
    { re: /\bkids?\b.*\blong\s*zip\b/i, sub: 'Niños · Cremallera completa + pantalón largo', audience: 'kids', size: '16-28', label: 'Chándal Niño Cremallera Completa + Pantalón Largo' },
    { re: /\bkids?\b.*\bhoodie\b/i, sub: 'Niños · Con capucha + pantalón largo', audience: 'kids', size: '16-28', label: 'Chándal Niño con Capucha + Pantalón Largo' },
    { re: /\bvest\b.*\bshorts\b/i, sub: 'Chaleco + pantalón corto', audience: 'adult', size: 'S-2XL', label: 'Entrenamiento Chaleco + Pantalón Corto' },
    { re: /\bshort\s+sleeve\b.*\bshorts\b/i, sub: 'Manga corta + pantalón corto', audience: 'adult', size: 'S-2XL', label: 'Entrenamiento Manga Corta + Pantalón Corto' },
    { re: /\bpolo\b.*\blong\s+pants\b/i, sub: 'Polo + pantalón largo', audience: 'adult', size: 'S-2XL', label: 'Chándal Polo + Pantalón Largo' },
    { re: /\bhalf\s*zip\b.*\blong\s+pants\b/i, sub: 'Media cremallera + pantalón largo', audience: 'adult', size: 'S-2XL', label: 'Chándal Media Cremallera + Pantalón Largo' },
    { re: /\blong\s*zip\b.*\blong\s+pants\b/i, sub: 'Cremallera completa + pantalón largo', audience: 'adult', size: 'S-2XL', label: 'Chándal Cremallera Completa + Pantalón Largo' },
    { re: /\bhoodie\b.*\blong\s+pants\b/i, sub: 'Con capucha + pantalón largo', audience: 'adult', size: 'S-2XL', label: 'Chándal con Capucha + Pantalón Largo' }
  ];
  for (var i = 0; i < specs.length; i++) {
    if (specs[i].re.test(clean)) {
      return {
        subcategory: specs[i].sub,
        audience: specs[i].audience,
        title: team + ' · ' + specs[i].label + ' ' + specs[i].size
      };
    }
  }
  return null;
}

async function fetchLockedClubSubcategory(entry) {
  var srcCfg = yupoo.SOURCES[entry.source];
  if (!srcCfg) return [];
  var suffix = entry.isSubCate ? '?isSubCate=true' : '';
  var baseUrl = srcCfg.base + '/categories/' + entry.catId + suffix;
  var sep = suffix ? '&' : '?';
  var reqOpts = { timeout: 35000, headers: { 'Referer': srcCfg.referer } };
  var firstHtml = await yupoo.fetchWithRetries(baseUrl, reqOpts, 2);
  var totalPages = yupoo.parsePageCount(firstHtml);
  var raw = yupoo.parseListing(firstHtml);
  for (var p = 2; p <= totalPages; p++) {
    var html = await yupoo.fetchWithRetries(baseUrl + sep + 'page=' + p, reqOpts, 2);
    raw = raw.concat(yupoo.parseListing(html));
  }
  return raw.map(function (item) {
    var rawTitle = String(item.title || '').trim();
    var isEncrypted = !!(item.encrypted || /加密相册|加密/.test(rawTitle));
    var out = Object.assign({}, item, {
      source: entry.source,
      teamOverride: entry.team,
      leagueOverride: entry.league
    });
    if (entry.collection) out.collection = entry.collection;
    if (entry.department) out.department = entry.department;

    if (entry.source === 'gxg') {
      var mapped = mapLockedGxgVariant(rawTitle, entry.team);
      if (mapped) {
        out.title = mapped.title;
        out.subcategory = mapped.subcategory;
        out.audience = mapped.audience;
      } else {
        out.subcategory = entry.team + ' · Entrenamiento';
        out.title = entry.team + ' · Entrenamiento catálogo #' + item.id;
      }
      out.typeOverride = 'training';
      out.customOverride = false;
      out.allowEncrypted = true;
      out.encrypted = isEncrypted;
      return out;
    }

    if (isEncrypted) {
      out.allowEncrypted = true;
      out.encrypted = true;
      if (!rawTitle || PLACEHOLDER_LOCKED_RE.test(rawTitle)) {
        out.title = entry.team + ' · Equipación catálogo #' + item.id;
        if (entry.typeOverride) out.typeOverride = entry.typeOverride;
        if (entry.customOverride !== undefined) out.customOverride = entry.customOverride;
      } else {
        out.title = rawTitle;
      }
    } else {
      if (entry.typeOverride) out.typeOverride = entry.typeOverride;
      if (entry.customOverride !== undefined) out.customOverride = entry.customOverride;
    }
    return out;
  });
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

async function fetchGxgFootball(baseProgressPages, pageLimit) {
  var base = yupoo.SOURCES.gxgfootball.base;
  var requestOptions = { timeout: 35000, headers: { 'Referer': yupoo.SOURCES.gxgfootball.referer } };
  var excludedIds = {};

  try {
    var aboutHtml = await yupoo.fetchWithRetries(base + '/categories/5152610', requestOptions, 2);
    yupoo.parseListing(aboutHtml).forEach(function (item) {
      if (item && item.id) excludedIds[String(item.id)] = true;
    });
  } catch (err) {
    log('Aviso GXGFootball About us:', err.message);
  }

  var firstUrl = base + '/albums?tab=gallery&page=1';
  var firstHtml = await yupoo.fetchWithRetries(firstUrl, requestOptions, 3);
  var totalPages = yupoo.parsePageCount(firstHtml);
  if (pageLimit) totalPages = Math.min(totalPages, pageLimit);
  state.totalPages = baseProgressPages + totalPages + GXG_CATEGORIES.length;
  log('GXGFootball páginas detectadas:', totalPages);

  var rows = yupoo.parseListing(firstHtml).filter(function (item) {
    return !isNonProductRaw(item, excludedIds);
  }).map(function (item) {
    item.source = 'gxgfootball';
    return item;
  });

  state.page = baseProgressPages + 1;
  state.items += rows.length;

  var pages = [];
  for (var p = 2; p <= totalPages; p++) pages.push(p);

  await mapLimit(pages, 3, async function (page) {
    var url = base + '/albums?tab=gallery&page=' + page;
    try {
      var html = await yupoo.fetchWithRetries(url, requestOptions, 3);
      var pageItems = yupoo.parseListing(html).filter(function (item) {
        return !isNonProductRaw(item, excludedIds);
      }).map(function (item) {
        item.source = 'gxgfootball';
        return item;
      });
      rows = rows.concat(pageItems);
      state.page = baseProgressPages + page;
      state.items += pageItems.length;
      if (page % 5 === 0 || page === totalPages) {
        log('GXGFootball página', page + '/' + totalPages, '·', rows.length, 'prendas');
      }
    } catch (err) {
      log('ERROR en GXGFootball página', page + ':', err.message);
    }
  });

  return { rows: rows, pages: totalPages };
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
  var pageLimit = pageArg ? (parseInt(pageArg.split('=')[1], 10) || 0) : (options.pages || 0);

  try {
    log('Descargando portada del catálogo…');
    var firstHtml = await yupoo.fetchWithRetries(yupoo.BASE + '/categories/712891?page=1');
    var totalPages = yupoo.parsePageCount(firstHtml);
    if (pageLimit) totalPages = Math.min(totalPages, pageLimit);
    state.totalPages = totalPages + GXG_CATEGORIES.length;
    log('Páginas detectadas (Minkang):', totalPages);

    var sidebar = yupoo.parseSidebar(firstHtml);
    log('Equipos en el menú de Yupoo:', sidebar.length);

    function tagMinkangRaw(item) {
      item.source = 'minkang';
      if (item.encrypted && item.title && !PLACEHOLDER_LOCKED_RE.test(item.title.trim())) {
        item.allowEncrypted = true;
      }
      return item;
    }

    var allRaw = yupoo.parseListing(firstHtml).map(tagMinkangRaw);
    state.page = 1;
    state.items = allRaw.length;

    var pages = [];
    for (var p = 2; p <= totalPages; p++) pages.push(p);

    await mapLimit(pages, 3, async function (page) {
      var url = yupoo.BASE + '/categories/712891?page=' + page;
      try {
        var html = await yupoo.fetchWithRetries(url, { timeout: 35000 }, 3);
        var items = yupoo.parseListing(html).map(tagMinkangRaw);
        allRaw = allRaw.concat(items);
        state.page = page;
        state.items = allRaw.length;
        if (page % 5 === 0 || page === totalPages) {
          log('Minkang página', page + '/' + totalPages, '·', allRaw.length, 'prendas');
        }
      } catch (err) {
        log('ERROR en la página', page + ':', err.message);
      }
    });

    var gxgFootballPages = 0;
    try {
      var gxgfRes = await fetchGxgFootball(totalPages, pageLimit);
      gxgFootballPages = gxgfRes.pages;
      allRaw = allRaw.concat(gxgfRes.rows);
      log('GXGFootball descargado:', gxgfRes.rows.length, 'prendas válidas');
    } catch (err) {
      log('ERROR general en GXGFootball:', err.message);
    }

    var gxgBase = yupoo.SOURCES.gxg.base;
    var gxgRows = await mapLimit(GXG_CATEGORIES, 2, async function (category, index) {
      try {
        var rows = await fetchCategory(gxgBase, category);
        log('GXG', category.subcategory, '·', rows.length, 'prendas');
        state.page = totalPages + gxgFootballPages + index + 1;
        state.items += rows.length;
        return rows;
      } catch (err) {
        log('ERROR en GXG', category.subcategory + ':', err.message);
        return [];
      }
    });
    gxgRows.forEach(function (rows) { allRaw = allRaw.concat(rows); });

    var lockedRows = await mapLimit(LOCKED_CLUB_SUBCATEGORIES, 2, async function (entry) {
      try {
        var rows = await fetchLockedClubSubcategory(entry);
        var encRows = rows.filter(function (r) { return r.encrypted; }).length;
        if (encRows) log('Subcategoría club (' + entry.source + ' · ' + entry.team + '):', rows.length, 'prendas (' + encRows + ' recuperadas de catálogo protegido)');
        return rows;
      } catch (err) {
        log('Aviso subcategoría ' + entry.team + ' (' + entry.source + '):', err.message);
        return [];
      }
    });
    lockedRows.forEach(function (rows) { allRaw = allRaw.concat(rows); });

    state.phase = 'parsing';
    var resolver = parser.buildResolver(sidebar);
    var seen = {};
    var seenFp = {};
    var dedupCrossCount = 0;
    var dedupSamples = [];
    var items = [];

    allRaw.forEach(function (raw) {
      var src = String(raw.source || 'minkang');
      var itemKey = src + ':' + String(raw.id || '');
      if (!raw.id || seen[itemKey]) return;
      if (isNonProductRaw(raw)) return;
      seen[itemKey] = true;
      try {
        var itemRaw = Object.assign({}, raw);
        if (src === 'gxg') { itemRaw.albumId = String(raw.id); itemRaw.id = 'gxg-' + raw.id; }
        else if (src === 'gxgfootball') { itemRaw.albumId = String(raw.id); itemRaw.id = 'gxgf-' + raw.id; }

        var parsed = parser.parseItem(itemRaw, resolver);
        if (!parsed.team || parsed.team === 'Catalog') return;

        var fp = parsed.collection === 'primavera-invierno' ? '' : parser.dedupFingerprint(parsed);
        if (fp) {
          if (seenFp[fp]) {
            if (seenFp[fp].source !== parsed.source) {
              dedupCrossCount += 1;
              if (dedupSamples.length < 8) {
                dedupSamples.push('[' + seenFp[fp].source + '] "' + seenFp[fp].title + '" == [' + parsed.source + '] "' + parsed.title + '"');
              }
              return;
            }
          } else {
            seenFp[fp] = parsed;
          }
        }

        items.push(parsed);
      } catch (err) {
        log('ERROR al procesar', raw.id, err.message);
      }
    });

    items.sort(function (a, b) {
      var aGxg = a.source === 'gxg' ? 1 : 0;
      var bGxg = b.source === 'gxg' ? 1 : 0;
      if (aGxg !== bGxg) return aGxg - bGxg;
      var aNum = Number(a.albumId || a.id);
      var bNum = Number(b.albumId || b.id);
      if (isFinite(aNum) && isFinite(bNum) && aNum !== bNum) return bNum - aNum;
      return String(b.id).localeCompare(String(a.id));
    });

    var previous = null;
    try { previous = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8')); } catch (e) {}

    if (!items.length && previous && Array.isArray(previous.items) && previous.items.length) {
      throw new Error('La sincronización devolvió 0 prendas; se conserva el catálogo anterior.');
    }

    var bySource = {};
    items.forEach(function (it) {
      bySource[it.source] = (bySource[it.source] || 0) + 1;
    });

    var catalog = {
      meta: {
        generatedAt: new Date().toISOString(),
        source: 'https://minkang.x.yupoo.com/categories/712891',
        sources: [
          'https://minkang.x.yupoo.com/categories/712891',
          'https://gxgfootball.x.yupoo.com/albums?tab=gallery',
          'https://gxgtrainingwear.x.yupoo.com/albums'
        ],
        store: 'KANG Team Official',
        total: items.length,
        pages: totalPages,
        gxgFootballPages: gxgFootballPages,
        deduplicated: dedupCrossCount,
        bySource: bySource
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
    log('Por proveedor:', JSON.stringify(bySource), '· Duplicados entre proveedores omitidos:', dedupCrossCount);
    if (dedupSamples.length) {
      log('Ejemplos deduplicados:', dedupSamples.slice(0, 4).join(' || '));
    }
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
