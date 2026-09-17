/* Service worker for the Daily Site Safety Inspection Checklist.
   Two jobs:
   1. Make the app installable to the Android home screen (Chrome requires
      a service worker with a fetch handler for this).
   2. Let the app open and work with no internet — important on site, where
      signal is often poor. Your inspections are stored on the device
      anyway, so once the app shell is cached there's nothing it needs the
      network for until you sync or send an approval.

   Bump CACHE_VERSION whenever you upload a new index.html, so phones pick
   up the new version instead of serving the old cached one. */
const CACHE_VERSION = 'ksbpl-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
];

self.addEventListener('install', (event) => {
  // Take over immediately rather than waiting for every tab to close.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // Don't let one failed file (e.g. a missing icon) abort the whole
      // install — cache what we can.
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GETs from our own origin. Anything else — the jsPDF CDN,
  // and especially API calls to the backend — must go straight to the
  // network, never to a cache. Serving a stale approval record from cache
  // would be worse than failing outright.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  // Network-first for the app itself, so you always get the latest version
  // when you have signal, and the cached copy when you don't.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || caches.match('./index.html'))
      )
  );
});
