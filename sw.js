self.addEventListener('install', (e) => {
  console.log('Gullas PWA Instalado');
});
self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request));
});
