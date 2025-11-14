/**
 * Service Worker Manager
 * Handles service worker registration, updates, and communication
 */

import { syncPendingRequests, getSyncStatus } from './fetchWrapper.js';

let registrationPromise = null;

/**
 * Register the service worker
 */
export const registerServiceWorker = async () => {
  try {
    console.log('[SW Manager] Registering service worker...');

    registrationPromise = navigator.serviceWorker.register('/service-worker.js', {
      scope: '/'
    });

    const registration = await registrationPromise;

    console.log('[SW Manager] Service worker registered successfully');

    // Handle service worker updates
    registration.addEventListener('updatefound', handleUpdateFound);

    // Sync pending requests immediately
    await syncOnlineStatus();

    // Listen for online events
    window.addEventListener('online', syncOnlineStatus);
    window.addEventListener('offline', handleOffline);

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

    return registration;
  } catch (error) {
    console.error('[SW Manager] Service worker registration failed:', error);
  }
};

/**
 * Get the service worker registration
 */
export const getRegistration = async () => {
  if (registrationPromise) {
    return registrationPromise;
  }

  try {
    return await navigator.serviceWorker.getRegistration();
  } catch (error) {
    console.error('[SW Manager] Error getting registration:', error);
    return null;
  }
};

/**
 * Unregister the service worker
 */
export const unregisterServiceWorker = async () => {
  try {
    const registration = await getRegistration();
    if (registration) {
      await registration.unregister();
      console.log('[SW Manager] Service worker unregistered');
    }
  } catch (error) {
    console.error('[SW Manager] Error unregistering service worker:', error);
  }
};

/**
 * Handle when service worker finds an update
 */
const handleUpdateFound = async (event) => {
  console.log('[SW Manager] Service worker update found');
  const registration = event.target;
  const newWorker = registration.installing;

  newWorker.addEventListener('statechange', () => {
    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
      // New service worker is available
      console.log('[SW Manager] New service worker available');

      // Notify user that update is available
      const event = new CustomEvent('sw-update-available', {
        detail: { registration }
      });
      window.dispatchEvent(event);

      // Or auto-update
      updateServiceWorker(registration);
    }
  });
};

/**
 * Update the service worker
 */
export const updateServiceWorker = async (registration = null) => {
  try {
    const reg = registration || await getRegistration();
    if (reg) {
      await reg.update();
      console.log('[SW Manager] Service worker update checked');
    }
  } catch (error) {
    console.error('[SW Manager] Error updating service worker:', error);
  }
};

/**
 * Skip waiting and activate new service worker
 */
export const skipWaitingServiceWorker = async () => {
  try {
    const registration = await getRegistration();
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      console.log('[SW Manager] Skipping waiting service worker');

      // Reload page after new service worker is activated
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  } catch (error) {
    console.error('[SW Manager] Error skipping waiting:', error);
  }
};

/**
 * Request background sync
 */
export const requestBackgroundSync = async (tag = 'sync-offline-requests') => {
  try {
    const registration = await getRegistration();
    if (registration && 'sync' in registration) {
      await registration.sync.register(tag);
      console.log(`[SW Manager] Background sync requested with tag: ${tag}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('[SW Manager] Error requesting background sync:', error);
    return false;
  }
};

/**
 * Sync pending requests manually
 */
export const requestManualSync = async () => {
  try {
    const registration = await getRegistration();
    if (registration && registration.active) {
      const channel = new MessageChannel();

      const syncPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Sync timeout'));
        }, 30000);

        channel.port1.onmessage = (event) => {
          clearTimeout(timeout);
          if (event.data.type === 'SYNC_RESULT') {
            resolve(event.data.result);
          } else if (event.data.type === 'SYNC_ERROR') {
            reject(new Error(event.data.error));
          }
        };
      });

      registration.active.postMessage({ type: 'SYNC_NOW' }, [channel.port2]);
      return await syncPromise;
    }
  } catch (error) {
    console.error('[SW Manager] Error requesting manual sync:', error);
    throw error;
  }
};

/**
 * Handle sync status change
 */
const syncOnlineStatus = async () => {
  if (!navigator.onLine) {
    console.log('[SW Manager] Device went offline');
    return;
  }

  console.log('[SW Manager] Device is online, syncing pending requests...');

  try {
    // Sync via manual request if available
    try {
      const result = await requestManualSync();
      console.log('[SW Manager] Manual sync completed:', result);
    } catch (error) {
      console.warn('[SW Manager] Manual sync failed, falling back to app sync:', error);
      // Fallback to app-based sync
      const result = await syncPendingRequests();
      console.log('[SW Manager] App sync completed:', result);
    }

    // Request background sync as well
    await requestBackgroundSync();
  } catch (error) {
    console.error('[SW Manager] Error during online sync:', error);
  }
};

/**
 * Handle offline event
 */
const handleOffline = () => {
  console.log('[SW Manager] Device went offline');

  // Dispatch offline event for app to handle
  const event = new CustomEvent('app-offline', {
    detail: { timestamp: Date.now() }
  });
  window.dispatchEvent(event);
};

/**
 * Handle messages from service worker
 */
const handleServiceWorkerMessage = (event) => {
  const { type, data } = event.data;

  if (type === 'SYNC_COMPLETE') {
    console.log('[SW Manager] Background sync completed:', data);

    // Dispatch event for app to handle
    const syncCompleteEvent = new CustomEvent('sw-sync-complete', {
      detail: data
    });
    window.dispatchEvent(syncCompleteEvent);
  }
};

/**
 * Get current sync status
 */
export const getCurrentSyncStatus = async () => {
  try {
    return await getSyncStatus();
  } catch (error) {
    console.error('[SW Manager] Error getting sync status:', error);
    return {
      hasPendingRequests: false,
      pendingCount: 0,
      isOnline: navigator.onLine
    };
  }
};

/**
 * Subscribe to sync status changes
 */
export const subscribeSyncStatus = (callback) => {
  // Check status immediately
  getCurrentSyncStatus().then(callback);

  // Listen for online/offline changes
  const handleOnline = () => {
    setTimeout(() => getCurrentSyncStatus().then(callback), 1000);
  };

  const handleOffline = () => {
    getCurrentSyncStatus().then(callback);
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Listen for sync completion
  const handleSyncComplete = () => {
    getCurrentSyncStatus().then(callback);
  };

  window.addEventListener('sw-sync-complete', handleSyncComplete);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    window.removeEventListener('sw-sync-complete', handleSyncComplete);
  };
};

console.log('[SW Manager] Service worker manager loaded');
