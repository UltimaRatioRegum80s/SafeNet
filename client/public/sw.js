const CACHE_VERSION = 'nabornet-v2.1.1';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;

const AUTH_ROUTES = [
  '/api/auth/',
  '/api/session',
  '/api/users/me',
  '/api/users/profile',
  '/api/admin/',
  '/api/moderation/'
];

const EXCLUDED_ROUTES = [
  '/api/auth/',
  '/api/session',
  '/api/users/me', 
  '/api/users/profile',
  '/api/admin/',
  '/api/moderation/',
  '/api/uploads',
  '/api/push-subscriptions'
];

const CACHEABLE_API_ROUTES = [
  '/api/incidents'
];

function shouldExcludeFromCache(url) {
  const pathname = new URL(url).pathname;
  return EXCLUDED_ROUTES.some(route => pathname.startsWith(route));
}

function isCacheableApiRoute(url) {
  const pathname = new URL(url).pathname;
  return CACHEABLE_API_ROUTES.some(route => pathname.startsWith(route));
}

function isStaticAsset(url) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(url);
}

function isMapTile(url) {
  const hostname = new URL(url).hostname;
  return hostname.includes('tile') || 
         hostname.includes('openstreetmap') || 
         hostname.includes('cartodb') ||
         hostname.includes('mapbox') ||
         hostname.includes('stadia');
}

self.addEventListener('install', (event) => {
  console.log('[SW] Installing NaborNet service worker v2.1.1');
  
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => {
        return cache.addAll([
          '/',
          '/manifest.json'
        ]);
      })
      .then(() => {
        console.log('[SW] Shell cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Install failed:', error);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating NaborNet service worker');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('nabornet-') && !name.startsWith(CACHE_VERSION))
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activated');
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  if (request.method !== 'GET') {
    return;
  }
  
  if (isMapTile(request.url)) {
    return;
  }
  
  if (url.origin !== self.location.origin) {
    return;
  }
  
  if (shouldExcludeFromCache(request.url)) {
    return;
  }
  
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200 && !response.headers.get('set-cookie')) {
            const responseClone = response.clone();
            caches.open(SHELL_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              return caches.match('/');
            });
        })
    );
    return;
  }
  
  if (isStaticAsset(request.url)) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            fetch(request).then((response) => {
              if (response.status === 200) {
                caches.open(STATIC_CACHE).then((cache) => {
                  cache.put(request, response);
                });
              }
            }).catch(() => {});
            return cachedResponse;
          }
          
          return fetch(request)
            .then((response) => {
              if (response.status === 200) {
                const responseClone = response.clone();
                caches.open(STATIC_CACHE).then((cache) => {
                  cache.put(request, responseClone);
                });
              }
              return response;
            });
        })
    );
    return;
  }
  
  if (isCacheableApiRoute(request.url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200 && !response.headers.get('set-cookie')) {
            const responseClone = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                console.log('[SW] Serving cached API response for:', request.url);
                return cachedResponse;
              }
              return new Response(JSON.stringify({ error: 'Offline', cached: false }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
              });
            });
        })
    );
    return;
  }
  
  event.respondWith(
    fetch(request)
      .catch(() => caches.match(request))
  );
});

self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data?.type === 'CLEAR_CACHES') {
    console.log('[SW] Clearing all caches for logout');
    event.waitUntil(
      caches.keys()
        .then((cacheNames) => {
          return Promise.all(
            cacheNames
              .filter((name) => name.startsWith('nabornet-'))
              .map((name) => caches.delete(name))
          );
        })
        .then(() => {
          console.log('[SW] All NaborNet caches cleared');
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({ success: true });
          }
        })
    );
  }
  
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

console.log('[SW] NaborNet service worker loaded');
