import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getWallet,
  getTopUpPackages,
  getTransactionHistory,
  reloadWallet,
  makePayment,
  refundToWallet,
  getAvailableBonuses,
  claimBonus,
  getWalletStats
} from '../controllers/walletController.js';

const router = express.Router();

// User wallet routes
router.get('/', authenticate, getWallet);
router.get('/packages', authenticate, getTopUpPackages);
router.get('/transactions', authenticate, getTransactionHistory);
router.post('/reload', authenticate, reloadWallet);
router.post('/payment', authenticate, makePayment);
router.get('/bonuses', authenticate, getAvailableBonuses);
router.post('/bonuses/:bonus_id/claim', authenticate, claimBonus);

// Admin routes
router.post('/refund', authenticate, refundToWallet);
router.get('/stats', authenticate, getWalletStats);

export default router;
