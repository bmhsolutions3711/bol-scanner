const CACHE = 'bol-scanner-v3';
const ASSETS = [
    './',
    './index.html',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// OpenCV.js is cached on first use (lazy loaded), not pre-cached
const LAZY_CACHE = [
    'https://docs.opencv.org/4.9.0/opencv.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    // API calls always go to network
    if (e.request.url.includes('/api/')) return;

    // Cache-first for all static assets, with network fallback
    e.respondWith(
        caches.match(e.request).then(cached => {
            if (cached) return cached;

            return fetch(e.request).then(response => {
                // Cache OpenCV.js and other lazy assets on first fetch
                if (response.ok && LAZY_CACHE.some(url => e.request.url.includes(url))) {
                    const clone = response.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone));
                }
                return response;
            });
        })
    );
});
