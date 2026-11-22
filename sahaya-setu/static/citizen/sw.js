/* Offline support: the app itself always opens from the phone; data requests try the network first. */
const VERSION = 'sahaya-citizen-v3';
const SHELL = [
  '/citizen/', '/citizen/index.html', '/citizen/app.js', '/citizen/citizen.css', '/citizen/manifest.webmanifest',
  '/citizen/icon-192.png', '/shared/base.css', '/shared/icon.svg', '/vendor/qrcode.js', '/vendor/jsQR.js',
  '/shared/fonts/hind-guntur-telugu-400-normal.woff2', '/shared/fonts/hind-guntur-telugu-600-normal.woff2',
  '/shared/fonts/hind-guntur-telugu-700-normal.woff2', '/shared/fonts/hind-guntur-latin-400-normal.woff2',
  '/shared/fonts/hind-guntur-latin-600-normal.woff2', '/shared/fonts/hind-guntur-latin-700-normal.woff2',
];
const CACHED_DATA = ['/app/config', '/geo/places', '/alerts/active', '/track/'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('sahaya-citizen') && k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // reports and SOS are queued by the app itself
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (CACHED_DATA.some((p) => url.pathname.startsWith(p))) {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || new Response(JSON.stringify({ detail: 'offline' }),
      { status: 503, headers: { 'content-type': 'application/json' } }))));
    return;
  }
  if (SHELL.includes(url.pathname) || url.pathname.startsWith('/shared/') || url.pathname.startsWith('/vendor/')) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    }));
  }
});
