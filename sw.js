// Service Worker for Chi-Square Calculator PWA
const CACHE_NAME = 'chi-square-calculator-v1.0';
const APP_VERSION = '1.0';

// Files to cache for offline use
const APP_FILES = [
  '/CHI-Square-Calculator/',
  '/CHI-Square-Calculator/index.html',
  '/CHI-Square-Calculator/manifest.json',
  '/CHI-Square-Calculator/CHIlogo.png',
  '/CHI-Square-Calculator/chiPHONEE.png',
  '/CHI-Square-Calculator/chiLAPPYY.png'
];

// Install event - cache essential files
self.addEventListener('install', event => {
  console.log(`[Service Worker v${APP_VERSION}] Installing...`);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app files');
        return cache.addAll(APP_FILES);
      })
      .then(() => {
        console.log('[Service Worker] Installation complete');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[Service Worker] Cache error:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log(`[Service Worker v${APP_VERSION}] Activating...`);
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('[Service Worker] Activation complete');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve cached files when offline
self.addEventListener('fetch', event => {
  // Skip non-GET requests and browser extensions
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached file if available
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Otherwise fetch from network
        return fetch(event.request)
          .then(networkResponse => {
            // Don't cache external CDN files unless they're critical
            const isLocalFile = event.request.url.includes('jhanph31.github.io');
            const isCriticalCDN = event.request.url.includes('cdnjs.cloudflare.com/ajax/libs/font-awesome');
            
            if ((isLocalFile || isCriticalCDN) && networkResponse.ok) {
              // Cache the response for future use
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
            }
            
            return networkResponse;
          })
          .catch(error => {
            console.log('[Service Worker] Fetch failed, offline:', error);
            
            // For HTML pages, return the cached index.html
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/CHI-Square-Calculator/index.html');
            }
            
            // For missing images, return the app icon
            if (event.request.destination === 'image') {
              return caches.match('/CHI-Square-Calculator/CHIlogo.png');
            }
            
            return new Response('Offline - Network connection required', {
              status: 503,
              statusText: 'Offline',
              headers: new Headers({ 'Content-Type': 'text/plain' })
            });
          });
      })
  );
});

// Handle service worker updates
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
