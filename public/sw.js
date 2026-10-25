// Esau's Trails service worker.
// - App shell: same-origin GETs are served stale-while-revalidate so the app opens with no service.
// - Map tiles: served from any saved offline area first ("esau-area-*" caches), then the network.
const SHELL = 'esau-shell-v1';
const TILE_HOSTS = ['server.arcgisonline.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/', '/index.html', '/manifest.webmanifest', '/icon.svg'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (TILE_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(req.url, { ignoreVary: true }).then((hit) => hit || fetch(req)),
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(SHELL).then(async (cache) => {
        const key = req.mode === 'navigate' ? '/index.html' : req;
        const cached = await cache.match(key);
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(key, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});
