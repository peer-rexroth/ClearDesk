const CACHE_NAME = 'mydesk-cache-v6';
const APP_SHELL = [
  'mydesk.html',
  'manifest.json',
  'icons/favicon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  // Font Awesome (CSS + the two font files actually used — solid/regular,
  // see CLAUDE.md) precached explicitly, since it's cross-origin and would
  // otherwise only get cached after a first successful online load, leaving
  // every icon blank if the PWA goes offline before that happens.
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/webfonts/fa-regular-400.woff2'
];

self.addEventListener('install', (event) => {
  // cache.addAll() is all-or-nothing — one failed request (a CDN hiccup, an
  // extension blocking cdnjs, a slow connection) would reject the whole
  // install and leave the service worker never activated, silently
  // disabling offline support entirely. Cache each entry independently so a
  // single failure only loses that one resource instead of all of them.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(APP_SHELL.map((url) =>
        cache.add(url).catch((err) => console.warn('mydesk sw: failed to precache', url, err))
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
      // would otherwise keep handing back an old mydesk.html after an edit.
      fetch(req.url, { cache: 'no-cache' })
        .then((res) => {
          const copy = res.clone();   // clone before returning: cloning later races the page reading the body
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('mydesk.html')))
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
