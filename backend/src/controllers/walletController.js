import { query } from '../config/database.js';
import crypto from 'crypto';

/**
 * Get user's wallet details
 */
export const getWallet = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT id, user_id, balance, currency, status, total_loaded, total_spent, last_transaction_at
       FROM user_wallets WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Create wallet if doesn't exist
      const createResult = await query(
        `INSERT INTO user_wallets (user_id, balance, currency)
         VALUES ($1, 0.00, 'USD')
         RETURNING id, user_id, balance, currency, status, total_loaded, total_spent, last_transaction_at`,
        [userId]
      );
      return res.json({ wallet: createResult.rows[0] });
    }

    res.json({ wallet: result.rows[0] });
  } catch (err) {
    console.error('Error getting wallet:', err);
    res.status(500).json({ error: 'Failed to fetch wallet' });
  }
};

/**
 * Get top-up packages
 */
export const getTopUpPackages = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, amount, bonus_amount, currency, description
       FROM wallet_top_up_packages
       WHERE is_active = true
       ORDER BY amount ASC`
    );

    res.json({ packages: result.rows });
  } catch (err) {
    console.error('Error getting packages:', err);
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
};

/**
 * Get transaction history
 */
export const getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;

    const result = await query(
      `SELECT id, transaction_type, amount, description, balance_before, balance_after,
              status, created_at
       FROM wallet_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) as total FROM wallet_transactions WHERE user_id = $1',
      [userId]
    );

    res.json({
      transactions: result.rows,
      total: parseInt(countResult.rows[0].total),
      hasMore: offset + limit < parseInt(countResult.rows[0].total)
    });
  } catch (err) {
    console.error('Error getting transaction history:', err);
    res.status(500).json({ error: 'Failed to fetch transaction history' });
  }
};

/**
 * Reload wallet (add funds)
 */
export const reloadWallet = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, bonus_amount, payment_method_id, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Get or create wallet
    let walletResult = await query(
      'SELECT id, balance FROM user_wallets WHERE user_id = $1',
      [userId]
    );

    let walletId;
    if (walletResult.rows.length === 0) {
      const createWallet = await query(
        'INSERT INTO user_wallets (user_id, balance) VALUES ($1, 0) RETURNING id',
        [userId]
      );
      walletId = createWallet.rows[0].id;
    } else {
      walletId = walletResult.rows[0].id;
    }

    // Calculate new balance
    const currentBalance = walletResult.rows.length > 0 ? parseFloat(walletResult.rows[0].balance) : 0;
    const totalAmount = parseFloat(amount) + (parseFloat(bonus_amount) || 0);
    const newBalance = currentBalance + totalAmount;

    // Update wallet balance
    await query(
      `UPDATE user_wallets
       SET balance = $2, total_loaded = total_loaded + $2, last_transaction_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [walletId, totalAmount]
    );

    // Log transaction
    const transactionResult = await query(
      `INSERT INTO wallet_transactions (
        wallet_id, user_id, transaction_type, amount, description,
        balance_before, balance_after, payment_method_id, status
      )
      VALUES ($1, $2, 'RELOAD', $3, $4, $5, $6, $7, 'COMPLETED')
      RETURNING id, amount, balance_after, created_at`,
      [
        walletId,
        userId,
        totalAmount,
        description || `Wallet reload: $${amount}${bonus_amount ? ` + $${bonus_amount} bonus` : ''}`,
        currentBalance,
        newBalance,
        payment_method_id || null
      ]
    );

    res.status(201).json({
      message: 'Wallet reloaded successfully',
      transaction: transactionResult.rows[0],
      newBalance: newBalance
    });
  } catch (err) {
    console.error('Error reloading wallet:', err);
    res.status(500).json({ error: 'Failed to reload wallet' });
  }
};

/**
 * Make payment from wallet
 */
export const makePayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, delivery_id, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Get wallet
    const walletResult = await query(
      'SELECT id, balance FROM user_wallets WHERE user_id = $1',
      [userId]
    );

    if (walletResult.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const walletId = walletResult.rows[0].id;
    const currentBalance = parseFloat(walletResult.rows[0].balance);

    if (currentBalance < amount) {
      return res.status(400).json({
        error: 'Insufficient balance',
        current_balance: currentBalance,
        required_amount: amount
      });
    }

    // Deduct amount
    const newBalance = currentBalance - parseFloat(amount);
    await query(
      `UPDATE user_wallets
       SET balance = $2, total_spent = total_spent + $3, last_transaction_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [walletId, newBalance, amount]
    );

    // Log transaction
    const transactionResult = await query(
      `INSERT INTO wallet_transactions (
        wallet_id, user_id, transaction_type, amount, description,
        balance_before, balance_after, delivery_id, status
      )
      VALUES ($1, $2, 'PAYMENT', $3, $4, $5, $6, $7, 'COMPLETED')
      RETURNING id, amount, balance_after, created_at`,
      [
        walletId,
        userId,
        amount,
        description || `Delivery payment (ID: ${delivery_id})`,
        currentBalance,
        newBalance,
        delivery_id || null
      ]
    );

    res.json({
      message: 'Payment processed successfully',
      transaction: transactionResult.rows[0],
      newBalance: newBalance
    });
  } catch (err) {
    console.error('Error making payment:', err);
    res.status(500).json({ error: 'Failed to process payment' });
  }
};

/**
 * Refund to wallet
 */
export const refundToWallet = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { user_id, amount, reason } = req.body;

    if (!user_id || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    // Get wallet
    const walletResult = await query(
      'SELECT id, balance FROM user_wallets WHERE user_id = $1',
      [user_id]
    );

    if (walletResult.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const walletId = walletResult.rows[0].id;
    const currentBalance = parseFloat(walletResult.rows[0].balance);
    const newBalance = currentBalance + parseFloat(amount);

    // Update balance
    await query(
      'UPDATE user_wallets SET balance = $2, total_loaded = total_loaded + $2 WHERE id = $1',
      [walletId, amount]
    );

    // Log refund
    const transactionResult = await query(
      `INSERT INTO wallet_transactions (
        wallet_id, user_id, transaction_type, amount, description,
        balance_before, balance_after, status
      )
      VALUES ($1, $2, 'REFUND', $3, $4, $5, $6, 'COMPLETED')
      RETURNING *`,
      [
        walletId,
        user_id,
        amount,
        reason || 'Admin refund',
        currentBalance,
        newBalance
      ]
    );

    res.json({
      message: 'Refund processed',
      transaction: transactionResult.rows[0]
    });
  } catch (err) {
    console.error('Error processing refund:', err);
    res.status(500).json({ error: 'Failed to process refund' });
  }
};

/**
 * Get available bonuses
 */
export const getAvailableBonuses = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT id, bonus_type, amount, description, code, expires_at
       FROM wallet_bonuses
       WHERE user_id = $1 AND is_claimed = false AND expires_at > CURRENT_TIMESTAMP
       ORDER BY expires_at ASC`,
      [userId]
    );

    res.json({ bonuses: result.rows });
  } catch (err) {
    console.error('Error getting bonuses:', err);
    res.status(500).json({ error: 'Failed to fetch bonuses' });
  }
};

/**
 * Claim bonus
 */
export const claimBonus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bonus_id } = req.params;

    // Get bonus
    const bonusResult = await query(
      'SELECT id, user_id, amount, expires_at FROM wallet_bonuses WHERE id = $1',
      [bonus_id]
    );

    if (bonusResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bonus not found' });
    }

    const bonus = bonusResult.rows[0];

    if (bonus.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (new Date(bonus.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Bonus expired' });
    }

    // Mark as claimed
    await query(
      'UPDATE wallet_bonuses SET is_claimed = true, claimed_at = CURRENT_TIMESTAMP WHERE id = $1',
      [bonus_id]
    );

    // Add to wallet
    const walletResult = await query(
      'SELECT id, balance FROM user_wallets WHERE user_id = $1',
      [userId]
    );

    const walletId = walletResult.rows[0].id;
    const currentBalance = parseFloat(walletResult.rows[0].balance);
    const newBalance = currentBalance + parseFloat(bonus.amount);

    await query(
      'UPDATE user_wallets SET balance = $2, total_loaded = total_loaded + $2 WHERE id = $1',
      [walletId, bonus.amount]
    );

    // Log transaction
    const transactionResult = await query(
      `INSERT INTO wallet_transactions (
        wallet_id, user_id, transaction_type, amount, description,
        balance_before, balance_after, status
      )
      VALUES ($1, $2, 'BONUS', $3, 'Bonus claimed', $4, $5, 'COMPLETED')
      RETURNING *`,
      [walletId, userId, bonus.amount, currentBalance, newBalance]
    );

    res.json({
      message: 'Bonus claimed successfully',
      transaction: transactionResult.rows[0]
    });
  } catch (err) {
    console.error('Error claiming bonus:', err);
    res.status(500).json({ error: 'Failed to claim bonus' });
  }
};

/**
 * Get wallet statistics (admin)
 */
export const getWalletStats = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const statsResult = await query(`
      SELECT
        COUNT(DISTINCT user_id) as total_users,
        SUM(balance) as total_balance,
        SUM(total_loaded) as total_loaded,
        SUM(total_spent) as total_spent,
        AVG(balance) as avg_balance
      FROM user_wallets
      WHERE status = 'ACTIVE'
    `);

    const transactionStats = await query(`
      SELECT
        transaction_type,
        COUNT(*) as count,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount
      FROM wallet_transactions
      WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
      GROUP BY transaction_type
    `);

    res.json({
      stats: {
        wallets: statsResult.rows[0],
        transactions: transactionStats.rows
      }
    });
  } catch (err) {
    console.error('Error getting wallet stats:', err);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};
