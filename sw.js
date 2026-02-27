const CACHE_NAME = 'expense-pro-v28';
const ASSETS = [
  '/',
  '/index.html',
  '/entry.html',
  '/reports.html',
  '/summary.html',
  '/login.html',
  '/profile.html',
  '/tailor_entry.html',
  '/tailor_list.html',
  '/assets/css/style.css',
  '/assets/css/entry.css',
  '/assets/css/list.css',
  '/assets/css/summary.css',
  '/assets/js/config.js',
  '/assets/js/index.js',
  '/assets/js/entry.js',
  '/assets/js/reports.js',
  '/assets/js/summary.js',
  '/assets/js/auth.js',
  '/assets/js/sidebar.js',
  '/assets/js/offline.js',
  '/assets/js/notifications.js',
  '/assets/js/tailor_entry.js',
  '/assets/js/tailor_list.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(err => {
        console.log('Cache addAll error:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.startsWith('blob:') || 
      event.request.url.includes('supabase') ||
      event.request.url.includes('cdn.jsdelivr.net') ||
      event.request.url.includes('cdnjs.cloudflare.com') ||
      event.request.url.includes('fonts.googleapis.com')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => {
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
