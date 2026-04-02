// Service Worker Gullas - Permite instalação como App
const CACHE_NAME = 'gullas-v1';
self.addEventListener('install', (e) => {
  console.log('Gullas PWA Instalado');
});
self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request));
});
