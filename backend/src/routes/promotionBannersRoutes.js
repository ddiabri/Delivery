import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  createPromotionBanner,
  getActiveBanners,
  getAllBanners,
  getBannerById,
  updateBanner,
  dismissBanner,
  deleteBanner,
  getBannerAnalytics,
} from '../controllers/promotionBannersController.js';

const router = express.Router();

// Public routes (no auth needed for viewing)
router.get('/active', getActiveBanners);
router.get('/:id', getBannerById);

// User routes
router.post('/:id/dismiss', authenticate, dismissBanner);

// Admin routes
router.post('/', authenticate, createPromotionBanner);
router.get('/admin/all', authenticate, getAllBanners);
router.put('/:id', authenticate, updateBanner);
router.delete('/:id', authenticate, deleteBanner);
router.get('/:id/analytics', authenticate, getBannerAnalytics);

export default router;
