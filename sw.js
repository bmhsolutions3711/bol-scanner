const CACHE = 'bol-scanner-v4';
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
         // Reload any open window onto the fresh shell — heals clients whose cached
         // index.html predates the auto-reload handler (so ONE reopen is enough).
         .then(() => self.clients.matchAll({ type: 'window' }))
         .then(clients => clients.forEach(c => { try { c.navigate(c.url); } catch (_) {} }))
    );
});

self.addEventListener('fetch', (e) => {
    // API calls always go to network
    if (e.request.url.includes('/api/')) return;

    // Network-first for the app shell (navigations / index.html) so UI changes
    // propagate WITHOUT a cache-version bump. Cache-first on index.html is exactly
    // what froze the 4-load picker dropdown on stale clients (bug 2026-06-23).
    const isShell = e.request.mode === 'navigate' || e.request.url.includes('index.html');
    if (isShell) {
        e.respondWith(
            fetch(e.request).then(resp => {
                const clone = resp.clone();
                caches.open(CACHE).then(c => c.put('./index.html', clone));
                return resp;
            }).catch(() => caches.match('./index.html').then(c => c || caches.match('./')))
        );
        return;
    }

    // Cache-first for heavy static assets (OpenCV.js, jspdf), network fallback.
    e.respondWith(
        caches.match(e.request).then(cached => {
            if (cached) return cached;
            return fetch(e.request).then(response => {
                if (response.ok && LAZY_CACHE.some(url => e.request.url.includes(url))) {
                    const clone = response.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone));
                }
                return response;
            });
        })
    );
});
