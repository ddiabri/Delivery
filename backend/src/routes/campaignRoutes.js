import express from 'express';
import {
  createCampaign,
  getAllCampaigns,
  updateCampaign,
  deleteCampaign,
  createCampaignRule,
  updateCampaignRule,
  assignCampaignToUsers,
  getCampaignUsers,
  createReward,
  getAllRewards,
  updateReward,
  deleteReward,
} from '../controllers/campaignController.js';

const router = express.Router();

// Campaign Management
/**
 * Create campaign
 * POST /api/admin/campaigns
 */
router.post('/campaigns', createCampaign);

/**
 * Get all campaigns
 * GET /api/admin/campaigns?active=true
 */
router.get('/campaigns', getAllCampaigns);

/**
 * Update campaign
 * PUT /api/admin/campaigns/:id
 */
router.put('/campaigns/:id', updateCampaign);

/**
 * Delete campaign
 * DELETE /api/admin/campaigns/:id
 */
router.delete('/campaigns/:id', deleteCampaign);

/**
 * Create campaign rule
 * POST /api/admin/campaigns/:campaignId/rules
 */
router.post('/campaigns/:campaignId/rules', createCampaignRule);

/**
 * Update campaign rule
 * PUT /api/admin/campaigns/:campaignId/rules/:ruleId
 */
router.put('/campaigns/:campaignId/rules/:ruleId', updateCampaignRule);

/**
 * Assign campaign to users
 * POST /api/admin/campaigns/:campaignId/assign-users
 */
router.post('/campaigns/:campaignId/assign-users', assignCampaignToUsers);

/**
 * Get campaign users
 * GET /api/admin/campaigns/:campaignId/users?limit=100&offset=0
 */
router.get('/campaigns/:campaignId/users', getCampaignUsers);

// Reward Management
/**
 * Create reward
 * POST /api/admin/rewards
 */
router.post('/rewards', createReward);

/**
 * Get all rewards
 * GET /api/admin/rewards
 */
router.get('/rewards', getAllRewards);

/**
 * Update reward
 * PUT /api/admin/rewards/:id
 */
router.put('/rewards/:id', updateReward);

/**
 * Delete reward
 * DELETE /api/admin/rewards/:id
 */
router.delete('/rewards/:id', deleteReward);

export default router;
