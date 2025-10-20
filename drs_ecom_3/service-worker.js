const CACHE_NAME = 'shopapp-cache-v2';
const OFFLINE_URLS = [
  './',
  './index.html',
  './manifest.json'
  // add other assets you serve (css, js, image placeholders)
];

self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => { if(k !== CACHE_NAME) return caches.delete(k); })))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evt) => {
  // simple cache-first for navigation and assets
  const req = evt.request;
  // attempt network first for Google Sheets JSONP to get fresh data
  if(req.url.includes('docs.google.com')) {
    evt.respondWith(fetch(req).catch(()=> caches.match(req)));
    return;
  }
  evt.respondWith(
    caches.match(req).then(match => {
      return match || fetch(req).then(res => {
        // cache GET requests for same-origin static assets
        if(req.method === 'GET' && req.url.startsWith(self.location.origin)) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return res;
      }).catch(()=> {
        // fallback: if navigation and offline, return cached index.html
        if(req.mode === 'navigate') return caches.match('./');
      });
    })
  );
});

