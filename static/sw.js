const CACHE_VERSION = 'hugo-pico-v4';
const APP_SHELL = [
  './',
  './site.webmanifest',
  './favicon.svg',
  './css/pico/pico.min.css',
  './css/colors.css',
  './css/typography.css',
  './css/layout.css',
  './css/components.css',
  './css/tables.css',
  './css/code.css',
  './css/search.css',
  './css/animations.css',
  './css/themes.css',
  './css/cookie-consent.css',
  './js/main.js',
  './js/vendor/mermaid.min.js',
  './js/search.js',
  './js/kroki.js',
  './js/cookie-consent.js',
  './js/pwa.js',
  './offline/'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => Promise.allSettled(APP_SHELL.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => {
        if (key !== CACHE_VERSION) return caches.delete(key);
        return Promise.resolve();
      })))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.headers.has('range')) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match('./offline/')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => caches.match('./offline/'));
    })
  );
});
