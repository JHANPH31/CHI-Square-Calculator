// Service Worker for Chi-Square Calculator PWA
const CACHE_NAME = 'chi-square-calculator-v1.2';
const APP_VERSION = '1.2';

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
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;
  
  const requestUrl = new URL(event.request.url);
  
  // Handle different types of requests
  if (requestUrl.pathname.endsWith('.html') || event.request.destination === 'document') {
    // For HTML pages: Network first, then cache
    event.respondWith(networkFirstStrategy(event.request));
  } else if (event.request.destination === 'image' || 
             requestUrl.pathname.match(/\.(png|jpg|jpeg|gif|svg)$/)) {
    // For images: Cache first, then network
    event.respondWith(cacheFirstStrategy(event.request));
  } else if (requestUrl.hostname.includes('cdnjs.cloudflare.com') ||
             requestUrl.hostname.includes('cdn.jsdelivr.net')) {
    // For CDN resources: Cache first with network fallback
    event.respondWith(cacheFirstStrategy(event.request));
  } else {
    // For other resources: Network first with cache fallback
    event.respondWith(networkFirstStrategy(event.request));
  }
});

// Cache First Strategy (for static assets)
function cacheFirstStrategy(request) {
  return caches.match(request).then(cachedResponse => {
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return fetch(request).then(networkResponse => {
      if (networkResponse && networkResponse.status === 200) {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseClone);
        });
      }
      return networkResponse;
    }).catch(() => {
      if (request.destination === 'image') {
        return caches.match('/CHI-Square-Calculator/CHIlogo.png');
      }
      return new Response('Offline - No network connection', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
      });
    });
  });
}

// Network First Strategy (for HTML and dynamic content)
function networkFirstStrategy(request) {
  return fetch(request)
    .then(networkResponse => {
      if (networkResponse && networkResponse.status === 200) {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseClone);
        });
      }
      return networkResponse;
    })
    .catch(() => {
      return caches.match(request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        if (request.destination === 'document') {
          return caches.match('/CHI-Square-Calculator/index.html');
        }
        
        return new Response('You are offline and this resource is not cached.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        });
      });
    });
}

// Handle service worker updates
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Handle push notifications (optional feature)
self.addEventListener('push', event => {
  if (!event.data) return;
  
  const data = event.data.text();
  const options = {
    body: data || 'Chi-Square Calculator Update',
    icon: '/CHI-Square-Calculator/CHIlogo.png',
    badge: '/CHI-Square-Calculator/CHIlogo.png',
    vibrate: [100, 50, 100],
    data: {
      url: '/CHI-Square-Calculator/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification('Chi-Square Calculator', options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        for (let client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/CHI-Square-Calculator/');
        }
      })
  );
});
