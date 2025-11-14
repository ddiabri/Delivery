/**
 * Offline Request Queue Management using IndexedDB
 * Stores failed requests and syncs when connection is restored
 */

const DB_NAME = 'DeliveryAppDB';
const STORE_NAME = 'offlineQueue';
const DB_VERSION = 1;

let db = null;

/**
 * Initialize IndexedDB database
 */
export const initializeDB = () => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        console.log('IndexedDB store created successfully');
      }
    };
  });
};

/**
 * Add a failed request to the offline queue
 */
export const addToQueue = async (request) => {
  try {
    await initializeDB();

    // Read request body as text (it's a stream and can only be read once)
    let bodyText = null;
    if (request.body) {
      bodyText = await request.text();
    }

    const queueItem = {
      timestamp: Date.now(),
      status: 'PENDING',
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
      body: bodyText ? JSON.parse(bodyText) : null,
      retryCount: 0,
      maxRetries: 3
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const addRequest = store.add(queueItem);

      addRequest.onerror = () => {
        console.error('Failed to add request to queue:', addRequest.error);
        reject(addRequest.error);
      };

      addRequest.onsuccess = () => {
        console.log('Request queued for offline sync:', queueItem.url);
        resolve(addRequest.result);
      };
    });
  } catch (err) {
    console.error('Error adding to queue:', err);
    throw err;
  }
};

/**
 * Get all pending requests from the queue
 */
export const getPendingRequests = async () => {
  try {
    await initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('status');
      const range = IDBKeyRange.only('PENDING');
      const getRequest = index.getAll(range);

      getRequest.onerror = () => {
        reject(getRequest.error);
      };

      getRequest.onsuccess = () => {
        const results = getRequest.result || [];
        console.log(`Found ${results.length} pending requests in queue`);
        resolve(results);
      };
    });
  } catch (err) {
    console.error('Error getting pending requests:', err);
    throw err;
  }
};

/**
 * Update a queued request status
 */
export const updateQueueItemStatus = async (id, status) => {
  try {
    await initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onerror = () => {
        reject(getRequest.error);
      };

      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (item) {
          item.status = status;
          if (status === 'SYNCED') {
            item.syncedAt = Date.now();
          } else if (status === 'RETRY') {
            item.retryCount = (item.retryCount || 0) + 1;
            item.lastRetryAt = Date.now();
          }

          const updateRequest = store.put(item);
          updateRequest.onerror = () => {
            reject(updateRequest.error);
          };
          updateRequest.onsuccess = () => {
            console.log(`Queue item ${id} updated to status: ${status}`);
            resolve(item);
          };
        } else {
          reject(new Error(`Queue item ${id} not found`));
        }
      };
    });
  } catch (err) {
    console.error('Error updating queue item status:', err);
    throw err;
  }
};

/**
 * Remove a synced request from the queue
 */
export const removeFromQueue = async (id) => {
  try {
    await initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const deleteRequest = store.delete(id);

      deleteRequest.onerror = () => {
        reject(deleteRequest.error);
      };

      deleteRequest.onsuccess = () => {
        console.log(`Queue item ${id} removed`);
        resolve();
      };
    });
  } catch (err) {
    console.error('Error removing from queue:', err);
    throw err;
  }
};

/**
 * Clear all requests from the queue
 */
export const clearQueue = async () => {
  try {
    await initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const clearRequest = store.clear();

      clearRequest.onerror = () => {
        reject(clearRequest.error);
      };

      clearRequest.onsuccess = () => {
        console.log('Offline queue cleared');
        resolve();
      };
    });
  } catch (err) {
    console.error('Error clearing queue:', err);
    throw err;
  }
};

/**
 * Get queue statistics
 */
export const getQueueStats = async () => {
  try {
    await initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.getAll();

      getRequest.onerror = () => {
        reject(getRequest.error);
      };

      getRequest.onsuccess = () => {
        const items = getRequest.result || [];
        const stats = {
          total: items.length,
          pending: items.filter(i => i.status === 'PENDING').length,
          synced: items.filter(i => i.status === 'SYNCED').length,
          failed: items.filter(i => i.status === 'FAILED').length
        };
        resolve(stats);
      };
    });
  } catch (err) {
    console.error('Error getting queue stats:', err);
    throw err;
  }
};
