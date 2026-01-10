const CACHE_NAME = 'expense-pro-v1';
const ASSETS = [
  'index.html',
  'entry.html',
  'reports.html',
  'login.html',
  'profile.html',
  'assets/css/style.css',
  'assets/css/entry.css',
  'assets/css/list.css',
  'assets/js/config.js',
  'assets/js/index.js',
  'assets/js/entry.js',
  'assets/js/reports.js',
  'assets/js/auth.js',
  'assets/js/sidebar.js'
];

// ইনস্টল করার সময় ফাইলগুলো ক্যাশ করা
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
    // পিডিএফ বা ব্লব ইউআরএল গুলোকে ক্যাশ থেকে বাদ দেওয়া (যাতে ডাউনলোড এরর না হয়)
    if (event.request.url.startsWith('blob:') || event.request.url.includes('supabase')) {
        return; 
    }
    
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});