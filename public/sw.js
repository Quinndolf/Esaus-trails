// Esau's Trails service worker.
// - App shell: every file of the build is precached on install, so "Add to Home Screen" opens with no service.
//   The build stamps BUILD and PRECACHE below (see vite.config.ts); each deploy gets a fresh cache and drops the old one.
// - Pages: network first so a deploy shows up on the next open, falling back to the cached shell.
// - Map tiles: served from any saved offline area first ("esau-area-*" caches), then the network.
// - /api is never cached: Esau and the weather must be live or fail honestly.
const BUILD = 'dev';
const PRECACHE = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];
const SHELL = `esau-shell-${BUILD}`;
const TILE_HOSTS = ['server.arcgisonline.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('esau-shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (TILE_HOSTS.includes(url.hostname)) {
    event.respondWith(caches.match(req.url, { ignoreVary: true }).then((hit) => hit || fetch(req)));
    return;
  }

  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(SHELL).then((c) => c.put('/index.html', res.clone()));
          return res;
        })
        .catch(() => caches.match('/index.html', { cacheName: SHELL })),
    );
    return;
  }

  event.respondWith(
    caches.open(SHELL).then(async (cache) => {
      const cached = await cache.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    }),
  );
});
