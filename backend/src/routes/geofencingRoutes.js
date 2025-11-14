import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getGeofenceEvents,
  getGeofenceZone,
  createGeofenceZone,
  getGeofenceStats
} from '../utils/geofencingService.js';

const router = express.Router();

// User geofencing routes
router.get('/events/:deliveryId', authenticate, getGeofenceEvents);
router.get('/zone/:deliveryId', authenticate, getGeofenceZone);
router.post('/zone', authenticate, createGeofenceZone);

// Admin geofencing routes
router.get('/stats', authenticate, getGeofenceStats);

export default router;
