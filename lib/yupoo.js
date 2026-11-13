'use strict';

var https = require('https');
var http = require('http');
var zlib = require('zlib');
var util = require('./util');

var BASE = 'https://minkang.x.yupoo.com';
var IMAGE_REFERER = 'https://minkang.x.yupoo.com/';
var SOURCES = {
  minkang: { base: BASE, referer: IMAGE_REFERER },
  gxg: { base: 'https://gxgtrainingwear.x.yupoo.com', referer: 'https://gxgtrainingwear.x.yupoo.com/' }
};
var USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function request(url, options, redirectsLeft) {
  if (redirectsLeft === undefined) redirectsLeft = 5;
  options = options || {};
  return new Promise(function (resolve, reject) {
    var lib = url.indexOf('https:') === 0 ? https : http;
    var headers = Object.assign({
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate',
      'Referer': BASE + '/'
    }, options.headers || {});

    var req = lib.get(url, { headers: headers, timeout: options.timeout || 30000 }, function (res) {
      var status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        if (redirectsLeft <= 0) return reject(new Error('Demasiadas redirecciones'));
        var next;
        try { next = new URL(res.headers.location, url).toString(); }
        catch (e) { next = res.headers.location; }
        return resolve(request(next, options, redirectsLeft - 1));
      }
      if (status !== 200) {
        res.resume();
        return reject(new Error('HTTP ' + status + ' en ' + url));
      }

      var stream = res;
      var encoding = (res.headers['content-encoding'] || '').toLowerCase();
      if (encoding === 'gzip') stream = res.pipe(zlib.createGunzip());
      else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());
      else if (encoding === 'br') stream = res.pipe(zlib.createBrotliDecompress());

      var chunks = [];
      stream.on('data', function (chunk) { chunks.push(chunk); });
      stream.on('end', function () {
        resolve({ buffer: Buffer.concat(chunks), headers: res.headers });
      });
      stream.on('error', reject);
    });
    req.on('timeout', function () {
      req.destroy(new Error('Timeout en ' + url));
    });
    req.on('error', reject);
  });
}

async function fetchText(url, options) {
  var res = await request(url, options);
  return res.buffer.toString('utf8');
}

async function fetchBuffer(url, options) {
  var res = await request(url, options);
  return res;
}

async function fetchWithRetries(url, options, attempts) {
  attempts = attempts || 3;
  var lastError;
  for (var i = 0; i < attempts; i++) {
    try {
      return await fetchText(url, options);
    } catch (err) {
      lastError = err;
      await util.sleep(600 + i * 900);
    }
  }
  throw lastError;
}

/** Devuelve el número total de páginas de una categoría. */
function parsePageCount(html) {
  var m = html.match(/1\s*\/\s*(\d+)/);
  if (m) return parseInt(m[1], 10);
  var pages = [];
  var re = /[?&]page(?:&#x3D;|=)(\d+)/g;
  var hit;
  while ((hit = re.exec(html))) pages.push(parseInt(hit[1], 10));
  return pages.length ? Math.max.apply(null, pages) : 1;
}

/** Extrae los álbumes de una página de categoría. */
function parseListing(html) {
  var items = [];
  var parts = html.split('<div class="categories__children">');
  for (var i = 1; i < parts.length; i++) {
    var block = parts[i].slice(0, 4000);
    var titleMatch = block.match(/<a\s+class="album__main"\s+title="([^"]*)"/i) ||
      block.match(/title="([^"]*)"/i);
    var idMatch = block.match(/href="\/albums\/(\d+)/i);
    if (!titleMatch || !idMatch) continue;
    var coverMatch = block.match(/data-src="(https:\/\/photo\.yupoo\.com\/[^"]+)"/i) ||
      block.match(/src="(https:\/\/photo\.yupoo\.com\/[^"]+)"/i);
    var photosMatch = block.match(/album__photonumber">\s*(\d+)/i);
    items.push({
      id: idMatch[1],
      title: util.decodeEntities(titleMatch[1]),
      cover: coverMatch ? coverMatch[1] : '',
      photos: photosMatch ? parseInt(photosMatch[1], 10) : 1
    });
  }
  return items;
}

/** Extrae la relación liga → equipos del menú lateral. */
function parseSidebar(html) {
  var rows = [];
  var re = /<div class='yupoo-collapse-item[^']*'>\s*<div class='yupoo-collapse-header'>\s*<a href='\/categories\/\d+' title='([^']*)'[^>]*>(?:[\s\S]*?)<\/div>\s*<div class='yupoo-collapse-content[^']*'[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
  var match;
  while ((match = re.exec(html))) {
    var league = util.decodeEntities(match[1]);
    var content = match[2];
    var teamRe = /class='yupoo-collapse-content-item[^']*'[^>]*title='([^']*)'/g;
    var teamMatch;
    while ((teamMatch = teamRe.exec(content))) {
      rows.push({ name: util.decodeEntities(teamMatch[1]), league: league });
    }
  }
  return rows;
}

/** Detalle de un álbum: galería, título y descripción. */
function parseAlbum(html) {
  var images = [];
  var seen = {};
  var re = /data-origin-src="(https:\/\/photo\.yupoo\.com\/[^"]+)"/g;
  var match;
  while ((match = re.exec(html))) {
    var path = match[1].replace('https://photo.yupoo.com', '');
    if (!seen[path]) {
      seen[path] = true;
      images.push(path);
    }
  }

  if (!images.length) {
    var og = html.match(/<meta property="og:image" content="([^"]+)"/);
    if (og) {
      var p = og[1].replace('https://photo.yupoo.com', '');
      images.push(p);
    }
  }

  var titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
  var descMatch = html.match(/<div class="showalbumheader__gallerydescription[^"]*">([\s\S]*?)<\/div>/);

  return {
    title: titleMatch ? util.decodeEntities(titleMatch[1]).split(' | ')[0] : '',
    description: descMatch ? util.decodeEntities(descMatch[1].replace(/<[^>]+>/g, ' ')).trim() : '',
    images: images
  };
}

module.exports = {
  BASE: BASE,
  SOURCES: SOURCES,
  USER_AGENT: USER_AGENT,
  IMAGE_REFERER: IMAGE_REFERER,
  request: request,
  fetchText: fetchText,
  fetchBuffer: fetchBuffer,
  fetchWithRetries: fetchWithRetries,
  parsePageCount: parsePageCount,
  parseListing: parseListing,
  parseSidebar: parseSidebar,
  parseAlbum: parseAlbum
};
