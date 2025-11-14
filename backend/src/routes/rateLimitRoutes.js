import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getRateLimitStats,
  addToWhitelist,
  removeFromWhitelist,
  getWhitelist,
  unblockRateLimitViolator
} from '../middleware/advancedRateLimiter.js';

const router = express.Router();

// Admin rate limit management routes
router.get('/stats', authenticate, getRateLimitStats);
router.get('/whitelist', authenticate, getWhitelist);
router.post('/whitelist', authenticate, addToWhitelist);
router.delete('/whitelist/:ip_address', authenticate, removeFromWhitelist);

export default router;
