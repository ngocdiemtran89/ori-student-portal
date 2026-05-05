const CACHE_NAME = 'ori-portal-v2';
const STATIC_CACHE = ['/', '/index.html', '/dashboard.html', '/register.html', '/js/api.js', '/js/auth.js', '/js/dashboard.js', '/styles/main.css', '/styles/login.css', '/styles/dashboard.css', '/manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_CACHE).catch(err => console.log('Cache warning:', err))));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.hostname.includes('script.google.com')) return;
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request).then(response => {
      if (response.ok && event.request.method === 'GET') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(event.request).then(cached => cached || (event.request.destination === 'document' ? caches.match('/index.html') : undefined)))
  );
});
