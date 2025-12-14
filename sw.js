// Service Worker for Chi-Square Calculator PWA
const APP_VERSION = 'chi-square-calc-v3.0';
const CACHE_NAMES = {
  STATIC: `static-cache-${APP_VERSION}`,
  DYNAMIC: `dynamic-cache-${APP_VERSION}`,
  EXTERNAL: `external-cache-${APP_VERSION}`
};

// Core app assets - these are cached on install
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './sw.js',
  './CHIlogo.png',
  './chiLAPPYY.png',
  './chiPHONEE.png'
];

// External resources we want to cache
const EXTERNAL_RESOURCES = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js@4.3.0/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

// ========== INSTALL EVENT ==========
self.addEventListener('install', (event) => {
  console.log(`[Service Worker] Installing version: ${APP_VERSION}`);
  
  event.waitUntil(
    Promise.all([
      // Cache core assets
      caches.open(CACHE_NAMES.STATIC)
        .then(cache => {
          console.log('[Service Worker] Caching core assets');
          return cache.addAll(CORE_ASSETS).catch(error => {
            console.warn('[Service Worker] Failed to cache some assets:', error);
            // Continue even if some assets fail
          });
        }),
      
      // Cache external resources
      caches.open(CACHE_NAMES.EXTERNAL)
        .then(cache => {
          console.log('[Service Worker] Caching external resources');
          return Promise.all(
            EXTERNAL_RESOURCES.map(url => 
              fetch(url)
                .then(response => {
                  if (response.ok) {
                    return cache.put(url, response);
                  }
                  console.warn(`[Service Worker] Failed to fetch: ${url}`);
                })
                .catch(error => {
                  console.warn(`[Service Worker] Error caching ${url}:`, error);
                })
            )
          );
        })
    ])
    .then(() => {
      console.log('[Service Worker] Installation completed');
      return self.skipWaiting(); // Activate immediately
    })
    .catch(error => {
      console.error('[Service Worker] Installation failed:', error);
    })
  );
});

// ========== ACTIVATE EVENT ==========
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys()
        .then(cacheNames => {
          return Promise.all(
            cacheNames.map(cacheName => {
              if (!Object.values(CACHE_NAMES).includes(cacheName)) {
                console.log(`[Service Worker] Deleting old cache: ${cacheName}`);
                return caches.delete(cacheName);
              }
            })
          );
        }),
      
      // Claim all clients
      self.clients.claim()
    ])
    .then(() => {
      console.log('[Service Worker] Activated and ready');
      
      // Notify all clients that SW is ready
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_READY',
            version: APP_VERSION
          });
        });
      });
    })
    .catch(error => {
      console.error('[Service Worker] Activation failed:', error);
    })
  );
});

// ========== FETCH EVENT ==========
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Handle different types of requests
  event.respondWith(
    handleFetch(event).catch(error => {
      console.error('[Service Worker] Fetch handler error:', error);
      return createOfflineResponse(request);
    })
  );
});

// Main fetch handler
async function handleFetch(event) {
  const { request } = event;
  const url = new URL(request.url);
  
  // 1. Check cache first for core assets
  const cachedResponse = await checkCache(request);
  if (cachedResponse && !isHtmlRequest(request)) {
    // For non-HTML resources, return cached version and update in background
    event.waitUntil(updateCache(request));
    return cachedResponse;
  }
  
  try {
    // 2. Try network request
    const networkResponse = await fetch(request);
    
    // If successful, cache and return
    if (networkResponse.ok) {
      await cacheResponse(request, networkResponse.clone());
      return networkResponse;
    }
    
    // If network failed but we have cache, return cached
    if (cachedResponse) return cachedResponse;
    
    // Otherwise return network response (even if error)
    return networkResponse;
    
  } catch (error) {
    // Network failed - try to return from cache
    if (cachedResponse) return cachedResponse;
    
    // Special handling for HTML requests
    if (isHtmlRequest(request)) {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    
    throw error; // Propagate error to outer catch
  }
}

// ========== CACHE HELPERS ==========
async function checkCache(request) {
  // Check all caches
  for (const cacheName of Object.values(CACHE_NAMES)) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
  }
  return null;
}

async function cacheResponse(request, response) {
  // Determine which cache to use
  const url = new URL(request.url);
  let cacheName;
  
  if (url.origin === self.location.origin) {
    cacheName = CACHE_NAMES.STATIC;
  } else if (EXTERNAL_RESOURCES.some(res => request.url.includes(new URL(res).hostname))) {
    cacheName = CACHE_NAMES.EXTERNAL;
  } else {
    cacheName = CACHE_NAMES.DYNAMIC;
  }
  
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
    console.log(`[Service Worker] Cached: ${request.url}`);
  } catch (error) {
    console.warn(`[Service Worker] Failed to cache ${request.url}:`, error);
  }
}

async function updateCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cacheResponse(request, response.clone());
    }
  } catch (error) {
    // Silently fail - we have offline fallback
  }
}

// ========== REQUEST TYPE CHECKS ==========
function isHtmlRequest(request) {
  return request.headers.get('Accept')?.includes('text/html') ||
         request.destination === 'document' ||
         request.mode === 'navigate';
}

// ========== OFFLINE RESPONSE ==========
function createOfflineResponse(request) {
  if (isHtmlRequest(request)) {
    return caches.match('./index.html')
      .then(response => response || new Response(
        '<!DOCTYPE html><html><head><title>Offline</title></head><body><h1>You are offline</h1><p>Please check your internet connection and try again.</p></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      ));
  }
  
  return new Response(
    JSON.stringify({
      error: 'Network error',
      message: 'You are offline and this resource is not cached.',
      offline: true
    }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

// ========== MESSAGE HANDLING ==========
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Received message:', event.data);
  
  const { type, data } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches()
        .then(() => {
          event.ports?.[0]?.postMessage({ success: true });
          event.source?.postMessage({ type: 'CACHE_CLEARED' });
        })
        .catch(error => {
          event.ports?.[0]?.postMessage({ success: false, error });
        });
      break;
      
    case 'GET_CACHE_INFO':
      getCacheInfo()
        .then(info => {
          event.source?.postMessage({
            type: 'CACHE_INFO',
            data: info
          });
        });
      break;
      
    case 'UPDATE_AVAILABLE':
      // Force update by deleting caches and reloading
      event.waitUntil(
        clearAllCaches()
          .then(() => self.skipWaiting())
      );
      break;
      
    case 'CHECK_UPDATE':
      // Check for updates by comparing versions
      event.source?.postMessage({
        type: 'UPDATE_STATUS',
        data: {
          currentVersion: APP_VERSION,
          updateAvailable: false
        }
      });
      break;
  }
});

// ========== CACHE MANAGEMENT ==========
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  console.log('[Service Worker] All caches cleared');
}

async function getCacheInfo() {
  const cacheNames = await caches.keys();
  const info = {};
  
  for (const name of cacheNames) {
    const cache = await caches.open(name);
    const requests = await cache.keys();
    info[name] = {
      size: requests.length,
      urls: requests.map(req => req.url)
    };
  }
  
  return info;
}

// ========== BACKGROUND SYNC ==========
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-calculations') {
    console.log('[Service Worker] Background sync for calculations');
    event.waitUntil(syncCalculations());
  }
});

async function syncCalculations() {
  console.log('[Service Worker] Syncing in background...');
  
  try {
    // Refresh external resources
    for (const url of EXTERNAL_RESOURCES) {
      try {
        const response = await fetch(url, { cache: 'no-cache' });
        if (response.ok) {
          const cache = await caches.open(CACHE_NAMES.EXTERNAL);
          await cache.put(url, response.clone());
          console.log(`[Service Worker] Refreshed: ${url}`);
        }
      } catch (error) {
        console.warn(`[Service Worker] Failed to sync ${url}:`, error);
      }
    }
    
    return Promise.resolve('Sync completed');
  } catch (error) {
    console.error('[Service Worker] Background sync failed:', error);
    return Promise.reject(error);
  }
}

// ========== PUSH NOTIFICATIONS ==========
self.addEventListener('push', (event) => {
  let data = {
    title: 'Chi-Square Calculator',
    body: 'New update available!',
    icon: './chiPHONEE.png',
    badge: './CHIlogo.png'
  };
  
  if (event.data) {
    try {
      data = { ...data, ...JSON.parse(event.data.text()) };
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    vibrate: [100, 50, 100],
    data: {
      url: data.url || self.location.origin,
      timestamp: Date.now()
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || self.location.origin;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Focus existing tab or open new one
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

