const CACHE_NAME = 'chi-square-calculator-v2.0';
const STATIC_CACHE = 'static-v2';
const DYNAMIC_CACHE = 'dynamic-v2';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

const EXTERNAL_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

// Install event - Cache static assets
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...', CACHE_NAME);
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] All static assets cached');
        return self.skipWaiting();
      })
      .catch(error => {
        console.log('[Service Worker] Installation failed:', error);
      })
  );
});

// Activate event - Clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete old caches
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('[Service Worker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - Stale-While-Revalidate strategy
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and browser extensions
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  
  // Handle external CDN resources
  if (url.hostname.includes('cdnjs.cloudflare.com') || 
      url.hostname.includes('cdn.jsdelivr.net')) {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        // Return cached version immediately, then update cache
        const fetchPromise = fetch(request).then(networkResponse => {
          // Update cache with fresh version
          caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(request, networkResponse.clone());
          });
          return networkResponse;
        });
        
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
  
  // For same-origin requests
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        // Always try network first for HTML pages
        if (request.headers.get('Accept').includes('text/html')) {
          return fetch(request)
            .then(networkResponse => {
              // Update cache
              return caches.open(DYNAMIC_CACHE).then(cache => {
                cache.put(request, networkResponse.clone());
                return networkResponse;
              });
            })
            .catch(() => {
              // If network fails, return cached version
              return cachedResponse || caches.match('./index.html');
            });
        }
        
        // For other resources, return cached if available
        if (cachedResponse) {
          // Update cache in background
          fetch(request).then(networkResponse => {
            caches.open(DYNAMIC_CACHE).then(cache => {
              cache.put(request, networkResponse.clone());
            });
          }).catch(() => {}); // Ignore fetch errors
          return cachedResponse;
        }
        
        // Not in cache, fetch from network
        return fetch(request).then(networkResponse => {
          // Cache the new resource
          return caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        }).catch(error => {
          console.log('[Service Worker] Fetch failed:', error);
          
          // If it's a page request, return the main page
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          
          // For other requests, return a generic offline response
          return new Response('Offline content not available', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
    );
    return;
  }
});

// Handle messages from the client
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }
});

// Background sync for offline data (optional enhancement)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    console.log('[Service Worker] Background sync triggered');
    event.waitUntil(syncData());
  }
});

async function syncData() {
  // You can implement background data sync here
  console.log('[Service Worker] Syncing data in background');
}
