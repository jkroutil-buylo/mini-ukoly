// Mini Úkoly – aplikace se otevře i bez signálu (data jsou uložená v telefonu, změny se dorovnají po připojení).
const CACHE = 'miniukoly-v4';
const SHELL = ['./', 'index.html', 'style.css?v=4', 'config.js?v=4', 'sync.js?v=4', 'app.js?v=4', 'claude.js?v=4', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Vlastní soubory: nejdřív síť (aktualizace), bez sítě z mezipaměti. Google API se necachují.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: false }).then(r => r || caches.match('index.html'))));
});
