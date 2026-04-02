const CACHE_NAME = 'gullas-multi-v1';
const assets = ['./Indexadm.html', './Indexloja.html', './manifest-adm.json', './manifest-loja.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(assets)));
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
