'use strict';

var CACHE_NAME = 'kangteam-shell-v20261116-08';
var SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/placeholder.svg',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL_ASSETS).catch(function () {});
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (!req || req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache dynamic admin/tracking/order/sync API responses
  if (url.pathname.indexOf('/api/') === 0 && url.pathname !== '/api/catalog' && url.pathname !== '/api/team-logos') {
    return;
  }

  // Network-first for HTML & catalog/config APIs
  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html' || url.pathname.indexOf('/api/') === 0) {
    event.respondWith(
      fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); }).catch(function () {});
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || caches.match('/');
        });
      })
    );
    return;
  }

  // Stale-while-revalidate for static assets & images
  if (url.pathname.indexOf('/css/') === 0 || url.pathname.indexOf('/js/') === 0 || url.pathname.indexOf('/img/') === 0 || /\.(png|svg|jpg|jpeg|webp|ico|webmanifest)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        var netFetch = fetch(req).then(function (res) {
          if (res && res.status === 200) {
            var copy = res.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); }).catch(function () {});
          }
          return res;
        }).catch(function () {
          return cached;
        });
        return cached || netFetch;
      })
    );
  }
});
