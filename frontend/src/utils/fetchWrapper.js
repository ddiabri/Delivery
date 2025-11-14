/**
 * Fetch wrapper that handles offline scenarios
 * Queues requests when offline and syncs when connection is restored
 */

import { addToQueue, getPendingRequests, removeFromQueue, updateQueueItemStatus } from './offlineQueue.js';

// URLs that should NOT be queued (e.g., auth, public data)
const EXCLUDED_URLS = [
  '/api/auth',
  '/api/public',
  '/health'
];

/**
 * Check if URL should be queued when offline
 */
const shouldQueueRequest = (url, method = 'GET') => {
  return (
    !EXCLUDED_URLS.some(excluded => url.includes(excluded)) &&
    ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)
  );
};

/**
 * Enhanced fetch wrapper with offline support
 */
export const fetchWithOfflineSupport = async (url, options = {}) => {
  const method = options.method || 'GET';

  try {
    // Check if online
    if (!navigator.onLine) {
      console.log(`[Offline] Request queued: ${method} ${url}`);

      // Queue the request if it's a type we can retry
      if (shouldQueueRequest(url, method)) {
        // Create a Request object for queuing (will read body as stream)
        const request = new Request(url, options);
        await addToQueue(request);
      }

      // Return a mock response for offline state
      return {
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => ({
          error: 'Device is offline. Request queued for sync when connection is restored.',
          offline: true
        }),
        text: async () => 'Device is offline. Request queued for sync.',
        headers: new Headers()
      };
    }

    // Make the actual fetch request
    const response = await fetch(url, options);

    return response;
  } catch (error) {
    console.error(`[Fetch Error] ${method} ${url}:`, error);

    // Queue the request if it's a type we can retry
    if (shouldQueueRequest(url, method) && error.message.includes('Failed to fetch')) {
      // Create a Request object for queuing
      const request = new Request(url, options);
      await addToQueue(request);

      return {
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => ({
          error: 'Network error. Request queued for sync.',
          offline: true
        }),
        text: async () => 'Network error. Request queued for sync.',
        headers: new Headers()
      };
    }

    throw error;
  }
};

/**
 * Sync all pending requests when connection is restored
 */
export const syncPendingRequests = async () => {
  try {
    console.log('[Sync] Starting offline request sync...');
    const pendingRequests = await getPendingRequests();

    if (pendingRequests.length === 0) {
      console.log('[Sync] No pending requests to sync');
      return { synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;

    for (const item of pendingRequests) {
      try {
        // Skip if max retries exceeded
        if (item.retryCount >= item.maxRetries) {
          await updateQueueItemStatus(item.id, 'FAILED');
          console.warn(`[Sync] Max retries exceeded for: ${item.method} ${item.url}`);
          failed++;
          continue;
        }

        // Reconstruct and send the request
        const requestOptions = {
          method: item.method,
          headers: item.headers,
          body: item.body ? JSON.stringify(item.body) : undefined
        };

        const response = await fetch(item.url, requestOptions);

        if (response.ok) {
          await removeFromQueue(item.id);
          console.log(`[Sync] Successfully synced: ${item.method} ${item.url}`);
          synced++;
        } else {
          // Update retry count and mark for retry
          await updateQueueItemStatus(item.id, 'RETRY');
          console.warn(`[Sync] Retry ${item.retryCount + 1}/${item.maxRetries}: ${item.method} ${item.url}`);
          failed++;
        }
      } catch (error) {
        console.error(`[Sync] Error syncing ${item.url}:`, error);
        await updateQueueItemStatus(item.id, 'RETRY');
        failed++;
      }
    }

    console.log(`[Sync] Sync complete - Synced: ${synced}, Failed: ${failed}`);
    return { synced, failed };
  } catch (error) {
    console.error('[Sync] Error during sync:', error);
    throw error;
  }
};

/**
 * Get sync status
 */
export const getSyncStatus = async () => {
  try {
    const pending = await getPendingRequests();
    return {
      hasPendingRequests: pending.length > 0,
      pendingCount: pending.length,
      isOnline: navigator.onLine
    };
  } catch (error) {
    console.error('Error getting sync status:', error);
    return {
      hasPendingRequests: false,
      pendingCount: 0,
      isOnline: navigator.onLine
    };
  }
};
