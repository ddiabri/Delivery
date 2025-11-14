import express from 'express';
import {
  getUserPoints,
  getUserPointsHistory,
  getAvailableRewards,
  redeemReward,
  getRedeemedRewards,
  getLeaderboards,
} from '../controllers/pointsController.js';

const router = express.Router();

/**
 * Get user points and tier
 * GET /api/points/user/:userId
 */
router.get('/user/:userId', getUserPoints);

/**
 * Get points transaction history
 * GET /api/points/history/:userId?limit=50&offset=0
 */
router.get('/history/:userId', getUserPointsHistory);

/**
 * Get available rewards for user
 * GET /api/rewards/available/:userId
 */
router.get('/rewards/available/:userId', getAvailableRewards);

/**
 * Redeem points for reward
 * POST /api/points/rewards/redeem
 * Body: { userId, rewardId }
 */
router.post('/rewards/redeem', redeemReward);

/**
 * Get user's redeemed rewards history
 * GET /api/points/rewards/history/:userId
 */
router.get('/rewards/history/:userId', getRedeemedRewards);

/**
 * Get leaderboards
 * GET /api/points/leaderboards?type=customers&timeframe=all
 */
router.get('/leaderboards', getLeaderboards);

export default router;
