// Cache para que la app abra sin internet una vez instalada.
const CACHE = 'comite-aps-v185';
const ARCHIVOS = ['./','index.html','css/styles.css?v=185','js/datos.js?v=185','js/data.js?v=185','js/store.js?v=185','js/importer.js?v=185','js/app.js?v=185','js/exportar.js?v=185','js/gestion.js?v=185','js/sim-datos.js?v=185','js/simulador.js?v=185','js/portal.js?v=185','js/inge.js?v=185','img/logo-riopaila.png','img/portada.svg','img/icono-192.png','manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Red primero sin usar la caché HTTP del navegador (GitHub Pages la deja ~10 min),
// así siempre llega lo último publicado; la caché propia solo sirve sin conexión.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const propio = new URL(e.request.url).origin === location.origin;
  const red = propio ? fetch(e.request.url, { cache: 'no-cache' }) : fetch(e.request);
  e.respondWith(
    red.then(r => {
      if (r.ok && propio) {
        const copia = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
      }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: e.request.mode === 'navigate' }))
  );
});
