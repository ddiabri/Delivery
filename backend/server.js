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
    methods: ['GET', 'POST'],
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

// API routes placeholder
app.get('/api', (req, res) => {
  res.json({ message: 'Delivery App API' });
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`[Socket.IO] New client connected: ${socket.id}`);

  // Driver location updates
  socket.on('driver:location', (data) => {
    // Broadcast driver location to relevant clients
    socket.broadcast.emit('driver:location:update', data);
  });

  // Order status updates
  socket.on('order:status', (data) => {
    io.to(`order:${data.orderId}`).emit('order:status:update', data);
  });

  // Join order room for real-time updates
  socket.on('join:order', (orderId) => {
    socket.join(`order:${orderId}`);
    console.log(`[Socket.IO] User joined order room: order:${orderId}`);
  });

  // Leave order room
  socket.on('leave:order', (orderId) => {
    socket.leave(`order:${orderId}`);
    console.log(`[Socket.IO] User left order room: order:${orderId}`);
  });

  // Driver availability
  socket.on('driver:available', (data) => {
    socket.broadcast.emit('driver:available:update', data);
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: err.status || 500
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`\n🚀 Delivery App Backend Server`);
  console.log(`   Running on: http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   WebSocket: ws://localhost:${PORT}`);
  console.log('\n✅ Server is ready to accept connections\n`);
});

export { app, io };
