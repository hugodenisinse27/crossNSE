const CACHE_NAME = 'cross-nse-2026-pwa-v1';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const SCANNER_CDN = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    // Précharge le scanner tant qu'Internet est disponible afin de pouvoir l'utiliser ensuite hors ligne.
    try {
      const response = await fetch(SCANNER_CDN, { mode: 'cors', cache: 'reload' });
      if (response.ok) await cache.put(SCANNER_CDN, response.clone());
    } catch (e) {
      // La première installation doit se faire en ligne pour que le scanner soit mis en cache.
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('cross-nse-2026-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin || request.url === SCANNER_CDN) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, { ignoreSearch: false });
      if (cached) {
        // Mise à jour en arrière-plan pour le contenu hébergé sur le même domaine.
        if (url.origin === self.location.origin) event.waitUntil(fetch(request).then(r => { if (r.ok) return cache.put(request, r.clone()); }).catch(() => {}));
        return cached;
      }
      try {
        const response = await fetch(request);
        if (response.ok || response.type === 'opaque') await cache.put(request, response.clone());
        return response;
      } catch (e) {
        if (request.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
        return Response.error();
      }
    })());
  }
});
