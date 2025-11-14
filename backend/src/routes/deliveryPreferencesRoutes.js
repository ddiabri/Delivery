import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getDeliveryPreferences,
  updateDeliveryPreferences,
  addPreferredLocation,
  removePreferredLocation,
  addExcludedLocation,
  removeExcludedLocation,
} from '../controllers/deliveryPreferencesController.js';

const router = express.Router();

// Get and update preferences
router.get('/', authenticate, getDeliveryPreferences);
router.put('/', authenticate, updateDeliveryPreferences);

// Preferred locations
router.post('/preferred-locations', authenticate, addPreferredLocation);
router.delete('/preferred-locations/:locationId', authenticate, removePreferredLocation);

// Excluded locations
router.post('/excluded-locations', authenticate, addExcludedLocation);
router.delete('/excluded-locations/:locationId', authenticate, removeExcludedLocation);

export default router;
