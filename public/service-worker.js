/**
 * Service Worker for Offline Support and Background Sync
 * Handles offline caching, request queuing, and background sync
 */

const CACHE_NAME = 'delivery-app-v1';
const API_CACHE_NAME = 'delivery-api-v1';
const CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/styles/index.css'
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching essential files');
      return cache.addAll(CACHE_URLS);
    }).then(() => {
      self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      self.clients.claim();
    })
  );
});

// Fetch event - intercept requests and handle offline scenarios
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and api calls for now (handled by app)
  if (request.method !== 'GET') {
    return;
  }

  // For API calls, use network-first strategy with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!response || response.status !== 200) {
            return response;
          }

          // Clone the response and cache it
          const responseToCache = response.clone();
          caches.open(API_CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          // Return cached response if network fails
          return caches.match(request).then((response) => {
            return response || new Response(
              JSON.stringify({
                error: 'Offline - returning cached data if available',
                offline: true
              }),
              {
                status: 503,
                statusText: 'Service Unavailable',
                headers: new Headers({ 'Content-Type': 'application/json' })
              }
            );
          });
        })
    );
    return;
  }

  // For other requests, use cache-first strategy
  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        return response;
      }

      return fetch(request).then((response) => {
        if (!response || response.status !== 200) {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return response;
      });
    })
  );
});

// Background sync - sync pending requests when connection is restored
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Sync event triggered:', event.tag);

  if (event.tag === 'sync-offline-requests') {
    event.waitUntil(
      syncOfflineRequests()
    );
  }
});

// Sync pending offline requests
async function syncOfflineRequests() {
  try {
    console.log('[Sync] Starting background sync of offline requests');

    // Open IndexedDB and get pending requests
    const db = await openDB();
    const pending = await getPendingRequests(db);

    if (pending.length === 0) {
      console.log('[Sync] No pending requests to sync');
      return;
    }

    let synced = 0;
    let failed = 0;

    for (const item of pending) {
      try {
        if (item.retryCount >= item.maxRetries) {
          await updateRequestStatus(db, item.id, 'FAILED');
          failed++;
          continue;
        }

        const response = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body ? JSON.stringify(item.body) : undefined
        });

        if (response.ok) {
          await removeRequest(db, item.id);
          synced++;
          console.log(`[Sync] Successfully synced: ${item.method} ${item.url}`);
        } else {
          await updateRequestStatus(db, item.id, 'RETRY');
          failed++;
        }
      } catch (error) {
        console.error('[Sync] Error syncing request:', error);
        await updateRequestStatus(db, item.id, 'RETRY');
        failed++;
      }
    }

    console.log(`[Sync] Background sync complete - Synced: ${synced}, Failed: ${failed}`);

    // Notify all clients about sync completion
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        data: { synced, failed }
      });
    });
  } catch (error) {
    console.error('[Sync] Background sync error:', error);
    throw error;
  }
}

// IndexedDB operations
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('DeliveryAppDB', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('offlineQueue')) {
        db.createObjectStore('offlineQueue', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

function getPendingRequests(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offlineQueue'], 'readonly');
    const store = transaction.objectStore('offlineQueue');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const items = request.result.filter(i => i.status === 'PENDING');
      resolve(items);
    };
  });
}

function updateRequestStatus(db, id, status) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offlineQueue'], 'readwrite');
    const store = transaction.objectStore('offlineQueue');
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const item = getRequest.result;
      if (item) {
        item.status = status;
        if (status === 'RETRY') {
          item.retryCount = (item.retryCount || 0) + 1;
        }
        const updateRequest = store.put(item);
        updateRequest.onerror = () => reject(updateRequest.error);
        updateRequest.onsuccess = () => resolve();
      } else {
        reject(new Error('Item not found'));
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

function removeRequest(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offlineQueue'], 'readwrite');
    const store = transaction.objectStore('offlineQueue');
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Handle messages from the app
self.addEventListener('message', (event) => {
  const { type } = event.data;

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (type === 'SYNC_NOW') {
    syncOfflineRequests().then((result) => {
      event.ports[0].postMessage({
        type: 'SYNC_RESULT',
        result
      });
    }).catch((error) => {
      event.ports[0].postMessage({
        type: 'SYNC_ERROR',
        error: error.message
      });
    });
  }
});

// Push notification handler
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.message,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: data.tag || 'notification',
      data: {
        url: data.url || '/',
        id: data.id
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Check if app is already open
      for (let client of clientList) {
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      // Open app if not open
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});

console.log('[Service Worker] Loaded and ready');
