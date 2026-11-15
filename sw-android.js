// WebApp IOS & Android - minimal pass-through service worker.
// It only makes Chrome treat the page as an installable app. It never caches anything,
// so it can never serve a stale copy of the web app.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
