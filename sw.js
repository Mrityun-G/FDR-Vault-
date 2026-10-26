// Offline support for the app shell. Network-first (so updates and config.js changes apply immediately),
// falling back to the cache when offline. API, auth and storage traffic to Supabase is never cached.
const CACHE = 'aicte-inst-v12';
const SHELL = ['./', './index.html', './styles.css', './config.js', './data.js', './backend.js', './i18n.js', './app.js', './guide.js', './manifest.webmanifest',
  './emblem.png', './delhi.webp', './mumbai.webp', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const sameOrigin = url.origin === self.location.origin;
  const staticCdn = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('@supabase/supabase-js@'));
  if (!sameOrigin && !staticCdn) return;           // e.g. *.supabase.co — always straight to the network
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then(hit => hit || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
