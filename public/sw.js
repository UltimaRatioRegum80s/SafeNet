// NaborNet Service Worker for Push Notifications

self.addEventListener('push', (event) => {
  console.log('🔔 Push notification received:', event);
  
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    console.error('❌ Invalid push payload:', error);
    data = { title: 'NaborNet', body: 'New incident reported in your area' };
  }

  const {
    title = 'NaborNet',
    body = 'New incident reported in your area',
    tag = 'nabornet-incident',
    link = '/community/map',
    icon = '/icons/icon-192.png',
    badge = '/icons/badge.png'
  } = data;

  const options = {
    body,
    tag, // Prevents duplicate notifications
    icon,
    badge,
    data: { link },
    requireInteraction: tag.includes('critical'), // Keep critical alerts visible
    vibrate: tag.includes('critical') ? [200, 100, 200] : [100],
    actions: [
      {
        action: 'view',
        title: 'View on Map',
        icon: '/icons/map-icon.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icons/dismiss-icon.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('🖱️ Notification clicked:', event);
  
  event.notification.close();

  const url = event.notification.data?.link || '/community/map';
  
  // Handle action clicks
  if (event.action === 'dismiss') {
    return; // Just close the notification
  }

  // Default action or 'view' action - open the app
  event.waitUntil(
    clients.matchAll({ 
      type: 'window', 
      includeUncontrolled: true 
    }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Navigate to the incident and focus the existing window
          client.navigate(url);
          return client.focus();
        }
      }
      
      // Open new window if app isn't open
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('🔕 Notification closed:', event.notification.tag);
  
  // Optional: Send analytics about notification dismissal
  // analytics.track('notification_dismissed', { tag: event.notification.tag });
});

// Background sync for when push notifications are received while offline
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-incidents') {
    event.waitUntil(syncIncidents());
  }
});

async function syncIncidents() {
  try {
    // Sync any cached incidents when back online
    console.log('🔄 Syncing incidents in background...');
    // Implementation would sync cached data
  } catch (error) {
    console.error('❌ Background sync failed:', error);
  }
}

// Install event - cache essential resources
self.addEventListener('install', (event) => {
  console.log('⚙️ Service Worker installing...');
  
  event.waitUntil(
    caches.open('nabornet-v9-stable').then((cache) => {
      return cache.addAll([
        '/',
        '/community/map',
        '/icons/icon-192.png',
        '/icons/badge.png'
      ]).catch((error) => {
        console.error('❌ Cache failed during install:', error);
      });
    })
  );
  
  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activated');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== 'nabornet-v9-stable') {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  self.clients.claim(); // Take control of all clients
});