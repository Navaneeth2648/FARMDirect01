/* FARMDirect service worker: offline support for the app shell and read-only farm data.
 * - Static assets: cache-first.
 * - Selected GET APIs (farms, crops, advisory, saved items, tasks): network-first, falling back to the last cached copy,
 *   marked with the X-From-Cache header. Writes are never queued offline, so farmer data cannot be overwritten silently.
 */
const SHELL = 'fd-shell-v1';
const DATA = 'fd-data-v1';
const OFFLINE_APIS = ['/api/v1/farms', '/api/v1/cycles', '/api/v1/crops', '/api/v1/advisory', '/api/v1/me/saved', '/api/v1/tasks', '/api/v1/schemes', '/api/v1/dashboard'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/', '/index.html'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => ![SHELL, DATA].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    if (!OFFLINE_APIS.some((p) => url.pathname.startsWith(p))) return;
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(DATA).then((c) => c.put(req, copy)); }
        return res;
      }).catch(async () => {
        const hit = await caches.match(req);
        if (!hit) return new Response(JSON.stringify({ error: 'You are offline and this page has not been saved yet.', code: 'network' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
        const headers = new Headers(hit.headers); headers.set('X-From-Cache', '1');
        return new Response(await hit.blob(), { status: 200, headers });
      }),
    );
    return;
  }

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/index.html')));
    return;
  }

  if (/\.(js|css|woff2?|png|svg|jpg|webp)$/.test(url.pathname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); }
      return res;
    })));
  }
});
