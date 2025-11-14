import React, { useState, useEffect, useRef } from 'react';
import { messageAPI, getSocket } from '../services/api';
import '../styles/chat.css';

export default function Chat({ deliveryId, otherUserId, otherUserName, currentUserId }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);
  const socket = getSocket();

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch chat history
  const fetchMessages = async () => {
    setLoading(true);
    try {
      const response = await messageAPI.getChatHistory(deliveryId, {
        limit: 50,
        offset: 0,
      });
      const messagesList = response.data.data || [];
      setMessages(messagesList);
      setError('');

      // Mark messages as read
      await messageAPI.markAsRead(deliveryId);
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      setError('Failed to load chat history');
    } finally {
      setLoading(false);
    }
  };

  // Fetch unread count
  const fetchUnreadCount = async () => {
    try {
      const response = await messageAPI.getUnreadCount(deliveryId);
      setUnreadCount(response.data.data?.unread_count || 0);
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    }
  };

  // Initialize chat
  useEffect(() => {
    fetchMessages();
    fetchUnreadCount();

    // Join chat room
    if (socket) {
      socket.emit('join:chat', { deliveryId, userId: currentUserId });
    }

    return () => {
      if (socket) {
        socket.emit('leave:chat', deliveryId);
      }
    };
  }, [deliveryId, currentUserId]);

  // Listen for new messages
  useEffect(() => {
    if (!socket) return;

    socket.on('message:new', (data) => {
      if (data.deliveryId === deliveryId) {
        setMessages((prev) => [...prev, { ...data, id: Math.random() }]);
        scrollToBottom();
      }
    });

    socket.on('messages:read', (data) => {
      if (data.deliveryId === deliveryId) {
        setUnreadCount(0);
      }
    });

    return () => {
      socket.off('message:new');
      socket.off('messages:read');
    };
  }, [socket, deliveryId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!newMessage.trim()) {
      setError('Message cannot be empty');
      return;
    }

    if (newMessage.length > 1000) {
      setError('Message is too long (max 1000 characters)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await messageAPI.sendMessage({
        deliveryId,
        recipientId: otherUserId,
        message_text: newMessage,
      });

      const sentMessage = response.data.data;

      // Add message to local state
      setMessages((prev) => [
        ...prev,
        {
          id: sentMessage.id,
          sender_id: currentUserId,
          recipient_id: otherUserId,
          message_text: sentMessage.message_text,
          created_at: sentMessage.created_at,
          sender_name: 'You',
        },
      ]);

      // Emit via socket
      socket?.emit('message:send', {
        deliveryId,
        senderId: currentUserId,
        recipientId: otherUserId,
        message: sentMessage.message_text,
      });

      setNewMessage('');
      scrollToBottom();
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to send message';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h3>Chat with {otherUserName}</h3>
        {unreadCount > 0 && (
          <span className="unread-badge">{unreadCount} new</span>
        )}
      </div>

      <div className="messages-list">
        {loading && messages.length === 0 && (
          <div className="loading">Loading messages...</div>
        )}

        {error && messages.length === 0 && (
          <div className="error-message">{error}</div>
        )}

        {messages.length === 0 && !loading && (
          <div className="empty-state">
            <p>No messages yet. Start a conversation!</p>
          </div>
        )}

        {messages.map((msg) => {
          const isOwn = msg.sender_id === currentUserId;
          return (
            <div
              key={msg.id}
              className={`message ${isOwn ? 'own' : 'other'}`}
            >
              <div className="message-bubble">
                <p className="message-text">{msg.message_text}</p>
                <span className="message-time">
                  {formatTime(msg.created_at)}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form className="message-input-form" onSubmit={handleSendMessage}>
        {error && <div className="input-error">{error}</div>}

        <div className="input-wrapper">
          <input
            type="text"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={loading}
            maxLength="1000"
            className="message-input"
          />
          <span className="char-count">
            {newMessage.length}/1000
          </span>
          <button
            type="submit"
            disabled={loading || !newMessage.trim()}
            className="send-button"
          >
            {loading ? '⏳' : '➤'}
          </button>
        </div>
      </form>
    </div>
  );
}
