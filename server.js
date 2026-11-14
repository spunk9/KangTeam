'use strict';

var http = require('http');
var https = require('https');
var fs = require('fs');
var path = require('path');
var zlib = require('zlib');
var crypto = require('crypto');
var urlLib = require('url');

var util = require('./lib/util');
var yupoo = require('./lib/yupoo');
var logos = require('./lib/logos');
var syncModule = require('./scripts/sync');
var pricing = require('./public/js/pricing');

util.loadEnv(path.join(__dirname, '.env'));

var ROOT = __dirname;
var IS_VERCEL = !!process.env.VERCEL;
var PUBLIC_DIR = path.join(ROOT, 'public');
var DATA_DIR = path.join(ROOT, 'data');
var CATALOG_FILE = path.join(DATA_DIR, 'catalog.json');
var IMG_CACHE_DIR = path.join(DATA_DIR, 'cache', 'img');
var ALBUM_CACHE_DIR = path.join(DATA_DIR, 'cache', 'albums');
var ORDERS_DIR = path.join(DATA_DIR, 'orders');

var PORT = parseInt(process.env.PORT || '3000', 10);
var STORE = {
  name: process.env.STORE_NAME || 'KANG Team',
  whatsapp: (process.env.STORE_WHATSAPP || '').replace(/[^\d]/g, ''),
  email: process.env.STORE_EMAIL || '',
  instagram: process.env.STORE_INSTAGRAM || '',
  yupoo: 'https://minkang.x.yupoo.com/categories/712891'
};
var SYNC_INTERVAL_HOURS = parseFloat(process.env.SYNC_INTERVAL_HOURS || '6');
var ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

var catalog = { meta: { total: 0, generatedAt: null }, items: [] };
var catalogById = {};
var imageInFlight = {};
var albumMemory = {};
var orderRate = {};
// Mocked @vercel/blob replacement (in-memory, data lost on container sleep)
var blobStore = new Map();

// ─────────────────────────────────────────────────────────────
//  Catálogo
// ─────────────────────────────────────────────────────────────

function loadCatalogFromDisk() {
  try {
    var raw = fs.readFileSync(CATALOG_FILE, 'utf8');
    var parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.items)) {
      catalog = parsed;
      catalogById = {};
      parsed.items.forEach(function (item) { catalogById[item.id] = item; });
      return true;
    }
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('No se pudo leer el catálogo:', err.message);
  }
  return false;
}

function catalogIsStale() {
  if (!catalog.meta.generatedAt) return true;
  var age = Date.now() - new Date(catalog.meta.generatedAt).getTime();
  return age > SYNC_INTERVAL_HOURS * 3600 * 1000;
}

function refreshIfNeeded() {
  if (IS_VERCEL) return;
  if (syncModule.state.running || !catalogIsStale()) return;
  console.log('Catálogo desactualizado; sincronizando en segundo plano…');
  syncModule.runSync({}).then(function () {
    loadCatalogFromDisk();
  }).catch(function (err) {
    console.error('Error al sincronizar:', err.message);
  });
}

// ─────────────────────────────────────────────────────────────
//  Utilidades HTTP
// ─────────────────────────────────────────────────────────────

function sendJson(res, status, data, req, extraHeaders) {
  var body = Buffer.from(JSON.stringify(data));
  var headers = Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  }, extraHeaders || {});
  var acceptsGzip = req && /gzip/.test(req.headers['accept-encoding'] || '');
  if (acceptsGzip && body.length > 800) {
    body = zlib.gzipSync(body);
    headers['Content-Encoding'] = 'gzip';
  }
  headers['Content-Length'] = body.length;
  res.writeHead(status, headers);
  res.end(body);
}

function sendText(res, status, text, type) {
  var body = Buffer.from(text);
  res.writeHead(status, {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req, limit) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    var length = 0;
    req.on('data', function (chunk) {
      length += chunk.length;
      if (length > limit) {
        reject(new Error('Payload demasiado grande'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', function () { resolve(Buffer.concat(chunks).toString('utf8')); });
    req.on('error', reject);
  });
}

function postJson(target, headers, payload, timeout) {
  return new Promise(function (resolve, reject) {
    var data = Buffer.from(JSON.stringify(payload));
    var parsed = new urlLib.URL(target);
    var lib = parsed.protocol === 'https:' ? https : http;
    var req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'User-Agent': 'KANG-Team-Catalog/1.0'
      }, headers || {}),
      timeout: timeout || 12000
    }, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        var text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, body: text });
      });
    });
    req.on('timeout', function () { req.destroy(new Error('Timeout')); });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getUrl(target, timeout) {
  return new Promise(function (resolve, reject) {
    var parsed = new urlLib.URL(target);
    var lib = parsed.protocol === 'https:' ? https : http;
    var req = lib.get({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers: { 'User-Agent': 'KANG-Team-Catalog/1.0' },
      timeout: timeout || 12000
    }, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') });
      });
    });
    req.on('timeout', function () { req.destroy(new Error('Timeout')); });
    req.on('error', reject);
  });
}

function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─────────────────────────────────────────────────────────────
//  Pedidos
// ─────────────────────────────────────────────────────────────

var SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];

function allowedSizes(item) {
  var range = item.sizeRange || 'S-2XL';
  var kids = range.match(/^(\d{2})-(\d{2})$/);
  if (kids) {
    var from = parseInt(kids[1], 10);
    var to = parseInt(kids[2], 10);
    var sizes = [];
    for (var s = from; s <= to; s += 2) sizes.push(String(s));
    return sizes;
  }
  var parts = range.split('-');
  var a = SIZE_ORDER.indexOf(parts[0]);
  var b = SIZE_ORDER.indexOf(parts[1]);
  if (a === -1) a = 2;
  if (b === -1) b = 4;
  if (b < a) b = a;
  return SIZE_ORDER.slice(a, b + 1);
}

function sanitizeShort(value, max) {
  return String(value || '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function validateOrder(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Pedido no válido');
  var customer = payload.customer || {};
  var name = sanitizeShort(customer.name, 80);
  var phone = sanitizeShort(customer.phone, 30);
  var email = sanitizeShort(customer.email, 120);
  var city = sanitizeShort(customer.city, 80);
  var notes = sanitizeShort(customer.notes, 600);

  if (name.length < 2) throw new Error('El nombre es obligatorio');
  if (phone.replace(/\D/g, '').length < 6) throw new Error('El teléfono no es válido');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('El email no es válido');

  var items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) throw new Error('El carrito está vacío');
  if (items.length > 40) throw new Error('Demasiados artículos');

  var cleanItems = items.map(function (raw, index) {
    var product = catalogById[String(raw.id || '')];
    if (!product) throw new Error('Producto no encontrado: ' + raw.id);
    var qty = parseInt(raw.qty, 10);
    if (!qty || qty < 1 || qty > 30) throw new Error('Cantidad no válida');
    var size = sanitizeShort(raw.size, 8).toUpperCase();
    if (allowedSizes(product).indexOf(size) === -1) throw new Error('Talla no válida para ' + product.title);

    var customName = product.custom ? sanitizeShort(raw.name, 14).toUpperCase() : '';
    var customNumber = product.custom ? sanitizeShort(raw.number, 2) : '';
    if (product.custom && raw.number !== '' && raw.number !== undefined && !/^\d{1,2}$/.test(String(raw.number))) {
      throw new Error('El dorsal debe ser un número del 0 al 99');
    }

    var patch = product.custom ? sanitizeShort(raw.patches, 40) : '';
    if (!patch) patch = 'No';
    if (patch !== 'No') {
      var allowedPatches = ['Liga', 'Champions', 'Mundial', 'Copa', 'Personalizado'];
      var selectedPatches = [];
      patch.split(',').forEach(function (value) {
        value = value.trim();
        if (allowedPatches.indexOf(value) === -1) throw new Error('Parche no válido');
        if (selectedPatches.indexOf(value) === -1) selectedPatches.push(value);
      });
      patch = selectedPatches.join(', ') || 'No';
    }

    var price = pricing.calculate(product, { name: customName, number: customNumber, patches: patch, size: size });
    return {
      position: index + 1,
      id: product.id,
      title: product.title,
      team: product.team,
      season: product.season,
      type: product.type,
      size: size,
      qty: qty,
      name: customName,
      number: customNumber,
      patches: patch,
      priceBreakdown: price,
      unitPriceCents: price.unitPriceCents,
      lineTotalCents: price.unitPriceCents * qty,
      image: product.cover ? '/img' + product.cover + '/small.jpg' : ''
    };
  });

  return {
    id: 'KT-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + crypto.randomBytes(2).toString('hex').toUpperCase(),
    createdAt: new Date().toISOString(),
    customer: { name: name, phone: phone, email: email, city: city, notes: notes },
    items: cleanItems,
    totalItems: cleanItems.reduce(function (sum, item) { return sum + item.qty; }, 0),
    totalPriceCents: cleanItems.reduce(function (sum, item) { return sum + item.lineTotalCents; }, 0)
  };
}

function patchLabel(value) {
  if (!value || value === 'No') return 'No';
  return 'Sí (' + value + ')';
}

function itemLabel(type) {
  var labels = {
    jersey: 'Camiseta',
    training: 'Chándal',
    jacket: 'Chaqueta',
    polo: 'Polo',
    shorts: 'Pantalón',
    hoodie: 'Sudadera',
    casual: 'Prenda casual',
    other: 'Prenda'
  };
  return labels[type] || 'Prenda';
}

function orderToText(order) {
  var lines = [];
  lines.push('NUEVO PEDIDO · ' + STORE.name.toUpperCase());
  lines.push('Pedido: ' + order.id);
  lines.push('Fecha: ' + new Date(order.createdAt).toLocaleString('es-ES'));
  lines.push('');
  order.items.forEach(function (item) {
    lines.push('── ARTÍCULO ' + item.position + ' ──');
    lines.push(itemLabel(item.type) + ': ' + item.title);
    lines.push('Equipo: ' + item.team + (item.season ? ' · ' + item.season : ''));
    lines.push('Talla: ' + item.size);
    lines.push('Nombre: ' + (item.name || '—'));
    lines.push('Número: ' + (item.number || '—'));
    lines.push('Parches: ' + patchLabel(item.patches));
    lines.push('Cantidad: ' + item.qty);
    lines.push('Precio unidad: ' + pricing.money(item.unitPriceCents));
    lines.push('Subtotal: ' + pricing.money(item.lineTotalCents));
    lines.push('');
  });
  lines.push('── CLIENTE ──');
  lines.push('Nombre: ' + order.customer.name);
  lines.push('Teléfono: ' + order.customer.phone);
  if (order.customer.email) lines.push('Email: ' + order.customer.email);
  if (order.customer.city) lines.push('Ciudad: ' + order.customer.city);
  if (order.customer.notes) lines.push('Notas: ' + order.customer.notes);
  lines.push('');
  lines.push('Total artículos: ' + order.totalItems);
  lines.push('TOTAL DEL PEDIDO: ' + pricing.money(order.totalPriceCents));
  lines.push('Gastos de envío: por confirmar');
  return lines.join('\n');
}

function orderToHtml(order) {
  var rows = order.items.map(function (item) {
    return '<tr>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #eee;vertical-align:top">' +
        '<strong>' + escapeHtml(item.title) + '</strong><br>' +
        '<span style="color:#666;font-size:13px">' + escapeHtml(item.team) + ' · ' + escapeHtml(item.season) + '</span>' +
      '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #eee">' + escapeHtml(item.size) + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #eee">' +
        (item.name ? escapeHtml(item.name) + '<br>' : '') +
        (item.number ? '#' + escapeHtml(item.number) : '') +
      '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #eee">' + escapeHtml(patchLabel(item.patches)) + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center">' + item.qty + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right">' + escapeHtml(pricing.money(item.unitPriceCents)) + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right">' + escapeHtml(pricing.money(item.lineTotalCents)) + '</td>' +
    '</tr>';
  }).join('');

  return '<div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#111">' +
    '<h1 style="font-size:22px;margin:0 0 4px">Nuevo pedido · ' + escapeHtml(STORE.name) + '</h1>' +
    '<p style="color:#666;margin:0 0 18px">' + escapeHtml(order.id) + ' · ' + escapeHtml(new Date(order.createdAt).toLocaleString('es-ES')) + '</p>' +
    '<table style="width:100%;border-collapse:collapse;font-size:14px">' +
      '<thead><tr style="background:#f4f2ec;text-align:left">' +
        '<th style="padding:10px 12px">Artículo</th><th style="padding:10px 12px">Talla</th>' +
        '<th style="padding:10px 12px">Nombre / Dorsal</th><th style="padding:10px 12px">Parches</th>' +
        '<th style="padding:10px 12px">Uds.</th><th style="padding:10px 12px">Precio unidad</th><th style="padding:10px 12px">Subtotal</th>' +
      '</tr></thead><tbody>' + rows + '</tbody>' +
    '</table>' +
    '<p style="text-align:right;font-size:18px"><strong>Total del pedido: ' + escapeHtml(pricing.money(order.totalPriceCents)) + '</strong><br><span style="font-size:12px;color:#777">Gastos de envío por confirmar</span></p>' +
    '<h2 style="font-size:16px;margin:24px 0 8px">Cliente</h2>' +
    '<p style="font-size:14px;line-height:1.6;margin:0">' +
      '<strong>' + escapeHtml(order.customer.name) + '</strong><br>' +
      'Teléfono: ' + escapeHtml(order.customer.phone) + '<br>' +
      (order.customer.email ? 'Email: ' + escapeHtml(order.customer.email) + '<br>' : '') +
      (order.customer.city ? 'Ciudad: ' + escapeHtml(order.customer.city) + '<br>' : '') +
      (order.customer.notes ? 'Notas: ' + escapeHtml(order.customer.notes) : '') +
    '</p>' +
    '<p style="color:#888;font-size:12px;margin-top:24px">Pedido generado desde el catálogo online. No se ha realizado ningún cobro.</p>' +
  '</div>';
}

async function saveOrder(order) {
  if (IS_VERCEL) {
    try {
      var blob = await import('@vercel/blob');
      await blob.put('orders/' + order.id + '.json', JSON.stringify(order), {
        access: 'private',
        addRandomSuffix: false,
        contentType: 'application/json; charset=utf-8'
      });
      return;
    } catch (err) {
      if (process.env.BLOB_READ_WRITE_TOKEN) throw err;
      blobStore.set('orders/' + order.id + '.json', JSON.stringify(order));
      return;
    }
  }
  fs.mkdirSync(ORDERS_DIR, { recursive: true });
  util.writeJsonAtomic(path.join(ORDERS_DIR, order.id + '.json'), order);
  fs.appendFileSync(path.join(ORDERS_DIR, 'orders.jsonl'), JSON.stringify({
    id: order.id,
    createdAt: order.createdAt,
    customer: order.customer,
    totalItems: order.totalItems,
      totalPriceCents: order.totalPriceCents,
    items: order.items.map(function (i) {
      return { title: i.title, size: i.size, name: i.name, number: i.number, patches: i.patches, qty: i.qty, unitPriceCents: i.unitPriceCents, lineTotalCents: i.lineTotalCents };
    })
  }) + '\n', 'utf8');
}

async function notifyOrder(order) {
  var result = { email: false, whatsapp: false, webhook: false, errors: [] };
  var subject = 'Nuevo pedido ' + order.id + ' · ' + order.totalItems + ' art. · ' + order.customer.name;
  var text = orderToText(order);
  var html = orderToHtml(order);
  var to = process.env.ORDER_TO || STORE.email;

  if (process.env.RESEND_API_KEY && to) {
    try {
      var resend = await postJson('https://api.resend.com/emails', {
        Authorization: 'Bearer ' + process.env.RESEND_API_KEY
      }, {
        from: process.env.ORDER_FROM || (STORE.name + ' <onboarding@resend.dev>'),
        to: [to],
        subject: subject,
        text: text,
        html: html
      });
      if (resend.status >= 200 && resend.status < 300) result.email = true;
      else result.errors.push('Resend: ' + resend.status + ' ' + resend.body.slice(0, 200));
    } catch (err) { result.errors.push('Resend: ' + err.message); }
  }

  if (!result.email && process.env.BREVO_API_KEY && to) {
    try {
      var from = process.env.ORDER_FROM || '';
      var fromEmail = (from.match(/<([^>]+)>/) || [])[1] || from || STORE.email;
      var fromName = from.replace(/<[^>]+>/, '').trim() || STORE.name;
      var brevo = await postJson('https://api.brevo.com/v3/smtp/email', {
        'api-key': process.env.BREVO_API_KEY
      }, {
        sender: { name: fromName, email: fromEmail },
        to: [{ email: to }],
        subject: subject,
        textContent: text,
        htmlContent: html
      });
      if (brevo.status >= 200 && brevo.status < 300) result.email = true;
      else result.errors.push('Brevo: ' + brevo.status + ' ' + brevo.body.slice(0, 200));
    } catch (err) { result.errors.push('Brevo: ' + err.message); }
  }

  if (!result.email && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD && to) {
    try {
      var nodemailer = require('nodemailer');
      var gmail = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, '')
        }
      });
      var gmailResult = await gmail.sendMail({
        from: STORE.name + ' <' + process.env.GMAIL_USER + '>',
        to: to,
        subject: subject,
        text: text,
        html: html
      });
      if (gmailResult && gmailResult.messageId) result.email = true;
      else result.errors.push('Gmail: el servidor no confirmó el envío');
    } catch (err) { result.errors.push('Gmail: ' + err.message); }
  }

  if (process.env.ORDER_WEBHOOK_URL) {
    try {
      var hook = await postJson(process.env.ORDER_WEBHOOK_URL, {}, {
        subject: subject,
        text: text,
        order: order
      });
      if (hook.status >= 200 && hook.status < 300) result.webhook = true;
      else result.errors.push('Webhook: ' + hook.status);
    } catch (err) { result.errors.push('Webhook: ' + err.message); }
  }

  if (process.env.CALLMEBOT_PHONE && process.env.CALLMEBOT_APIKEY) {
    try {
      var waTarget = 'https://api.callmebot.com/whatsapp.php?phone=' +
        encodeURIComponent(process.env.CALLMEBOT_PHONE) +
        '&text=' + encodeURIComponent(text) +
        '&apikey=' + encodeURIComponent(process.env.CALLMEBOT_APIKEY);
      var wa = await getUrl(waTarget);
      if (wa.status >= 200 && wa.status < 300) result.whatsapp = true;
      else result.errors.push('CallMeBot: ' + wa.status);
    } catch (err) { result.errors.push('CallMeBot: ' + err.message); }
  }

  return result;
}

function rateLimited(ip) {
  var now = Date.now();
  var windowMs = 10 * 60 * 1000;
  var hits = (orderRate[ip] || []).filter(function (t) { return now - t < windowMs; });
  hits.push(now);
  orderRate[ip] = hits;
  return hits.length > 8;
}

// ─────────────────────────────────────────────────────────────
//  Imágenes
// ─────────────────────────────────────────────────────────────

var PLACEHOLDER = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750" viewBox="0 0 600 750">' +
  '<rect width="600" height="750" fill="#f1efe9"/>' +
  '<path d="M300 300l70 40v120l-70 40-70-40V340z" fill="none" stroke="#c9c5ba" stroke-width="6"/>' +
  '<text x="300" y="560" text-anchor="middle" fill="#a7a297" font-family="Arial" font-size="18">Imagen no disponible</text>' +
  '</svg>');

function serveImage(req, res, pathname) {
  // Minkang keeps the legacy path; GXG images use /img/gxg/gxgtrainingwear/...
  var legacy = pathname.match(/^\/img\/(minkang)\/([a-z0-9]+)\/(small|medium|big)\.jpg$/i);
  var gxg = pathname.match(/^\/img\/(gxg)\/(gxgtrainingwear)\/([a-z0-9]+)\/(small|medium|big)\.jpg$/i);
  var source = gxg ? 'gxg' : 'minkang';
  var folder = gxg ? gxg[2] : (legacy && legacy[1]);
  var hash = gxg ? gxg[3] : (legacy && legacy[2]);
  var filename = gxg ? gxg[4] + '.jpg' : (legacy && legacy[3] + '.jpg');
  if (!folder || !hash || !filename) {
    res.writeHead(404, { 'Content-Type': 'image/svg+xml' });
    return res.end(PLACEHOLDER);
  }
  var remotePath = folder + '/' + hash + '/' + filename;
  var cachePath = (source === 'gxg' ? 'gxg/' : '') + remotePath;
  var diskPath = path.join(IMG_CACHE_DIR, cachePath);

  function sendBuffer(buffer) {
    res.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Content-Length': buffer.length,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(buffer);
  }

  if (fs.existsSync(diskPath)) {
    try { return sendBuffer(fs.readFileSync(diskPath)); } catch (e) {}
  }

  if (imageInFlight[cachePath]) {
    imageInFlight[cachePath].then(sendBuffer).catch(function () {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=300' });
      res.end(PLACEHOLDER);
    });
    return;
  }

  var sourceConfig = yupoo.SOURCES[source];
  var promise = yupoo.fetchBuffer('https://photo.yupoo.com/' + remotePath, {
    headers: { 'Referer': sourceConfig.referer, 'Accept': 'image/avif,image/webp,image/jpeg,*/*' },
    timeout: 20000
  }).then(function (result) {
    var buffer = result.buffer;
    if (!IS_VERCEL) {
      fs.mkdirSync(path.dirname(diskPath), { recursive: true });
      fs.writeFileSync(diskPath, buffer);
    }
    delete imageInFlight[cachePath];
    return buffer;
  }).catch(function (err) {
    delete imageInFlight[cachePath];
    throw err;
  });

  imageInFlight[cachePath] = promise;
  promise.then(sendBuffer).catch(function () {
    res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=300' });
    res.end(PLACEHOLDER);
  });
}

// ─────────────────────────────────────────────────────────────
//  Álbumes (galería de cada prenda)
// ─────────────────────────────────────────────────────────────

async function getAlbum(id, source) {
  source = source === 'gxg' ? 'gxg' : 'minkang';
  var sourceConfig = yupoo.SOURCES[source];
  var key = source + '-' + id;
  var now = Date.now();
  if (albumMemory[key] && now - albumMemory[key].time < 7 * 86400000) return albumMemory[key].data;

  var cacheFile = path.join(ALBUM_CACHE_DIR, key + '.json');
  if (!IS_VERCEL) {
    try {
      var stat = fs.statSync(cacheFile);
      if (now - stat.mtimeMs < 7 * 86400000) {
        var cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        albumMemory[key] = { time: stat.mtimeMs, data: cached };
        return cached;
      }
    } catch (e) {}
  }

  var html = await yupoo.fetchWithRetries(sourceConfig.base + '/albums/' + id + '?uid=1', {
    timeout: 25000,
    headers: { 'Referer': sourceConfig.referer }
  }, 2);
  var album = yupoo.parseAlbum(html);
  album.images = (album.images || []).slice(0, 16);
  if (!IS_VERCEL) {
    fs.mkdirSync(ALBUM_CACHE_DIR, { recursive: true });
    util.writeJsonAtomic(cacheFile, album);
  }
  albumMemory[key] = { time: now, data: album };
  return album;
}

// ─────────────────────────────────────────────────────────────
//  Servidor
// ─────────────────────────────────────────────────────────────

function serveStatic(req, res, pathname) {
  var safePath = decodeURIComponent(pathname.split('?')[0]);
  if (safePath === '/' || safePath === '') safePath = '/index.html';
  var filePath = path.join(PUBLIC_DIR, safePath);
  if (filePath.indexOf(PUBLIC_DIR) !== 0) return sendText(res, 403, 'Prohibido');

  fs.stat(filePath, function (err, stat) {
    if (err || !stat.isFile()) {
      // Rutas amigables → SPA
      filePath = path.join(PUBLIC_DIR, 'index.html');
      try { stat = fs.statSync(filePath); } catch (e) { return sendText(res, 404, 'No encontrado'); }
    }
    var ext = path.extname(filePath).toLowerCase();
    var type = MIME[ext] || 'application/octet-stream';
    var revalidate = ext === '.html' || ext === '.js' || ext === '.css';
    var headers = {
      'Content-Type': type,
      'Cache-Control': revalidate ? 'no-cache' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff'
    };
    var acceptsGzip = /gzip/.test(req.headers['accept-encoding'] || '') && /^(text|application)\//.test(type);
    fs.readFile(filePath, function (readErr, buffer) {
      if (readErr) return sendText(res, 500, 'Error al leer el archivo');
      if (acceptsGzip && buffer.length > 1024) {
        buffer = zlib.gzipSync(buffer);
        headers['Content-Encoding'] = 'gzip';
      }
      headers['Content-Length'] = buffer.length;
      res.writeHead(200, headers);
      res.end(buffer);
    });
  });
}

async function handle(req, res) {
  var parsed = urlLib.parse(req.url, true);
  var pathname = parsed.pathname || '/';

  if (req.method === 'GET' && pathname.indexOf('/img/') === 0) {
    return serveImage(req, res, pathname);
  }

  if (pathname === '/api/config' && req.method === 'GET') {
    return sendJson(res, 200, {
      store: STORE,
      syncIntervalHours: SYNC_INTERVAL_HOURS,
      updatedAt: catalog.meta.generatedAt,
      total: catalog.meta.total
    }, req);
  }

  if (pathname === '/api/catalog' && req.method === 'GET') {
    if (!catalog.items.length) {
      refreshIfNeeded();
      return sendJson(res, 503, { syncing: true, status: syncModule.state }, req);
    }
    return sendJson(res, 200, catalog, req);
  }

  if (pathname === '/api/team-logos' && req.method === 'GET') {
    var logoData = await logos.getTeamLogos(catalog.items, catalog.meta.generatedAt || catalog.items.length);
    return sendJson(res, 200, logoData, req, { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' });
  }

  if (pathname === '/api/sync' && req.method === 'GET') {
    return sendJson(res, 200, {
      state: syncModule.state,
      updatedAt: catalog.meta.generatedAt,
      total: catalog.meta.total,
      stale: catalogIsStale()
    }, req);
  }

  if (pathname === '/api/sync' && req.method === 'POST') {
    if (IS_VERCEL) {
      return sendJson(res, 503, { error: 'En Vercel, sincroniza el catálogo localmente y publica una nueva versión.' }, req);
    }
    var remote = req.socket.remoteAddress || '';
    var isLocal = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
    var token = req.headers['x-admin-token'] || parsed.query.token;
    if (!isLocal && (!ADMIN_TOKEN || token !== ADMIN_TOKEN)) {
      return sendJson(res, 401, { error: 'No autorizado' }, req);
    }
    if (syncModule.state.running) {
      return sendJson(res, 202, { ok: true, syncing: true, state: syncModule.state }, req);
    }
    sendJson(res, 202, { ok: true, syncing: true }, req);
    syncModule.runSync({}).then(loadCatalogFromDisk).catch(function (err) {
      console.error('Error de sincronización:', err.message);
    });
    return;
  }

  if (pathname.indexOf('/api/album/') === 0 && req.method === 'GET') {
    var id = pathname.split('/').pop();
    if (!/^\d+$/.test(id)) return sendJson(res, 400, { error: 'ID no válido' }, req);
    try {
      var album = await getAlbum(id, parsed.query.source);
      return sendJson(res, 200, album, req, { 'Cache-Control': 'public, max-age=86400' });
    } catch (err) {
      return sendJson(res, 502, { error: 'No se pudo cargar la galería', detail: err.message }, req);
    }
  }

  if (pathname === '/api/orders' && req.method === 'POST') {
    var ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    if (rateLimited(ip)) return sendJson(res, 429, { error: 'Demasiados intentos. Espera unos minutos.' }, req);

    var raw;
    try {
      raw = await readBody(req, 120 * 1024);
      var payload = JSON.parse(raw);
      var order = validateOrder(payload);

      await saveOrder(order);
      var delivery = await notifyOrder(order);
      var text = orderToText(order);
      var whatsappUrl = STORE.whatsapp
        ? 'https://wa.me/' + STORE.whatsapp + '?text=' + encodeURIComponent(text)
        : '';
      var mailtoUrl = STORE.email
        ? 'mailto:' + STORE.email + '?subject=' + encodeURIComponent('Pedido ' + order.id) + '&body=' + encodeURIComponent(text)
        : '';

      console.log('Pedido', order.id, '·', order.customer.name, '·', order.totalItems, 'art. · email:', delivery.email, '· wa:', delivery.whatsapp);
      return sendJson(res, 200, {
        ok: true,
        order: { id: order.id, createdAt: order.createdAt, totalPriceCents: order.totalPriceCents },
        delivery: delivery,
        whatsappUrl: whatsappUrl,
        mailtoUrl: mailtoUrl,
        text: text
      }, req);
    } catch (err) {
      var status = /no válid|obligatorio|vacío|encontrado|Talla|Cantidad|dorsal|Demasiados/.test(err.message) ? 400 : 500;
      return sendJson(res, status, { error: err.message }, req);
    }
  }

  if (pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, total: catalog.items.length, updatedAt: catalog.meta.generatedAt }, req);
  }

  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, pathname);
  return sendText(res, 405, 'Método no permitido');
}

function handleRequest(req, res) {
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  return handle(req, res).catch(function (err) {
    console.error('Error no controlado:', err);
    if (!res.headersSent) sendJson(res, 500, { error: 'Error interno' }, req);
    else res.end();
  });
}

var server = http.createServer(handleRequest);
module.exports = { handleRequest: handleRequest };

loadCatalogFromDisk();

if (require.main === module) {
server.listen(PORT, '0.0.0.0', function () {
  console.log('');
  console.log('  ⚽  ' + STORE.name + ' · catálogo online');
  console.log('  ─────────────────────────────────────────');
  console.log('  http://localhost:' + PORT);
  console.log('  Prendas: ' + catalog.items.length + ' · Actualizado: ' + (catalog.meta.generatedAt || 'pendiente'));
  console.log('  WhatsApp tienda: ' + (STORE.whatsapp || 'sin configurar'));
  console.log('  Email tienda: ' + (STORE.email || 'sin configurar'));
  console.log('');

  if (!catalog.items.length) {
    console.log('No hay catálogo local. Iniciando primera sincronización…');
    refreshIfNeeded();
  } else if (catalogIsStale()) {
    console.log('Catálogo desactualizado. Se refrescará en segundo plano.');
    setTimeout(refreshIfNeeded, 3000);
  }

  if (!IS_VERCEL) setInterval(refreshIfNeeded, 30 * 60 * 1000);
});

process.on('SIGINT', function () {
  console.log('\nCerrando…');
  server.close(function () { process.exit(0); });
});
}
