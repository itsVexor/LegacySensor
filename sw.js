/* Legacy Sensor website — versioned PWA cache. Never caches Firebase responses. */
const CACHE_NAME = 'legacy-sensor-shell-v1.7.0-release-20261115';
const CORE_ASSETS = [
  './index.html', './troubleshooting.html', './webapp.html',
  './style.css', './pwa-polish.css', './wow-refresh.css', './site-wow-polish.css',
  './site-v17-preview.css', './seasonal.css',
  './script.js', './pwa.js', './seasonal.js',
  './manifest.webmanifest', './lsw2_assets/webapp_w2.css', './lsw2_assets/catalog.json', './lsw2_assets/webapp_w2.js', './lsw4_assets/unified_profile.js', './lsw6_assets/offline_profile.js', './assets/brand/watermark.png',
  './assets/seasonal/halloween-bg.jpg', './assets/seasonal/christmas-bg.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME)
    .then(cache => Promise.allSettled(CORE_ASSETS.map(url => cache.add(url))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('legacy-sensor-shell-') && key !== CACHE_NAME)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Versioned HTML, CSS and JS should be fresh when connected; use saved
  // copies only when genuinely offline. No cached old Halloween layouts.
  const important = request.mode === 'navigate' ||
    /\.(?:html|css|js|webmanifest)$/i.test(url.pathname);
  if (/\.(?:mp4|mp3|webm|mov)$/i.test(url.pathname)) return;
  if (important) {
    event.respondWith(fetch(request).then(response => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
      }
      return response;
    }).catch(async () => (await caches.match(request)) || Response.error()));
    return;
  }
  event.respondWith(caches.match(request).then(cached => {
    if (cached) return cached;
    return fetch(request).then(response => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
      }
      return response;
    });
  }));
});
