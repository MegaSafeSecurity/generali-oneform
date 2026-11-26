// Network-first for the app shell (so upgrades are never stuck behind an old cache), cache-first for static assets.
const CACHE = 'oneform-shell-v5';
const SHELL = ['/', '/styles.css', '/app.js', '/liquid-nav.js', '/manifest.webmanifest', '/assets/generali-logo.png', '/assets/generali-mark.png'];
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {}))); });
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  // Never cache the API, tokenised URLs, or PDFs (customer/agent documents).
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname.endsWith('.pdf')) return;
  const isShell = e.request.mode === 'navigate' || /\.(html|js|css|webmanifest)$/.test(u.pathname) || u.pathname === '/';
  const store = (r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return r; };
  e.respondWith(isShell
    ? fetch(e.request).then(store).catch(() => caches.match(e.request).then((c) => c || caches.match('/')))
    : caches.match(e.request).then((c) => c || fetch(e.request).then(store)));
});
