import axios from 'axios';
import { io } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

// Create axios instance
const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// WebSocket connection
let socket = null;

export const initSocket = () => {
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    auth: {
      token: localStorage.getItem('token'),
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('Socket.IO connected');
  });

  socket.on('disconnect', () => {
    console.log('Socket.IO disconnected');
  });

  socket.on('connect_error', (error) => {
    console.error('Socket.IO connection error:', error);
  });

  return socket;
};

export const getSocket = () => {
  if (!socket) {
    return initSocket();
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// API methods
export const authAPI = {
  register: (data) => apiClient.post('/auth/register', data),
  login: (data) => apiClient.post('/auth/login', data),
  logout: () => apiClient.post('/auth/logout'),
  getCurrentUser: () => apiClient.get('/auth/me'),
  updateProfile: (data) => apiClient.put('/auth/profile', data),
  refreshToken: (token) => apiClient.post('/auth/refresh', { refreshToken: token }),
};

export const deliveryAPI = {
  createDelivery: (data) => apiClient.post('/deliveries', data),
  getDeliveries: (params) => apiClient.get('/deliveries', { params }),
  getDeliveryById: (id) => apiClient.get(`/deliveries/${id}`),
  updateDeliveryStatus: (id, status) =>
    apiClient.put(`/deliveries/${id}/status`, { status }),
  assignDriver: (id, driverId) =>
    apiClient.post(`/deliveries/${id}/assign`, { driverId }),
};

export const driverAPI = {
  getAvailableDeliveries: (params) =>
    apiClient.get('/drivers/available', { params }),
  getActiveDeliveries: () =>
    apiClient.get('/drivers/active'),
  acceptDelivery: (deliveryId) =>
    deliveryAPI.updateDeliveryStatus(deliveryId, 'ACCEPTED'),
  updateLocation: (data) =>
    apiClient.post('/drivers/location', data),
  getStats: () => apiClient.get('/drivers/stats'),
};

export const userAPI = {
  getProfile: () => apiClient.get('/users/profile'),
  updateProfile: (data) => apiClient.put('/users/profile', data),
  uploadProfileImage: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/users/profile/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const reviewAPI = {
  createReview: (data) => apiClient.post('/reviews', data),
  getDeliveryReviews: (deliveryId) =>
    apiClient.get(`/reviews/delivery/${deliveryId}`),
  getDriverReviews: (driverId) =>
    apiClient.get(`/reviews/driver/${driverId}`),
  getCurrentDriverReviews: () =>
    apiClient.get('/reviews/driver/me'),
  updateReview: (id, data) =>
    apiClient.put(`/reviews/${id}`, data),
  deleteReview: (id) =>
    apiClient.delete(`/reviews/${id}`),
};

export const messageAPI = {
  sendMessage: (data) => apiClient.post('/messages', data),
  getChatHistory: (deliveryId, params) =>
    apiClient.get(`/messages/${deliveryId}`, { params }),
  getUnreadCount: (deliveryId) =>
    apiClient.get(`/messages/${deliveryId}/unread`),
  markAsRead: (deliveryId) =>
    apiClient.put(`/messages/${deliveryId}/mark-read`),
};

export const adminAPI = {
  getDashboardStats: () => apiClient.get('/admin/dashboard'),
  getAllUsers: (params) => apiClient.get('/admin/users', { params }),
  getAllDeliveries: (params) => apiClient.get('/admin/deliveries', { params }),
  getDriverAnalytics: () => apiClient.get('/admin/drivers/analytics'),
  getReviewsForModeration: (params) =>
    apiClient.get('/admin/reviews/moderation', { params }),
  getDeliveryStats: (params) => apiClient.get('/admin/stats/deliveries', { params }),
  deactivateUser: (userId) => apiClient.put(`/admin/users/${userId}/deactivate`),
  cancelDelivery: (deliveryId, data) =>
    apiClient.put(`/admin/deliveries/${deliveryId}/cancel`, data),
};

export const qrCodeAPI = {
  generateQRCode: (deliveryId) =>
    apiClient.post(`/qr-code/${deliveryId}/generate`),
  verifyQRCodePickup: (deliveryId, qrData) =>
    apiClient.post('/qr-code/verify-pickup', { deliveryId, qrData }),
  getQRCodeInfo: (deliveryId) =>
    apiClient.get(`/qr-code/${deliveryId}/info`),
};

export default apiClient;
