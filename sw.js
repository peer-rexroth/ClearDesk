const CACHE_NAME = 'cleardesk-cache-v3';
const APP_SHELL = [
  'cleardesk.html',
  'manifest.json',
  'icons/favicon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-180.png',
  'icons/icon-maskable-512.png',
];

// What the last page navigation was served from, so the page can tell which copy of the app it is running (the page asks with {type:'nav-stamp'}). Kept in memory and in the
// cache (the worker is stopped and restarted often). 'cache' means the saved copy was used because the server could not be reached: that page may be out of date.
const META_KEY = 'cleardesk-last-nav';
let lastNav = null;
const stampOf = (h) => h.get('etag') || h.get('last-modified') || h.get('content-length') || '';
function remember(res, source) {
  lastNav = { stamp: stampOf(res.headers), source };
  caches.open(CACHE_NAME).then((c) => c.put(META_KEY, new Response(JSON.stringify(lastNav)))).catch(() => {});
}

self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'nav-stamp' || !event.source) return;
  const reply = (info) => event.source.postMessage({ type: 'nav-stamp', stamp: info.stamp || '', source: info.source || '' });
  if (lastNav) { reply(lastNav); return; }
  event.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.match(META_KEY)).then((r) => (r ? r.json() : {})).catch(() => ({})).then(reply)
  );
});

self.addEventListener('install', (event) => {
  // cache.addAll() is all-or-nothing — one failed request (a CDN hiccup, an
  // extension blocking cdnjs, a slow connection) would reject the whole
  // install and leave the service worker never activated, silently
  // disabling offline support entirely. Cache each entry independently so a
  // single failure only loses that one resource instead of all of them.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(APP_SHELL.map((url) =>
        cache.add(url).catch((err) => console.warn('cleardesk sw: failed to precache', url, err))
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Page navigations: prefer a fresh copy, fall back to cache when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      // no-cache: always revalidate with the server — the plain dev server sends no cache headers, so Chrome's HTTP cache
      // would otherwise keep handing back an old cleardesk.html after an edit.
      fetch(req.url, { cache: 'no-cache' })
        .then((res) => {
          remember(res, 'network');
          const copy = res.clone();   // clone before returning: cloning later races the page reading the body
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('cleardesk.html')).then((cached) => {
          if (cached) remember(cached, 'cache');
          return cached;
        }))
    );
    return;
  }

  // Everything else (icons, fonts, CSS): serve from cache first, refresh in the background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
