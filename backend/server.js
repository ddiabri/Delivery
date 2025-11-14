import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import database and routes
import { testConnection, initializeDatabase } from './src/config/database.js';
import authRoutes from './src/routes/authRoutes.js';
import deliveryRoutes from './src/routes/deliveryRoutes.js';
import driverRoutes from './src/routes/driverRoutes.js';
import reviewRoutes from './src/routes/reviewRoutes.js';
import { errorHandler } from './src/middleware/authMiddleware.js';

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

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

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

// WebSocket connection handling
const connectedDrivers = new Map(); // Track connected drivers

io.on('connection', (socket) => {
  console.log(`[Socket.IO] New client connected: ${socket.id}`);

  // Driver location updates
  socket.on('driver:location', (data) => {
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
