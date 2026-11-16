'use strict';

var fs = require('fs');
var path = require('path');
var os = require('os');
var http = require('http');
var childProcess = require('child_process');
var pricing = require('../public/js/pricing');
var parser = require('../lib/parse');

var ROOT = path.resolve(__dirname, '..');
var PUBLIC_DIR = path.join(ROOT, 'public');
var ORDERS_DIR = path.join(ROOT, 'data', 'orders');
var TEST_PORT = parseInt(process.env.QA_PORT || '3198', 10);
var CDP_PORT = parseInt(process.env.QA_CDP_PORT || '9298', 10);

var stats = { passed: 0, failed: 0, warned: 0 };
var failures = [];
var warnings = [];

function section(title) {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  ' + title);
  console.log('══════════════════════════════════════════════════════════════');
}

function pass(msg) {
  stats.passed += 1;
  console.log('  [PASS] ' + msg);
}

function warn(msg) {
  stats.warned += 1;
  warnings.push(msg);
  console.log('  [WARN] ' + msg);
}

function fail(msg, detail) {
  stats.failed += 1;
  var full = detail ? (msg + ' (' + detail + ')') : msg;
  failures.push(full);
  console.log('  [FAIL] ' + full);
}

function assert(cond, msg, detail) {
  if (cond) pass(msg);
  else fail(msg, detail);
}

function readUtf8(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function checkSyntax(relPath) {
  var abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) {
    warn('Archivo opcional no encontrado para syntax check: ' + relPath);
    return;
  }
  var res = childProcess.spawnSync(process.execPath, ['--check', abs], { encoding: 'utf8' });
  assert(res.status === 0, 'Sintaxis JS válida: ' + relPath, (res.stderr || '').trim());
}

function checkJson(relPath, validator) {
  try {
    var parsed = JSON.parse(readUtf8(relPath));
    assert(true, 'JSON válido: ' + relPath);
    if (validator) validator(parsed);
    return parsed;
  } catch (err) {
    fail('JSON válido: ' + relPath, err.message);
    return null;
  }
}

function httpRequest(port, method, reqPath, bodyObj, headers) {
  return new Promise(function (resolve, reject) {
    var payload = bodyObj !== undefined && bodyObj !== null ? Buffer.from(JSON.stringify(bodyObj), 'utf8') : null;
    var reqHeaders = Object.assign({}, headers || {});
    if (payload) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = payload.length;
    }
    var req = http.request({
      hostname: '127.0.0.1',
      port: port,
      path: reqPath,
      method: method,
      headers: reqHeaders,
      timeout: 8000
    }, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        var buf = Buffer.concat(chunks);
        var text = buf.toString('utf8');
        var json = null;
        try { json = JSON.parse(text); } catch (e) {}
        resolve({ status: res.statusCode, headers: res.headers, text: text, json: json, size: buf.length });
      });
    });
    req.on('timeout', function () { req.destroy(new Error('HTTP timeout en ' + reqPath)); });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function waitForServer(port, timeoutMs) {
  var start = Date.now();
  return new Promise(function (resolve, reject) {
    function ping() {
      httpRequest(port, 'GET', '/api/health').then(function (res) {
        if (res.status === 200) return resolve(res);
        retry();
      }).catch(retry);
    }
    function retry(err) {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error('El servidor QA no respondió a tiempo en el puerto ' + port + (err ? ': ' + err.message : '')));
      }
      setTimeout(ping, 120);
    }
    ping();
  });
}

function snapshotOrdersDir() {
  var existed = fs.existsSync(ORDERS_DIR);
  var files = {};
  if (existed) {
    fs.readdirSync(ORDERS_DIR).forEach(function (name) {
      var full = path.join(ORDERS_DIR, name);
      if (fs.statSync(full).isFile()) {
        files[name] = fs.readFileSync(full);
      }
    });
  }
  return { existed: existed, files: files };
}

function restoreOrdersDir(snapshot) {
  if (!snapshot) return;
  if (!snapshot.existed) {
    if (fs.existsSync(ORDERS_DIR)) {
      fs.rmSync(ORDERS_DIR, { recursive: true, force: true });
    }
    return;
  }
  if (!fs.existsSync(ORDERS_DIR)) fs.mkdirSync(ORDERS_DIR, { recursive: true });
  fs.readdirSync(ORDERS_DIR).forEach(function (name) {
    var full = path.join(ORDERS_DIR, name);
    if (!fs.statSync(full).isFile()) return;
    if (!Object.prototype.hasOwnProperty.call(snapshot.files, name)) {
      fs.unlinkSync(full);
    }
  });
  Object.keys(snapshot.files).forEach(function (name) {
    fs.writeFileSync(path.join(ORDERS_DIR, name), snapshot.files[name]);
  });
}

function findHeadlessChromium() {
  var candidates = [
    process.env.QA_CHROME_BIN || '',
    '/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome'
  ].filter(Boolean);
  for (var i = 0; i < candidates.length; i++) {
    if (fs.existsSync(candidates[i])) return candidates[i];
  }
  try {
    if (fs.existsSync('/ms-playwright')) {
      var dirs = fs.readdirSync('/ms-playwright');
      for (var d = 0; d < dirs.length; d++) {
        var shellBin = path.join('/ms-playwright', dirs[d], 'chrome-headless-shell-linux64', 'chrome-headless-shell');
        if (fs.existsSync(shellBin)) return shellBin;
      }
    }
  } catch (e) {}
  return '';
}

async function waitForCdpTarget(cdpPort, timeoutMs) {
  var start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      var res = await httpRequest(cdpPort, 'GET', '/json/list');
      if (res.status === 200 && Array.isArray(res.json)) {
        var page = res.json.find(function (t) { return t.type === 'page' && t.webSocketDebuggerUrl; });
        if (page) return page.webSocketDebuggerUrl;
      }
    } catch (e) {}
    await sleep(120);
  }
  throw new Error('CDP no expuso una pestaña en el puerto ' + cdpPort);
}

function connectCdp(wsUrl) {
  return new Promise(function (resolve, reject) {
    var ws = new WebSocket(wsUrl);
    var nextId = 1;
    var pending = new Map();
    var runtimeExceptions = [];

    ws.addEventListener('open', function () {
      function send(method, params) {
        return new Promise(function (resFn, rejFn) {
          var id = nextId++;
          pending.set(id, { resolve: resFn, reject: rejFn });
          ws.send(JSON.stringify({ id: id, method: method, params: params || {} }));
        });
      }
      async function evalJs(expr) {
        var r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (r && r.exceptionDetails) {
          throw new Error((r.exceptionDetails.text || 'JS eval error') + ': ' + JSON.stringify(r.exceptionDetails));
        }
        return r && r.result ? r.result.value : undefined;
      }
      async function waitUntil(expr, timeoutMs) {
        var t0 = Date.now();
        while (Date.now() - t0 < (timeoutMs || 6000)) {
          var ok = await evalJs('Boolean(' + expr + ')');
          if (ok) return true;
          await sleep(100);
        }
        return false;
      }
      resolve({
        ws: ws,
        send: send,
        evalJs: evalJs,
        waitUntil: waitUntil,
        runtimeExceptions: runtimeExceptions,
        close: function () { try { ws.close(); } catch (e) {} }
      });
    });

    ws.addEventListener('message', function (ev) {
      var msg;
      try { msg = JSON.parse(String(ev.data)); } catch (e) { return; }
      if (msg.id && pending.has(msg.id)) {
        var p = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message || 'CDP error'));
        else p.resolve(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        var desc = (msg.params && msg.params.exceptionDetails && msg.params.exceptionDetails.exception && msg.params.exceptionDetails.exception.description) ||
          (msg.params && msg.params.exceptionDetails && msg.params.exceptionDetails.text) || 'Excepción JS';
        runtimeExceptions.push(desc);
      }
    });

    ws.addEventListener('error', function (err) {
      reject(err && err.message ? new Error(err.message) : new Error('Error WebSocket CDP'));
    });
  });
}

async function runStaticSuite() {
  section('SUITE 1 · Integridad Estática, HTML, PWA, SEO y CSS');

  [
    'server.js',
    'lib/logos.js',
    'lib/parse.js',
    'lib/teams.js',
    'lib/util.js',
    'lib/yupoo.js',
    'scripts/sync.js',
    'scripts/qa.js',
    'public/js/app.js',
    'public/js/pricing.js',
    'api/handler.js',
    'api/img.js'
  ].forEach(checkSyntax);

  checkJson('package.json', function (pkg) {
    assert(pkg.scripts && pkg.scripts.build && pkg.scripts.lint && pkg.scripts.qa, 'Scripts build/lint/qa configurados en package.json');
  });

  checkJson('vercel.json', function (v) {
    var sources = (v.rewrites || []).map(function (r) { return r.source; });
    ['/api/promo/validate', '/api/orders/track', '/api/admin/orders', '/api/admin/orders/:id'].forEach(function (route) {
      assert(sources.indexOf(route) !== -1, 'Rewrite presente en vercel.json: ' + route);
    });
  });

  checkJson('public/manifest.webmanifest', function (m) {
    assert(!!(m.name && m.short_name && m.start_url && m.display === 'standalone'), 'Manifest PWA con nombre y modo standalone');
    var icons = Array.isArray(m.icons) ? m.icons : [];
    assert(icons.length >= 2, 'Manifest PWA incluye iconos PNG mínimos (' + icons.length + ')');
    icons.forEach(function (ic) {
      var target = path.join(PUBLIC_DIR, String(ic.src || '').replace(/^\//, ''));
      assert(fs.existsSync(target), 'Icono de manifest existe en public/: ' + ic.src);
    });
  });

  var html = readUtf8('public/index.html');
  var appJs = readUtf8('public/js/app.js');
  var css = readUtf8('public/css/styles.css');
  var swJs = readUtf8('public/sw.js');

  var idCounts = {};
  var htmlIds = new Set();
  for (var m of html.matchAll(/\sid="([^"]+)"/g)) {
    htmlIds.add(m[1]);
    idCounts[m[1]] = (idCounts[m[1]] || 0) + 1;
  }
  var dupIds = Object.keys(idCounts).filter(function (k) { return idCounts[k] > 1; });
  assert(dupIds.length === 0, 'Sin IDs duplicados en public/index.html', dupIds.join(', '));

  var jsCreatedIds = new Set();
  for (var jid of appJs.matchAll(/id=["']([A-Za-z0-9_-]+)["']/g)) {
    jsCreatedIds.add(jid[1]);
  }

  var missingSelectors = [];
  for (var q of appJs.matchAll(/\$\(\s*['"]#([A-Za-z0-9_-]+)['"]\s*\)|getElementById\(\s*['"]([A-Za-z0-9_-]+)['"]\s*\)/g)) {
    var targetId = q[1] || q[2];
    if (!htmlIds.has(targetId) && !jsCreatedIds.has(targetId)) {
      missingSelectors.push(targetId);
    }
  }
  assert(missingSelectors.length === 0, 'Todos los selectores #id de app.js existen en DOM/templates', missingSelectors.join(', '));

  var symbols = new Set();
  for (var sym of html.matchAll(/<symbol\s+[^>]*id="([^"]+)"/g)) symbols.add(sym[1]);
  var missingSymbols = [];
  for (var useMatch of (html + '\n' + appJs).matchAll(/href=["']#(i-[A-Za-z0-9_-]+)["']/g)) {
    if (!symbols.has(useMatch[1]) && missingSymbols.indexOf(useMatch[1]) === -1) {
      missingSymbols.push(useMatch[1]);
    }
  }
  assert(missingSymbols.length === 0, 'Todos los iconos SVG <use href="#i-..."> existen en el sprite', missingSymbols.join(', '));

  var nativeDialogs = appJs.match(/\b(alert|confirm|window\.open)\s*\(/g) || [];
  assert(nativeDialogs.length === 0, 'Cero diálogos nativos bloqueantes (alert/confirm/window.open) en app.js', nativeDialogs.join(', '));

  var inlineHtmlStyles = html.match(/\sstyle=/g) || [];
  assert(inlineHtmlStyles.length === 0, 'Cero atributos style= inline en public/index.html');

  assert(/<link[^>]+rel="manifest"[^>]+manifest\.webmanifest/.test(html), 'Meta link manifest.webmanifest presente en index.html');
  assert(/<link[^>]+rel="apple-touch-icon"/.test(html), 'Meta apple-touch-icon presente en index.html');
  assert(/property="og:image"/.test(html) && /name="twitter:card"/.test(html), 'Etiquetas OpenGraph y Twitter Card presentes');
  assert(/application\/ld\+json/.test(html), 'Datos estructurados Schema.org (JSON-LD) presentes');
  ['public/robots.txt', 'public/sitemap.xml', 'public/og-cover.png', 'public/apple-touch-icon.png'].forEach(function (f) {
    assert(fs.existsSync(path.join(ROOT, f)), 'Archivo SEO/PWA existe: ' + f);
  });

  var swMatch = swJs.match(/SHELL_ASSETS\s*=\s*\[([\s\S]*?)\]/);
  assert(!!swMatch, 'Array SHELL_ASSETS declarado en public/sw.js');
  if (swMatch) {
    var swAssets = [];
    for (var sm of swMatch[1].matchAll(/'([^']+)'/g)) swAssets.push(sm[1]);
    var missingSw = swAssets.filter(function (asset) {
      if (asset === '/') return false;
      return !fs.existsSync(path.join(PUBLIC_DIR, asset.replace(/^\//, '')));
    });
    assert(missingSw.length === 0, 'Todos los SHELL_ASSETS del Service Worker existen en disco', missingSw.join(', '));
  }

  var openBraces = (css.match(/\{/g) || []).length;
  var closeBraces = (css.match(/\}/g) || []).length;
  assert(openBraces === closeBraces && openBraces > 200, 'Llaves CSS balanceadas (' + openBraces + '/' + closeBraces + ')');
  assert(/@media\s*\(\s*max-width:\s*760px\s*\)/.test(css), 'Breakpoint móvil (<= 760px) presente en styles.css');
  assert(/prefers-reduced-motion/.test(css), 'Soporte prefers-reduced-motion en styles.css');
  assert(/\.modal\.pwa-ios-modal/.test(css), 'Corrección CSS de centrado móvil para modal iOS PWA presente');
}

function runPricingSuite() {
  section('SUITE 2 · Motor de Precios y Descuentos Opción A');

  var fanShort = pricing.calculate({ title: 'Real Madrid Home 25/26', type: 'jersey' }, { size: 'M' });
  assert(fanShort.unitPriceCents === 2500, 'Camiseta Fan manga corta = 25,00 € (' + fanShort.unitPriceCents + ')');

  var fanLong = pricing.calculate({ title: 'Arsenal Home 25/26 Long Sleeve', type: 'jersey', flags: ['long'] }, { size: 'L' });
  assert(fanLong.unitPriceCents === 2800 && fanLong.longSleeveCents === 300, 'Camiseta Fan manga larga = 28,00 €');

  var retroCustom = pricing.calculate(
    { title: 'Spain 1994 Retro', type: 'jersey', flags: ['retro'] },
    { size: '3XL', name: 'RAUL', number: '7', patches: 'Liga, Mundial' }
  );
  assert(retroCustom.unitPriceCents === 3600, 'Retro + Nombre/Dorsal + 2 parches + 3XL = 36,00 € (' + retroCustom.unitPriceCents + ')');

  var nbaJersey = pricing.calculate({ title: 'Lakers 24 NBA Basketball Jersey', league: 'NBA', type: 'jersey' }, { size: 'M' });
  assert(nbaJersey.unitPriceCents === 3200, 'Camiseta Baloncesto (NBA) = 32,00 € (' + nbaJersey.unitPriceCents + ')');

  assert(pricing.getVolumeDiscount(4).discountCents === 0, '4 prendas -> 0 € descuento por volumen');
  assert(pricing.getVolumeDiscount(5).discountCents === 500, '5 prendas -> -5,00 € (-1 €/ud)');
  assert(pricing.getVolumeDiscount(10).discountCents === 2000, '10 prendas -> -20,00 € (-2 €/ud)');
  assert(pricing.getVolumeDiscount(15).discountCents === 4500, '15 prendas -> -45,00 € (-3 €/ud)');

  var next3 = pricing.nextVolumeTier(3);
  var next16 = pricing.nextVolumeTier(16);
  assert(next3 && next3.minQty === 5 && next16 === null, 'Progresión nextVolumeTier correcta (3->5, 16->null)');

  var resolver = parser.buildResolver([]);
  var mkBetis = parser.parseItem({ id: '1', source: 'minkang', title: 'Real Betis 26/27 Home Long-Sleeve Jersey S-4XL', cover: 'https://photo.yupoo.com/minkang/abc/small.jpg' }, resolver);
  var gfBetis = parser.parseItem({ id: 'gxgf-2', albumId: '2', source: 'gxgfootball', title: '26/27 Real Betis Home long sleeves S-4XL', cover: 'https://photo.yupoo.com/gxgfootball/def/small.jpg' }, resolver);
  assert(parser.dedupFingerprint(mkBetis) && parser.dedupFingerprint(mkBetis) === parser.dedupFingerprint(gfBetis), 'Deduplicación unifica orden de temporada/manga entre Minkang y GXGFootball');

  var mkPsgThird = parser.parseItem({ id: '3', source: 'minkang', title: 'PSG 26/27 Third Away Black Jersey S-4XL', cover: 'https://photo.yupoo.com/minkang/a1/small.jpg' }, resolver);
  var gfPsgThird = parser.parseItem({ id: 'gxgf-4', albumId: '4', source: 'gxgfootball', title: '26/27 PSG Third Away S-4XL', cover: 'https://photo.yupoo.com/gxgfootball/b1/small.jpg' }, resolver);
  assert(parser.dedupFingerprint(mkPsgThird) === parser.dedupFingerprint(gfPsgThird), 'Deduplicación detecta misma 3ª equipación aunque un proveedor mencione color');

  var gfSpecial = parser.parseItem({ id: 'gxgf-5', albumId: '5', source: 'gxgfootball', title: '26/27 PSG Special Edition player version S-2XL', cover: 'https://photo.yupoo.com/gxgfootball/c1/small.jpg' }, resolver);
  assert(parser.dedupFingerprint(gfSpecial) === '', 'Ediciones especiales sin color ni franja mantienen variantes distintas');
}

async function runBrowserVisualSuite() {
  section('SUITE 5 · Auditoría Visual y Layout en Navegador Real (Desktop + Móvil)');

  var chromeBin = findHeadlessChromium();
  if (!chromeBin || typeof WebSocket !== 'function') {
    warn('Navegador Chromium headless no detectado; se omite auditoría visual en esta máquina.');
    return;
  }

  var tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'kang-qa-chrome-'));
  var chromeProc = childProcess.spawn(chromeBin, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + tmpProfile,
    'about:blank'
  ], { stdio: 'ignore' });

  var cdp = null;
  try {
    var wsUrl = await waitForCdpTarget(CDP_PORT, 10000);
    cdp = await connectCdp(wsUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // Desktop 1280x800
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + TEST_PORT + '/' });
    var loaded = await cdp.waitUntil("document.querySelectorAll('#home-teams .team-card').length > 0", 10000);
    assert(loaded, 'Desktop 1280px: portada e índices de catálogo cargados en navegador real');

    var desktopCheck = await cdp.evalJs("({ overflow: document.documentElement.scrollWidth - window.innerWidth, totalText: (document.querySelector('#stat-total')||{}).textContent || '', spotlightTabs: document.querySelectorAll('[data-spotlight-idx]').length, bentoLead: !!document.querySelector('.season-card.is-lead'), lightBand: !!document.querySelector('.section-light .volume-strip') })");
    assert(desktopCheck && desktopCheck.overflow <= 1, 'Desktop 1280px: sin desbordamiento horizontal en portada (' + (desktopCheck ? desktopCheck.overflow : '?') + 'px)');
    assert(desktopCheck && desktopCheck.spotlightTabs >= 2, 'Desktop 1280px: Hero Matchday Spotlight interactivo renderizado (' + (desktopCheck ? desktopCheck.spotlightTabs : 0) + ' pestañas)');
    assert(desktopCheck && desktopCheck.bentoLead && desktopCheck.lightBand, 'Desktop 1280px: Bento de temporadas y banda clara Ivory con descuentos cargados');

    // Interactive Spotlight tab switch & Home Jersey Studio live preview
    await cdp.evalJs("document.querySelectorAll('[data-spotlight-idx]')[1] && document.querySelectorAll('[data-spotlight-idx]')[1].click()");
    var spotlightSwitched = await cdp.waitUntil("document.querySelectorAll('[data-spotlight-idx]')[1].classList.contains('is-active')", 3000);
    assert(spotlightSwitched, 'Hero Spotlight cambia de prenda destacada al pulsar pestaña');

    await cdp.evalJs("(function(){ var n=document.querySelector('#home-studio-name'); var d=document.querySelector('#home-studio-number'); if(n){ n.value='KANGQA'; n.dispatchEvent(new Event('input',{bubbles:true})); } if(d){ d.value='99'; d.dispatchEvent(new Event('input',{bubbles:true})); } })()");
    var studioSynced = await cdp.waitUntil("document.querySelector('#preview-name').textContent === 'KANGQA' && document.querySelector('#preview-number').textContent === '99'", 3000);
    assert(studioSynced, 'Home Jersey Studio actualiza nombre y dorsal en vivo sobre el SVG');

    // Mobile 375px Home check (verify Spotlight + 0px horizontal overflow on redesigned Home)
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true
    });
    await sleep(160);
    var mobileHomeOverflow = await cdp.evalJs("({ overflow: document.documentElement.scrollWidth - window.innerWidth, featureH: (document.querySelector('#hero-feature') && document.querySelector('#hero-feature').getBoundingClientRect().height) || 0 })");
    assert(mobileHomeOverflow && mobileHomeOverflow.overflow <= 1 && mobileHomeOverflow.featureH > 40, 'Móvil 375px: portada + Hero Spotlight visibles y sin desbordamiento horizontal (' + (mobileHomeOverflow ? mobileHomeOverflow.overflow : '?') + 'px)');

    // Switch back to Desktop 1280x800 for catalog flow checks
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(100);

    // Quick filters in catalog (Personalizable + Temporada 26/27)
    await cdp.evalJs("location.hash = '#/catalogo'");
    var catLoaded = await cdp.waitUntil("document.querySelector('[data-quick-custom]') !== null && document.querySelectorAll('.card[data-product], .team-group').length > 0", 8000);
    assert(catLoaded, 'Desktop 1280px: catálogo y nuevos filtros rápidos renderizados');

    await cdp.evalJs("document.querySelector('[data-quick-custom]').click()");
    var customApplied = await cdp.waitUntil("document.querySelector('[data-quick-custom].is-active') !== null && document.querySelectorAll('.card[data-product]').length > 0", 5000);
    assert(customApplied, 'Filtro rápido «Personalizable» aplica y muestra tarjetas');

    await cdp.evalJs("document.querySelector('[data-quick-season]').click()");
    var seasonApplied = await cdp.waitUntil("document.querySelector('[data-quick-season].is-active') !== null && document.querySelectorAll('.card[data-product]').length > 0", 5000);
    assert(seasonApplied, 'Filtro rápido «Nueva 26/27» activa temporada en 1 clic');

    // Product modal: volume progress + Bizum shortcut
    await cdp.evalJs("document.querySelector('.card[data-product]').click()");
    var modalOpened = await cdp.waitUntil("document.querySelector('#product-modal.is-open') !== null && document.querySelector('#product-volume-progress') !== null && document.querySelector('.product-bizum-tip') !== null", 5000);
    assert(modalOpened, 'Ficha de producto muestra progreso de descuento grupo y acceso rápido Bizum');

    // Mobile 375x812 responsive audit for Product, Cart & Contact
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true
    });
    await sleep(180);

    var mobileModalOverflow = await cdp.evalJs("Math.max(0, document.querySelector('#product-modal .product-layout').scrollWidth - window.innerWidth)");
    assert(mobileModalOverflow <= 2, 'Móvil 375px: ficha de producto sin desbordamiento horizontal (' + mobileModalOverflow + 'px)');

    // Add to cart from modal & inspect cart drawer quick actions
    await cdp.evalJs("document.querySelector('#product-add').click()");
    var cartOpened = await cdp.waitUntil("document.querySelector('#cart-drawer.is-open') !== null && document.querySelector('#cart-copy-summary') !== null && document.querySelector('#cart-copy-bizum') !== null", 5000);
    assert(cartOpened, 'Móvil 375px: carrito abierto con botones «Copiar resumen» y «Copiar Bizum»');

    var mobileCartOverflow = await cdp.evalJs("Math.max(0, document.querySelector('#cart-drawer').scrollWidth - window.innerWidth)");
    assert(mobileCartOverflow <= 2, 'Móvil 375px: drawer del carrito sin desbordamiento horizontal (' + mobileCartOverflow + 'px)');

    await cdp.evalJs("document.querySelector('#cart-close').click()");
    await cdp.evalJs("location.hash = '#/como-funciona'");
    var howLoaded = await cdp.waitUntil("document.querySelector('#view-how:not([hidden])') !== null && document.querySelector('#contact-whatsapp') !== null && document.querySelector('#contact-instagram') !== null && document.querySelector('#contact-email') !== null", 5000);
    assert(howLoaded, 'Móvil 375px: página Cómo funciona + 3 botones de contacto cargados');

    var mobileHowOverflow = await cdp.evalJs("document.documentElement.scrollWidth - window.innerWidth");
    assert(mobileHowOverflow <= 1, 'Móvil 375px: sin desbordamiento horizontal en Cómo funciona / Contacto (' + mobileHowOverflow + 'px)');

    // Check #/equipos league ordering: primary leagues -> Selecciones -> ... -> Otras ligas -> Otros
    await cdp.evalJs("location.hash = '#/equipos'");
    var teamsLoaded = await cdp.waitUntil("document.querySelectorAll('#teams-results .league-block-head h2').length > 5", 5000);
    assert(teamsLoaded, 'Sección Equipos cargada con todas sus ligas');
    var leagueHeadings = await cdp.evalJs("Array.from(document.querySelectorAll('#teams-results .league-block-head h2')).map(function(h){ return h.textContent.trim(); })");
    var idxLaLiga = Array.isArray(leagueHeadings) ? leagueHeadings.indexOf('LaLiga') : -1;
    var idxPremier = Array.isArray(leagueHeadings) ? leagueHeadings.indexOf('Premier League') : -1;
    var idxChilean = Array.isArray(leagueHeadings) ? leagueHeadings.indexOf('Chilean League') : -1;
    var idxSelecciones = Array.isArray(leagueHeadings) ? leagueHeadings.indexOf('Selecciones') : -1;
    var idxOtras = Array.isArray(leagueHeadings) ? leagueHeadings.indexOf('Otras ligas') : -1;
    var idxOtros = Array.isArray(leagueHeadings) ? leagueHeadings.indexOf('Otros') : -1;
    var validLeagueOrder = idxLaLiga === 0 &&
      idxPremier === 1 &&
      idxSelecciones > idxChilean &&
      idxOtras > idxSelecciones &&
      idxOtros === leagueHeadings.length - 1 &&
      idxOtras === idxOtros - 1;
    assert(validLeagueOrder, 'Equipos: principales ligas primero, luego Selecciones y Otras ligas justo antes de Otros (' + (leagueHeadings || []).join(' -> ') + ')');

    var teamCardLazy = await cdp.evalJs("(function(){ var imgs = Array.from(document.querySelectorAll('#teams-results .team-card img')); return { total: imgs.length, nonLazy: imgs.filter(function(i){ return i.getAttribute('loading') !== 'lazy'; }).length }; })()");
    assert(teamCardLazy && teamCardLazy.total > 0 && teamCardLazy.nonLazy === 0, 'Tarjetas de equipos usan loading="lazy" (' + (teamCardLazy ? teamCardLazy.total : 0) + ' imágenes, ' + (teamCardLazy ? teamCardLazy.nonLazy : '?') + ' sin lazy)');

    var teamsUxCheck = await cdp.evalJs("({ spotlight: document.querySelectorAll('#teams-spotlight .team-spotlight-chip').length, jumpChips: document.querySelectorAll('#teams-league-jump .league-jump-chip').length, laLigaSubs: document.querySelectorAll('#league-laliga .league-subhead').length, otrasInitial: document.querySelectorAll('#league-otras-ligas .team-card').length, hasExpandBtn: !!document.querySelector('[data-expand-league=\"Otras ligas\"]'), overflow: document.documentElement.scrollWidth - window.innerWidth, chipColor: getComputedStyle(document.querySelector('#teams-spotlight .team-spotlight-chip')).color, subColor: getComputedStyle(document.querySelector('#league-laliga .league-subhead h3')).color })");
    assert(teamsUxCheck && teamsUxCheck.spotlight >= 10 && teamsUxCheck.jumpChips >= 10, 'Equipos: tira de más buscados (' + (teamsUxCheck ? teamsUxCheck.spotlight : 0) + ') e índice de ligas (' + (teamsUxCheck ? teamsUxCheck.jumpChips : 0) + ') activos');
    assert(teamsUxCheck && /244,\s*242,\s*236/.test(teamsUxCheck.chipColor) && /244,\s*242,\s*236/.test(teamsUxCheck.subColor), 'Contraste legible (texto claro sobre fondo oscuro) en Más buscados y divisiones');
    assert(teamsUxCheck && teamsUxCheck.laLigaSubs === 2, 'Equipos: LaLiga separada en 1ª División y 2ª División e históricos');
    assert(teamsUxCheck && teamsUxCheck.otrasInitial === 24 && teamsUxCheck.hasExpandBtn, 'Equipos: Otras ligas plegada a 24 clubes con botón expandir');
    assert(teamsUxCheck && teamsUxCheck.overflow <= 1, 'Móvil 375px: sin desbordamiento horizontal en Equipos (' + (teamsUxCheck ? teamsUxCheck.overflow : '?') + 'px)');

    // Test division filter 2ª División -> Cordoba visible, Real Madrid hidden -> reset
    await cdp.evalJs("document.querySelector('[data-teams-div=\"2\"]').click()");
    var div2Filtered = await cdp.waitUntil("document.querySelector('[data-teams-div=\"2\"].is-active') !== null && Array.from(document.querySelectorAll('#teams-results .team-card-copy strong')).some(function(el){ return el.textContent === 'Cordoba'; }) && !Array.from(document.querySelectorAll('#teams-results .team-card-copy strong')).some(function(el){ return el.textContent === 'Real Madrid'; })", 4000);
    assert(div2Filtered, 'Filtro «2ª División / Históricos» muestra Córdoba y oculta clubes de 1ª');
    await cdp.evalJs("document.querySelector('[data-teams-div=\"\"]').click()");
    await cdp.waitUntil("document.querySelector('[data-expand-league=\"Otras ligas\"]') !== null", 4000);
    await cdp.evalJs("document.querySelector('[data-expand-league=\"Otras ligas\"]').click()");
    var otrasExpanded = await cdp.waitUntil("document.querySelectorAll('#league-otras-ligas .team-card').length > 100", 4000);
    assert(otrasExpanded, 'Botón expandir de Otras ligas despliega el listado completo');

    await cdp.evalJs("location.hash = '#/catalogo?equipo=Real%20Madrid&vista=grid'");
    var teamCatalogLoaded = await cdp.waitUntil("document.querySelectorAll('#catalog-results .card img').length > 0", 5000);
    assert(teamCatalogLoaded, 'Catálogo por equipo cargado con tarjetas de producto');
    var productCardLazy = await cdp.evalJs("(function(){ var imgs = Array.from(document.querySelectorAll('#catalog-results .card img, .catalog-team-crest img, .catalog-team-feature-thumb img')); return { total: imgs.length, nonLazy: imgs.filter(function(i){ return i.getAttribute('loading') !== 'lazy'; }).length }; })()");
    assert(productCardLazy && productCardLazy.total > 0 && productCardLazy.nonLazy === 0, 'Tarjetas de producto y cabecera de equipo usan loading="lazy" (' + (productCardLazy ? productCardLazy.total : 0) + ' imágenes, ' + (productCardLazy ? productCardLazy.nonLazy : '?') + ' sin lazy)');

    await cdp.evalJs("location.hash = '#/catalogo?equipo=Juventus&vista=grid'");
    var juvLoaded = await cdp.waitUntil("document.querySelectorAll('#catalog-results .card').length >= 15 && document.querySelector('#catalog-team-crest img') !== null", 6000);
    var juvImgReady = await cdp.waitUntil("(function(){ var img = document.querySelector('#catalog-team-crest img'); return !!(img && img.complete && img.naturalWidth > 0); })()", 6000);
    var juvSrc = await cdp.evalJs("(document.querySelector('#catalog-team-crest img') || {}).src || ''");
    assert(juvLoaded && juvImgReady && /juventus--white-monochrome/i.test(juvSrc), 'Juventus: catálogo cargado y escudo blanco visible en cabecera (' + juvSrc + ')');

    assert(cdp.runtimeExceptions.length === 0, 'Cero errores JS no controlados en navegador real', cdp.runtimeExceptions.join(' | '));
  } finally {
    if (cdp) cdp.close();
    try { chromeProc.kill('SIGTERM'); } catch (e) {}
    try { fs.rmSync(tmpProfile, { recursive: true, force: true }); } catch (e) {}
  }
}

async function runApiAndPrivacySuite() {
  section('SUITE 3 · QA Funcional, Seguridad, Privacidad y APIs E2E');

  var ordersSnapshot = snapshotOrdersDir();
  var serverEnv = Object.assign({}, process.env, {
    PORT: String(TEST_PORT),
    ADMIN_TOKEN: 'qa-admin-token-check',
    PROMO_CODES: 'QA5:-5€,QATEAM:-10%:5',
    RESEND_API_KEY: '',
    BREVO_API_KEY: '',
    GMAIL_USER: '',
    GMAIL_APP_PASSWORD: '',
    ORDER_WEBHOOK_URL: '',
    CALLMEBOT_PHONE: '',
    CALLMEBOT_APIKEY: ''
  });

  var proc = childProcess.spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: serverEnv,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  var stderrLog = '';
  proc.stderr.on('data', function (d) { stderrLog += d.toString('utf8'); });

  try {
    await waitForServer(TEST_PORT, 10000);
    pass('Servidor QA aislado arrancado en puerto ' + TEST_PORT);

    var staticRoutes = [
      '/',
      '/manifest.webmanifest',
      '/sw.js',
      '/robots.txt',
      '/sitemap.xml',
      '/pwa-192x192.png',
      '/pwa-512x512.png',
      '/pwa-maskable-512x512.png',
      '/apple-touch-icon.png',
      '/og-cover.png'
    ];
    for (var i = 0; i < staticRoutes.length; i++) {
      var r = staticRoutes[i];
      var resStatic = await httpRequest(TEST_PORT, 'GET', r);
      assert(resStatic.status === 200 && resStatic.size > 0, 'GET ' + r + ' devuelve HTTP 200 y contenido (' + resStatic.size + ' B)');
    }

    var cfg = await httpRequest(TEST_PORT, 'GET', '/api/config');
    assert(cfg.status === 200 && cfg.json && cfg.json.store, 'GET /api/config devuelve estructura válida');
    if (cfg.json && cfg.json.store) {
      assert(cfg.json.store.whatsapp === '34699234010', 'Contacto WhatsApp configurado a 34699234010 (' + cfg.json.store.whatsapp + ')');
      assert(cfg.json.store.email === 'santol86@gmail.com', 'Contacto Email configurado a santol86@gmail.com (' + cfg.json.store.email + ')');
      assert(cfg.json.store.instagram === 'tolillo9', 'Contacto Instagram configurado a tolillo9 (' + cfg.json.store.instagram + ')');
      assert(cfg.json.deliveryDefault === 'pickup_cordoba', 'Entrega por defecto = recogida Córdoba capital');
      assert(cfg.json.hasPromoCodes === true, 'Cupones privados detectados en /api/config');
    }

    var cat = await httpRequest(TEST_PORT, 'GET', '/api/catalog');
    var items = (cat.json && cat.json.items) || [];
    assert(cat.status === 200 && items.length > 0, 'GET /api/catalog devuelve catálogo con artículos (' + items.length + ')');

    var hasMinkang = items.some(function (it) { return it && it.source === 'minkang'; });
    var gxgfItems = items.filter(function (it) { return it && it.source === 'gxgfootball'; });
    var hasGxg = items.some(function (it) { return it && it.source === 'gxg'; });
    assert(hasMinkang && gxgfItems.length > 0 && hasGxg, 'Catálogo combina los 3 orígenes (minkang + gxgfootball:' + gxgfItems.length + ' + gxg)');

    var fpSources = {};
    var crossDupCount = 0;
    items.forEach(function (it) {
      if (!it || it.collection === 'primavera-invierno') return;
      var fp = parser.dedupFingerprint(it);
      if (!fp) return;
      if (fpSources[fp] && fpSources[fp] !== it.source) crossDupCount += 1;
      else fpSources[fp] = it.source;
    });
    assert(crossDupCount === 0, 'Cero duplicados entre Minkang y GXGFootball en el catálogo (' + crossDupCount + ' colisiones)');

    var liverpoolCount = items.filter(function (it) { return it && it.team === 'Liverpool'; }).length;
    assert(liverpoolCount >= 150, 'Liverpool disponible con catálogo completo (' + liverpoolCount + ' prendas)');

    var juvItems = items.filter(function (it) { return it && it.team === 'Juventus'; });
    assert(juvItems.length >= 16, 'Juventus incluye equipaciones + jugador + entrenamiento GXG (' + juvItems.length + ' prendas)');
    var juvMinkang = juvItems.filter(function (it) { return it.source === 'minkang'; });
    var juvMinkangWithSeason = juvMinkang.filter(function (it) { return it.season && it.season !== 'Sin temporada'; });
    var juvWind = juvMinkang.find(function (it) { return /windbreaker\s+set/i.test(it.title || ''); });
    var juvLong = juvMinkang.find(function (it) { return /long[-\s]?sleeve/i.test(it.title || ''); });
    var juvHoodie = juvMinkang.find(function (it) { return /\bhoodie\b/i.test(it.title || ''); });
    assert(juvMinkang.length >= 6 && juvMinkangWithSeason.length === juvMinkang.length, 'Juventus Minkang conserva título y temporada reales (' + juvMinkangWithSeason.length + '/' + juvMinkang.length + ')');
    assert(
      juvWind && pricing.calculate(juvWind, {}).unitPriceCents === 5500 &&
      juvLong && pricing.calculate(juvLong, {}).unitPriceCents === 2800 &&
      juvHoodie && pricing.calculate(juvHoodie, {}).unitPriceCents === 5500,
      'Precios reales en Juventus: Windbreaker Set 55 €, Manga Larga 28 €, Hoodie 55 €'
    );

    var logosRes = await httpRequest(TEST_PORT, 'GET', '/api/team-logos');
    var juvLogo = logosRes.json && logosRes.json.logos && logosRes.json.logos['Juventus'];
    assert(logosRes.status === 200 && /juventus--white-monochrome/i.test(String(juvLogo || '')), 'GET /api/team-logos devuelve escudo Juventus legible sobre fondo oscuro (' + (juvLogo || 'none') + ')');

    var sampleGxgf = gxgfItems.find(function (it) { return it && it.cover && /^\d+$/.test(String(it.albumId || '')); });
    if (sampleGxgf) {
      var imgRes = await httpRequest(TEST_PORT, 'GET', '/img/gxgfootball' + sampleGxgf.cover + '/small.jpg');
      assert(imgRes.status === 200 && /image\/jpeg/i.test(String(imgRes.headers['content-type'] || '')) && imgRes.size > 1000, 'Proxy /img/gxgfootball sirve imagen JPEG válida (' + imgRes.size + ' B)');

      var albRes = await httpRequest(TEST_PORT, 'GET', '/api/album/' + sampleGxgf.albumId + '?source=gxgfootball');
      assert(albRes.status === 200 && albRes.json && Array.isArray(albRes.json.images) && albRes.json.images.length > 0, 'GET /api/album/:id?source=gxgfootball devuelve galería (' + (albRes.json && albRes.json.images ? albRes.json.images.length : 0) + ' fotos)');
    } else {
      fail('Artículo de prueba GXGFootball localizado en catálogo');
    }

    var sampleItem = items.find(function (it) {
      return it && it.id && (!it.sizeRange || /S-2XL|S-XL/i.test(it.sizeRange));
    }) || items[0];
    assert(!!sampleItem, 'Artículo de prueba localizado en catálogo (' + (sampleItem ? sampleItem.id : 'none') + ')');

    var badPromo = await httpRequest(TEST_PORT, 'POST', '/api/promo/validate', { code: 'NOEXISTE', baseCents: 5000, totalItems: 2 });
    assert(badPromo.status === 400, 'Cupón inexistente rechazado con HTTP 400');

    var lowQtyPromo = await httpRequest(TEST_PORT, 'POST', '/api/promo/validate', { code: 'QATEAM', baseCents: 5000, totalItems: 2 });
    assert(lowQtyPromo.status === 400, 'Cupón QATEAM rechazado por debajo de 5 prendas (HTTP 400)');

    var okPromo = await httpRequest(TEST_PORT, 'POST', '/api/promo/validate', { code: 'QATEAM', baseCents: 12000, totalItems: 5 });
    assert(okPromo.status === 200 && okPromo.json && okPromo.json.promo && okPromo.json.promo.discountCents === 1200, 'Cupón QATEAM aceptado con 5 prendas (-10% = 12,00 €)');

    var invalidOrder = await httpRequest(TEST_PORT, 'POST', '/api/orders', { customer: { name: 'A', phone: '123' }, items: [] });
    assert(invalidOrder.status === 400, 'Pedido inválido rechazado con HTTP 400');

    var unitCalc = pricing.calculate(sampleItem, { size: 'M' });
    var orderPayload = {
      paymentMethod: 'bizum',
      deliveryMethod: 'pickup_cordoba',
      promoCode: 'QA5',
      customer: {
        name: 'Cliente QA Test',
        phone: '612345678',
        email: '',
        city: 'Córdoba',
        notes: 'Prueba automática QA'
      },
      items: [{ id: sampleItem.id, size: 'M', qty: 5, name: '', number: '', patches: 'No' }]
    };
    var created = await httpRequest(TEST_PORT, 'POST', '/api/orders', orderPayload);
    var expectedSubtotal = unitCalc.unitPriceCents * 5;
    var expectedTotal = Math.max(0, expectedSubtotal - 500 - 500);
    assert(created.status === 200 && created.json && created.json.ok && created.json.order && /^KT-/.test(created.json.order.id), 'POST /api/orders crea pedido correctamente');

    var createdOrder = created.json && created.json.order;
    if (createdOrder) {
      assert(createdOrder.subtotalCents === expectedSubtotal, 'Subtotal verificado en servidor (' + createdOrder.subtotalCents + ')');
      assert(createdOrder.volumeDiscountCents === 500, 'Descuento por volumen aplicado (-500 cts)');
      assert(createdOrder.promoDiscountCents === 500, 'Cupón QA5 aplicado (-500 cts)');
      assert(createdOrder.totalPriceCents === expectedTotal, 'Total final calculado correctamente (' + createdOrder.totalPriceCents + ')');
      assert(createdOrder.deliveryMethod === 'pickup_cordoba', 'Método de entrega pickup_cordoba persistido');

      var unauthAdmin = await httpRequest(TEST_PORT, 'GET', '/api/admin/orders');
      assert(unauthAdmin.status === 401, 'GET /api/admin/orders sin token bloqueado (HTTP 401)');

      var authAdmin = await httpRequest(TEST_PORT, 'GET', '/api/admin/orders', null, { 'X-Admin-Token': 'qa-admin-token-check' });
      assert(authAdmin.status === 200 && authAdmin.json && Array.isArray(authAdmin.json.orders), 'GET /api/admin/orders autenticado funciona');

      var patchShipped = await httpRequest(
        TEST_PORT,
        'PATCH',
        '/api/admin/orders/' + createdOrder.id,
        { status: 'shipped', trackingCarrier: 'YunExpress', trackingCode: 'SECRETQA999', adminNotes: 'Confirmado en envío', notifyEmail: false },
        { 'X-Admin-Token': 'qa-admin-token-check' }
      );
      assert(patchShipped.status === 200 && patchShipped.json && patchShipped.json.order && patchShipped.json.order.supplierOrderedAt, 'PATCH /api/admin/orders/:id actualiza estado a shipped y registra supplierOrderedAt');

      var wrongPhoneTrack = await httpRequest(TEST_PORT, 'GET', '/api/orders/track?id=' + encodeURIComponent(createdOrder.id) + '&phone4=0000');
      assert(wrongPhoneTrack.status === 403, 'Seguimiento con 4 últimos dígitos erróneos bloqueado (HTTP 403)');

      var publicTrack = await httpRequest(TEST_PORT, 'GET', '/api/orders/track?id=' + encodeURIComponent(createdOrder.id) + '&phone4=5678');
      assert(publicTrack.status === 200 && publicTrack.json && publicTrack.json.ok && publicTrack.json.order, 'GET /api/orders/track válido devuelve HTTP 200');
      var leaked = /SECRETQA999|YunExpress|trackingCode|trackingCarrier|17track/i.test(publicTrack.text);
      assert(!leaked, 'PRIVACIDAD: el código/transportista de seguimiento privado NO se filtra al cliente');

      var patchReady = await httpRequest(
        TEST_PORT,
        'PATCH',
        '/api/admin/orders/' + createdOrder.id,
        { status: 'ready', notifyEmail: false },
        { 'X-Admin-Token': 'qa-admin-token-check' }
      );
      assert(patchReady.status === 200 && patchReady.json.order.status === 'ready', 'Estado ready (Córdoba) actualizado correctamente');

      var delRes = await httpRequest(TEST_PORT, 'DELETE', '/api/admin/orders/' + createdOrder.id, null, { 'X-Admin-Token': 'qa-admin-token-check' });
      assert(delRes.status === 200 && delRes.json && delRes.json.ok, 'DELETE /api/admin/orders/:id elimina pedido');

      var afterDelTrack = await httpRequest(TEST_PORT, 'GET', '/api/orders/track?id=' + encodeURIComponent(createdOrder.id) + '&phone4=5678');
      assert(afterDelTrack.status === 404, 'Pedido eliminado devuelve HTTP 404 en seguimiento');
    }

    // Run live headless Chromium visual & layout checks against the running QA server
    await runBrowserVisualSuite();
  } finally {
    try { proc.kill('SIGTERM'); } catch (e) {}
    restoreOrdersDir(ordersSnapshot);
    if (stderrLog.trim()) {
      warn('Stderr del servidor durante pruebas QA: ' + stderrLog.trim().slice(0, 240));
    }
  }
}

function runUsabilityHeuristicSuite() {
  section('SUITE 4 · Auditoría de Usabilidad, Diseño y Accesibilidad');

  var html = readUtf8('public/index.html');
  var appJs = readUtf8('public/js/app.js');
  var css = readUtf8('public/css/styles.css');

  var modals = [];
  for (var m of html.matchAll(/class="[^"]*\b(?:modal|drawer|sheet|lightbox)\b[^"]*"[^>]*id="([^"]+)"|id="([^"]+)"[^>]*class="[^"]*\b(?:modal|drawer|sheet|lightbox)\b/g)) {
    modals.push(m[1] || m[2]);
  }
  var missingEscape = modals.filter(function (id) { return appJs.indexOf(id) === -1; });
  assert(missingEscape.length === 0, 'Todos los overlays (' + modals.length + ') están gestionados en app.js', missingEscape.join(', '));

  assert(/focus-visible/.test(css), 'Anillo de foco accesible (:focus-visible) definido en CSS');
  assert(/aria-live/.test(html), 'Región aria-live configurada para anuncios y toasts');
  assert(/loading=["']lazy["']/.test(appJs), 'Carga diferida (loading="lazy") en imágenes del catálogo');
  assert(/flex-wrap:\s*wrap/.test(css) && /\.promo-row/.test(css), 'Reglas flex-wrap presentes para evitar desbordamiento móvil en botones y cupones');

  var inlineJsStyles = (appJs.match(/style="/g) || []).length;
  if (inlineJsStyles > 12) {
    warn('Hay ' + inlineJsStyles + ' cadenas style="..." en app.js; conviene mover estilos estáticos a clases CSS.');
  } else {
    pass('Uso contenido de atributos style dinámicos en app.js (' + inlineJsStyles + ' instancias)');
  }
}

async function main() {
  var started = Date.now();
  await runStaticSuite();
  runPricingSuite();
  await runApiAndPrivacySuite();
  runUsabilityHeuristicSuite();

  var elapsedSec = ((Date.now() - started) / 1000).toFixed(2);
  console.log('\n──────────────────────────────────────────────────────────────');
  console.log('  RESUMEN QA KANG TEAM (' + elapsedSec + 's)');
  console.log('  Correctos: ' + stats.passed + '  |  Avisos: ' + stats.warned + '  |  Fallos: ' + stats.failed);
  console.log('──────────────────────────────────────────────────────────────');
  if (failures.length) {
    console.log('\nFallos detectados:');
    failures.forEach(function (f) { console.log('  - ' + f); });
    process.exit(1);
  }
  console.log('\n  Estado QA: APROBADO PARA PRODUCCIÓN\n');
}

main().catch(function (err) {
  console.error('Error fatal ejecutando agente QA:', err);
  process.exit(1);
});
