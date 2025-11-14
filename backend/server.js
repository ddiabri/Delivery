import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import database and routes
import { testConnection, initializeDatabase, query } from './src/config/database.js';
import { advancedRateLimitMiddleware } from './src/middleware/advancedRateLimiter.js';
import authRoutes from './src/routes/authRoutes.js';
import deliveryRoutes from './src/routes/deliveryRoutes.js';
import driverRoutes from './src/routes/driverRoutes.js';
import reviewRoutes from './src/routes/reviewRoutes.js';
import chatRoutes from './src/routes/chatRoutes.js';
import adminRoutes from './src/routes/adminRoutes.js';
import notificationRoutes from './src/routes/notificationRoutes.js';
import qrCodeRoutes from './src/routes/qrCodeRoutes.js';
import driverQRCodeRoutes from './src/routes/driverQRCodeRoutes.js';
import guestDeliveryRoutes from './src/routes/guestDeliveryRoutes.js';
import pointsRoutes from './src/routes/pointsRoutes.js';
import campaignRoutes from './src/routes/campaignRoutes.js';
import proofOfDeliveryRoutes from './src/routes/proofOfDeliveryRoutes.js';
import notificationPreferencesRoutes from './src/routes/notificationPreferencesRoutes.js';
import deliverySchedulingRoutes from './src/routes/deliverySchedulingRoutes.js';
import deliveryPreferencesRoutes from './src/routes/deliveryPreferencesRoutes.js';
import bulkMessagingRoutes from './src/routes/bulkMessagingRoutes.js';
import promotionBannersRoutes from './src/routes/promotionBannersRoutes.js';
import rateLimitRoutes from './src/routes/rateLimitRoutes.js';
import walletRoutes from './src/routes/walletRoutes.js';
import geofencingRoutes from './src/routes/geofencingRoutes.js';
import { checkGeofenceEvents } from './src/utils/geofencingService.js';
import { errorHandler } from './src/middleware/authMiddleware.js';
import { initializeWebSocket } from './src/utils/notificationService.js';

// Load environment variables
dotenv.config();

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Advanced rate limiting middleware
app.use('/api/', advancedRateLimitMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.get('/api', (req, res) => {
  res.json({
    message: 'Delivery App API v1.0.0',
    endpoints: {
      auth: '/api/auth',
      deliveries: '/api/deliveries',
      drivers: '/api/drivers'
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/messages', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/qr-code', qrCodeRoutes);
app.use('/api/driver-qr-code', driverQRCodeRoutes);
app.use('/api/guest', guestDeliveryRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/admin', campaignRoutes);
app.use('/api/pod', proofOfDeliveryRoutes);
app.use('/api/notification-preferences', notificationPreferencesRoutes);
app.use('/api/scheduled-deliveries', deliverySchedulingRoutes);
app.use('/api/delivery-preferences', deliveryPreferencesRoutes);
app.use('/api/bulk-messages', bulkMessagingRoutes);
app.use('/api/banners', promotionBannersRoutes);
app.use('/api/rate-limit', rateLimitRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/geofencing', geofencingRoutes);

// Initialize WebSocket for notifications
initializeWebSocket(io);

// WebSocket connection handling
const connectedDrivers = new Map(); // Track connected drivers

io.on('connection', (socket) => {
  console.log(`[Socket.IO] New client connected: ${socket.id}`);

  // User notification room join
  socket.on('user:join', (userId) => {
    socket.join(`user:${userId}`);
    console.log(`[Socket.IO] User ${userId} joined notification room`);
  });

  // User notification room leave
  socket.on('user:leave', (userId) => {
    socket.leave(`user:${userId}`);
    console.log(`[Socket.IO] User ${userId} left notification room`);
  });

  // Driver location updates
  socket.on('driver:location', async (data) => {
    const { driverId, latitude, longitude, bearing, speed } = data;

    // Store driver connection
    connectedDrivers.set(driverId, {
      socketId: socket.id,
      latitude,
      longitude,
      bearing,
      speed,
      timestamp: new Date()
    });

    // Broadcast to all connected clients (customers, other drivers, admin)
    io.emit('driver:location:update', {
      driverId,
      latitude,
      longitude,
      bearing,
      speed,
      timestamp: new Date()
    });

    // Check for geofence events
    try {
      const deliveryResult = await query(
        `SELECT id, customer_id FROM deliveries
         WHERE driver_id = $1 AND status = 'ASSIGNED'
         LIMIT 1`,
        [driverId]
      );

      if (deliveryResult.rows.length > 0) {
        const delivery = deliveryResult.rows[0];
        await checkGeofenceEvents(
          driverId,
          delivery.id,
          delivery.customer_id,
          latitude,
          longitude,
          io
        );
      }
    } catch (err) {
      console.error('Error checking geofence events:', err);
    }

    console.log(`[Socket.IO] Driver ${driverId} location updated`);
  });

  // Delivery status updates
  socket.on('delivery:status:update', (data) => {
    const { deliveryId, status, driverId } = data;

    // Broadcast to delivery room
    io.to(`delivery:${deliveryId}`).emit('delivery:status:changed', {
      deliveryId,
      status,
      driverId,
      timestamp: new Date()
    });

    console.log(`[Socket.IO] Delivery ${deliveryId} status: ${status}`);
  });

  // Join delivery room for real-time updates
  socket.on('join:delivery', (deliveryId) => {
    socket.join(`delivery:${deliveryId}`);
    console.log(`[Socket.IO] Socket ${socket.id} joined delivery room: delivery:${deliveryId}`);
  });

  // Leave delivery room
  socket.on('leave:delivery', (deliveryId) => {
    socket.leave(`delivery:${deliveryId}`);
    console.log(`[Socket.IO] Socket ${socket.id} left delivery room: delivery:${deliveryId}`);
  });

  // Driver availability toggle
  socket.on('driver:toggle:availability', (data) => {
    const { driverId, available } = data;
    io.emit('driver:availability:changed', {
      driverId,
      available,
      timestamp: new Date()
    });
    console.log(`[Socket.IO] Driver ${driverId} availability: ${available}`);
  });

  // Request driver location (for tracking)
  socket.on('request:driver:location', (driverId) => {
    const driver = connectedDrivers.get(driverId);
    if (driver) {
      socket.emit('driver:location:current', {
        driverId,
        ...driver
      });
    }
  });

  // Chat messaging
  socket.on('message:send', (data) => {
    const { deliveryId, senderId, recipientId, message } = data;

    // Emit to specific delivery room
    io.to(`delivery:${deliveryId}`).emit('message:new', {
      deliveryId,
      senderId,
      recipientId,
      message,
      timestamp: new Date()
    });

    console.log(`[Socket.IO] Message sent in delivery ${deliveryId}`);
  });

  // Join delivery chat room
  socket.on('join:chat', (data) => {
    const { deliveryId, userId } = data;
    socket.join(`chat:${deliveryId}`);
    socket.data.deliveryId = deliveryId;
    socket.data.userId = userId;
    console.log(`[Socket.IO] User ${userId} joined chat for delivery ${deliveryId}`);
  });

  // Leave delivery chat room
  socket.on('leave:chat', (deliveryId) => {
    socket.leave(`chat:${deliveryId}`);
    console.log(`[Socket.IO] User left chat for delivery ${deliveryId}`);
  });

  // Mark messages as read
  socket.on('messages:mark-read', (deliveryId) => {
    io.to(`chat:${deliveryId}`).emit('messages:read', {
      deliveryId,
      timestamp: new Date()
    });
    console.log(`[Socket.IO] Messages marked as read in delivery ${deliveryId}`);
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    // Remove driver from connected drivers
    for (const [driverId, driver] of connectedDrivers.entries()) {
      if (driver.socketId === socket.id) {
        connectedDrivers.delete(driverId);
        io.emit('driver:disconnected', { driverId });
        console.log(`[Socket.IO] Driver ${driverId} disconnected`);
      }
    }
    console.log(`[Socket.IO] Socket ${socket.id} disconnected`);
  });

  // Error handling
  socket.on('error', (error) => {
    console.error(`[Socket.IO] Error from ${socket.id}:`, error);
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    code: 'NOT_FOUND'
  });
});

// Start server
const PORT = process.env.PORT || 3000;

// Initialize database and start server
(async () => {
  try {
    const connected = await testConnection();
    if (connected) {
      await initializeDatabase();
    }

    httpServer.listen(PORT, () => {
      console.log(`\n🚀 Delivery App Backend Server`);
      console.log(`   Running on: http://localhost:${PORT}`);
      console.log(`   API: http://localhost:${PORT}/api`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   WebSocket: ws://localhost:${PORT}`);
      console.log('\n✅ Server is ready to accept connections\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();

export { app, io };
