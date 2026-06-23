// Model Launch Dashboard — Service Worker
// Scope: caches only the static app shell (this file's own HTML, manifest,
// icons) so the dashboard is installable and can cold-start offline.
// Deliberately does NOT cache or intercept Firebase/Firestore/Google API
// requests — those already have their own offline persistence
// (db.enablePersistence in index.html), and letting this worker cache them
// too would risk serving stale auth/data state instead of the real thing.

const CACHE_NAME = 'mld-shell-v1';
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests for the shell itself. Everything
  // else (Firebase Auth, Firestore, Google APIs, the Sora font, the XLSX
  // CDN script, etc.) passes straight through to the network untouched.
  const isShellRequest =
    event.request.method === 'GET' &&
    url.origin === self.location.origin &&
    (url.pathname.endsWith('/') ||
     url.pathname.endsWith('index.html') ||
     url.pathname.endsWith('manifest.json') ||
     url.pathname.includes('/icons/'));

  if (!isShellRequest) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      // Cache-first for instant offline load, but refresh the cache in the
      // background so the next load picks up dashboard updates.
      const network = fetch(event.request).then(response => {
        if (response && response.ok) {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
