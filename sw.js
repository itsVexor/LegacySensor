const CACHE='legacy-sensor-v1.5.0';
const CORE=['./webapp.html','./manifest.webmanifest','./assets/icons/LegacySensor-180.png','./assets/icons/LegacySensor-167.png','./assets/icons/LegacySensor-152.png','./assets/icons/LegacySensor-120.png','./assets/icons/LegacySensor-192.png','./assets/icons/LegacySensor-512.png','./assets/icons/LegacySensor-1024.png','./assets/icons/favicon.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(cache=>cache.put(e.request,copy)).catch(()=>{});return r}).catch(()=>c))) });
