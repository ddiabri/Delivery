import React, { useEffect, useState } from 'react';
import { subscribeSyncStatus, requestManualSync } from '../utils/serviceWorkerManager.js';
import '../styles/offlineIndicator.css';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState({
    hasPendingRequests: false,
    pendingCount: 0
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [showIndicator, setShowIndicator] = useState(false);

  useEffect(() => {
    // Subscribe to sync status changes
    const unsubscribe = subscribeSyncStatus((status) => {
      setSyncStatus({
        hasPendingRequests: status.hasPendingRequests,
        pendingCount: status.pendingCount
      });
      setIsOnline(status.isOnline);
      setShowIndicator(!status.isOnline || status.hasPendingRequests);
    });

    return unsubscribe;
  }, []);

  const handleManualSync = async () => {
    if (!navigator.onLine) {
      return;
    }

    try {
      setIsSyncing(true);
      const result = await requestManualSync();
      console.log('Manual sync result:', result);
    } catch (error) {
      console.error('Manual sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (!showIndicator) {
    return null;
  }

  return (
    <div className="offline-indicator-container">
      {!isOnline ? (
        <div className="offline-indicator offline">
          <span className="indicator-icon">⚠️</span>
          <span className="indicator-text">You're offline</span>
          <span className="indicator-hint">Changes will sync when you're back online</span>
        </div>
      ) : syncStatus.hasPendingRequests ? (
        <div className="offline-indicator syncing">
          <span className="indicator-icon">🔄</span>
          <div className="indicator-content">
            <span className="indicator-text">
              Syncing {syncStatus.pendingCount} pending request{syncStatus.pendingCount !== 1 ? 's' : ''}
            </span>
            {isSyncing && <span className="spinner"></span>}
          </div>
          {!isSyncing && (
            <button
              className="sync-button"
              onClick={handleManualSync}
              title="Sync pending requests now"
            >
              Sync Now
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
