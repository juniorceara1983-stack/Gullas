const CACHE_NAME = 'gullas-v2';
const ASSETS = [
  './Indexadm.html',
  './Indexloja.html',
  './manifest-adm.json',
  './manifest-loja.json',
  './1774954149094.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Network-first for API calls; cache-first for static assets
  let requestHostname;
  try { requestHostname = new URL(event.request.url).hostname; } catch { requestHostname = ''; }
  if (requestHostname === 'script.google.com') {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
