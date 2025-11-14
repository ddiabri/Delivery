import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/authContext';
import { io } from 'socket.io-client';
import '../styles/notificationCenter.css';

export default function NotificationCenter() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user?.id) return;

    // Initialize Socket.IO connection
    const newSocket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000', {
      auth: {
        token: localStorage.getItem('token'),
      },
    });

    newSocket.on('connect', () => {
      // Join user notification room
      newSocket.emit('user:join', user.id);
    });

    // Listen for new notifications
    newSocket.on('notification:new', (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // Show browser notification if available
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.body,
          icon: '📦',
        });
      }
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.emit('user:leave', user.id);
        newSocket.disconnect();
      }
    };
  }, [user?.id]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const handleMarkAsRead = (notificationId) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === notificationId ? { ...notif, is_read: true } : notif
      )
    );

    // Update read status on server
    fetch(`/api/notifications/${notificationId}/read`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    }).catch((err) => console.error('Error marking notification as read:', err));
  };

  const handleDismiss = (notificationId) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  };

  const unreadNotifications = notifications.filter((n) => !n.is_read);

  return (
    <div className="notification-center">
      {/* Notification Bell Icon */}
      <div className="notification-bell">
        <button
          className="bell-button"
          onClick={() => setIsOpen(!isOpen)}
          title="Notifications"
        >
          🔔
          {unreadCount > 0 && (
            <span className="unread-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </button>

        {/* Notification Dropdown */}
        {isOpen && (
          <div className="notification-dropdown">
            <div className="dropdown-header">
              <h3>Notifications</h3>
              {unreadCount > 0 && (
                <button
                  className="mark-all-read"
                  onClick={() => {
                    setNotifications((prev) =>
                      prev.map((n) => ({ ...n, is_read: true }))
                    );
                    setUnreadCount(0);

                    fetch('/api/notifications/read-all', {
                      method: 'PUT',
                      headers: {
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                      },
                    }).catch((err) => console.error('Error:', err));
                  }}
                >
                  Mark all as read
                </button>
              )}
            </div>

            <div className="notification-list">
              {notifications.length === 0 ? (
                <div className="empty-state">
                  <p>No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`notification-item ${notification.is_read ? 'read' : 'unread'}`}
                  >
                    <div className="notification-content">
                      <p className="notification-title">{notification.title}</p>
                      <p className="notification-body">{notification.body}</p>
                      <p className="notification-time">
                        {formatTime(notification.created_at)}
                      </p>
                    </div>

                    <div className="notification-actions">
                      {!notification.is_read && (
                        <button
                          className="btn-mark-read"
                          onClick={() => handleMarkAsRead(notification.id)}
                          title="Mark as read"
                        >
                          ✓
                        </button>
                      )}
                      <button
                        className="btn-dismiss"
                        onClick={() => handleDismiss(notification.id)}
                        title="Dismiss"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {notifications.length > 0 && (
              <div className="dropdown-footer">
                <a href="/notifications" className="view-all">
                  View All Notifications
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
