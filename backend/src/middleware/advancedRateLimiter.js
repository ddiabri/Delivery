import { query } from '../config/database.js';

// In-memory cache for rate limiting (fast lookup)
const rateLimitCache = new Map();
const whitelistCache = new Set();
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Rate limit configurations for different endpoints
const RATE_LIMIT_CONFIG = {
  // Authentication endpoints - strictest
  '/api/auth/login': { requests: 5, windowMs: 15 * 60 * 1000 },
  '/api/auth/register': { requests: 3, windowMs: 60 * 60 * 1000 },
  '/api/auth/forgot-password': { requests: 3, windowMs: 60 * 60 * 1000 },

  // Delivery endpoints - moderate
  '/api/deliveries': { requests: 100, windowMs: 15 * 60 * 1000 },
  '/api/drivers': { requests: 50, windowMs: 15 * 60 * 1000 },
  '/api/guest': { requests: 20, windowMs: 15 * 60 * 1000 },

  // Chat endpoints - moderate
  '/api/messages': { requests: 60, windowMs: 15 * 60 * 1000 },

  // Admin endpoints - moderate
  '/api/admin': { requests: 150, windowMs: 15 * 60 * 1000 },
  '/api/bulk-messages': { requests: 50, windowMs: 15 * 60 * 1000 },

  // Points and rewards - moderate
  '/api/points': { requests: 100, windowMs: 15 * 60 * 1000 },

  // Default - generous
  default: { requests: 100, windowMs: 15 * 60 * 1000 }
};

// User role-based multipliers (authenticated users can have higher limits)
const ROLE_MULTIPLIERS = {
  customer: 1.5,
  driver: 1.5,
  admin: 3.0,
  guest: 0.5
};

const PROGRESSIVE_DELAYS = [0, 500, 1000, 2000, 5000]; // ms delays after violations

/**
 * Load IP whitelist into cache
 */
export const loadWhitelist = async () => {
  try {
    const result = await query('SELECT ip_address FROM ip_whitelist');
    whitelistCache.clear();
    result.rows.forEach((row) => {
      whitelistCache.add(row.ip_address);
    });
    console.log(`✅ Loaded ${whitelistCache.size} whitelisted IPs`);
  } catch (err) {
    console.error('Error loading whitelist:', err);
  }
};

/**
 * Get client IP address (handles proxies)
 */
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.ip ||
    req.connection.remoteAddress;
};

/**
 * Get rate limit config for endpoint
 */
const getRateLimitConfig = (endpoint) => {
  // Try exact match first
  if (RATE_LIMIT_CONFIG[endpoint]) {
    return RATE_LIMIT_CONFIG[endpoint];
  }

  // Try prefix match (e.g., /api/deliveries for /api/deliveries/:id)
  for (const [path, config] of Object.entries(RATE_LIMIT_CONFIG)) {
    if (endpoint.startsWith(path)) {
      return config;
    }
  }

  return RATE_LIMIT_CONFIG.default;
};

/**
 * Check and update rate limit
 */
const checkRateLimit = async (ip, userId, endpoint, method) => {
  const now = Date.now();
  const cacheKey = `${userId || ip}:${endpoint}:${method}`;

  let record = rateLimitCache.get(cacheKey);
  const config = getRateLimitConfig(endpoint);

  // Check if window expired
  if (record && now - record.windowStart > config.windowMs) {
    record = null;
    rateLimitCache.delete(cacheKey);
  }

  if (!record) {
    // New window
    record = {
      requests: 1,
      windowStart: now,
      violations: 0,
      lastViolationTime: null
    };
  } else {
    record.requests++;
  }

  rateLimitCache.set(cacheKey, record);

  // Get limit multiplier based on user role
  let multiplier = 1;
  if (userId) {
    try {
      const userResult = await query(
        'SELECT role FROM users WHERE id = $1',
        [userId]
      );
      if (userResult.rows.length > 0) {
        multiplier = ROLE_MULTIPLIERS[userResult.rows[0].role] || 1;
      }
    } catch (err) {
      console.error('Error fetching user role:', err);
    }
  }

  const allowedRequests = Math.ceil(config.requests * multiplier);

  return {
    allowed: record.requests <= allowedRequests,
    current: record.requests,
    limit: allowedRequests,
    resetTime: record.windowStart + config.windowMs,
    violations: record.violations,
    blocked: record.blocked || false
  };
};

/**
 * Log rate limit violation to database
 */
const logViolation = async (ip, userId, endpoint, method, violations) => {
  try {
    // Check for existing record
    const existingResult = await query(
      `SELECT id, request_count FROM rate_limit_tracking
       WHERE endpoint = $1 AND method = $2
       AND (ip_address = $3 OR user_id = $4)
       AND DATE(created_at) = CURRENT_DATE`,
      [endpoint, method, ip, userId || null]
    );

    if (existingResult.rows.length > 0) {
      // Update existing
      await query(
        `UPDATE rate_limit_tracking
         SET request_count = request_count + 1, last_request_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [existingResult.rows[0].id]
      );
    } else {
      // Create new
      await query(
        `INSERT INTO rate_limit_tracking (ip_address, user_id, endpoint, method, request_count)
         VALUES ($1, $2, $3, $4, 1)`,
        [ip, userId || null, endpoint, method]
      );
    }

    // Apply progressive blocking after repeated violations
    if (violations >= 3) {
      const blockDuration = 15 * 60 * 1000; // 15 minutes
      const blockUntil = new Date(Date.now() + blockDuration);

      await query(
        `UPDATE rate_limit_tracking
         SET is_blocked = true, block_until = $2, block_reason = $3
         WHERE endpoint = $1 AND (ip_address = $4 OR user_id = $5)`,
        [
          endpoint,
          blockUntil,
          `Too many violations (${violations})`,
          ip,
          userId || null
        ]
      );

      console.log(`⚠️ Rate limit block applied to ${userId || ip} for ${endpoint}`);
    }
  } catch (err) {
    console.error('Error logging rate limit violation:', err);
  }
};

/**
 * Check if IP/user is currently blocked
 */
const isBlocked = async (ip, userId, endpoint, method) => {
  try {
    const result = await query(
      `SELECT is_blocked, block_until FROM rate_limit_tracking
       WHERE endpoint = $1 AND method = $2
       AND (ip_address = $3 OR user_id = $4)
       AND is_blocked = true
       AND block_until > CURRENT_TIMESTAMP`,
      [endpoint, method, ip, userId || null]
    );

    return result.rows.length > 0;
  } catch (err) {
    console.error('Error checking if blocked:', err);
    return false;
  }
};

/**
 * Unblock IP or user (admin function)
 */
export const unblockRateLimitViolator = async (ipOrUserId, isUserId = false) => {
  try {
    if (isUserId) {
      await query(
        'UPDATE rate_limit_tracking SET is_blocked = false, block_until = NULL WHERE user_id = $1',
        [ipOrUserId]
      );
    } else {
      await query(
        'UPDATE rate_limit_tracking SET is_blocked = false, block_until = NULL WHERE ip_address = $1',
        [ipOrUserId]
      );
    }
    return true;
  } catch (err) {
    console.error('Error unblocking:', err);
    return false;
  }
};

/**
 * Main rate limiting middleware
 */
export const advancedRateLimitMiddleware = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userId = req.user?.id || null;
    const endpoint = req.baseUrl || req.path;
    const method = req.method;

    // Skip rate limiting for whitelisted IPs
    if (whitelistCache.has(ip)) {
      return next();
    }

    // Check if currently blocked
    if (await isBlocked(ip, userId, endpoint, method)) {
      return res.status(429).json({
        error: 'Rate limit exceeded - you are temporarily blocked',
        retryAfter: 900, // 15 minutes in seconds
      });
    }

    // Check rate limit
    const limitStatus = await checkRateLimit(ip, userId, endpoint, method);

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': limitStatus.limit,
      'X-RateLimit-Remaining': Math.max(0, limitStatus.limit - limitStatus.current),
      'X-RateLimit-Reset': new Date(limitStatus.resetTime).toISOString()
    });

    if (!limitStatus.allowed) {
      // Violation - log and apply progressive delay
      const violations = limitStatus.violations + 1;
      await logViolation(ip, userId, endpoint, method, violations);

      const delayIndex = Math.min(violations, PROGRESSIVE_DELAYS.length - 1);
      const delay = PROGRESSIVE_DELAYS[delayIndex];

      console.warn(
        `⚠️ Rate limit exceeded: ${userId || ip} - ${endpoint} ${method} (violation #${violations})`
      );

      // Apply progressive delay
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((limitStatus.resetTime - Date.now()) / 1000),
        violations: violations,
        blocked: violations >= 3
      });
    }

    next();
  } catch (err) {
    console.error('Rate limiting error:', err);
    // On error, allow request (fail open)
    next();
  }
};

/**
 * Cleanup expired cache entries periodically
 */
export const initializeCacheCleanup = () => {
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of rateLimitCache.entries()) {
      const config = getRateLimitConfig(key.split(':')[1]);
      if (now - value.windowStart > config.windowMs) {
        rateLimitCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired rate limit cache entries`);
    }
  }, CACHE_CLEANUP_INTERVAL);
};

/**
 * Get rate limiting statistics for admin
 */
export const getRateLimitStats = async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get today's stats
    const todayResult = await query(
      `SELECT
        endpoint, method,
        COUNT(*) as total_requests,
        COUNT(CASE WHEN is_blocked THEN 1 END) as blocked_requests,
        COUNT(DISTINCT ip_address) as unique_ips,
        COUNT(DISTINCT user_id) as unique_users
       FROM rate_limit_tracking
       WHERE DATE(created_at) = CURRENT_DATE
       GROUP BY endpoint, method
       ORDER BY total_requests DESC`
    );

    // Get blocked IPs/users
    const blockedResult = await query(
      `SELECT ip_address, user_id, endpoint, block_reason, block_until
       FROM rate_limit_tracking
       WHERE is_blocked = true AND block_until > CURRENT_TIMESTAMP
       ORDER BY block_until DESC`
    );

    // Get hourly trend
    const trendResult = await query(
      `SELECT
        DATE_TRUNC('hour', created_at) as hour,
        COUNT(*) as requests,
        COUNT(CASE WHEN is_blocked THEN 1 END) as violations
       FROM rate_limit_tracking
       WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
       GROUP BY DATE_TRUNC('hour', created_at)
       ORDER BY hour DESC`
    );

    res.json({
      stats: {
        today: todayResult.rows,
        currentlyBlocked: blockedResult.rows,
        trend: trendResult.rows,
        cacheSize: rateLimitCache.size,
        whitelistSize: whitelistCache.size
      }
    });
  } catch (err) {
    console.error('Error getting rate limit stats:', err);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};

/**
 * Add IP to whitelist
 */
export const addToWhitelist = async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { ip_address, description } = req.body;

    if (!ip_address) {
      return res.status(400).json({ error: 'IP address required' });
    }

    await query(
      'INSERT INTO ip_whitelist (ip_address, description, created_by) VALUES ($1, $2, $3)',
      [ip_address, description || null, req.user.id]
    );

    whitelistCache.add(ip_address);

    res.json({ message: 'IP added to whitelist', ip_address });
  } catch (err) {
    console.error('Error adding to whitelist:', err);
    res.status(500).json({ error: 'Failed to add IP to whitelist' });
  }
};

/**
 * Remove IP from whitelist
 */
export const removeFromWhitelist = async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { ip_address } = req.params;

    await query('DELETE FROM ip_whitelist WHERE ip_address = $1', [ip_address]);

    whitelistCache.delete(ip_address);

    res.json({ message: 'IP removed from whitelist' });
  } catch (err) {
    console.error('Error removing from whitelist:', err);
    res.status(500).json({ error: 'Failed to remove IP from whitelist' });
  }
};

/**
 * Get whitelist
 */
export const getWhitelist = async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await query(
      `SELECT w.*, u.full_name as created_by_name
       FROM ip_whitelist w
       LEFT JOIN users u ON w.created_by = u.id
       ORDER BY w.created_at DESC`
    );

    res.json({ whitelist: result.rows });
  } catch (err) {
    console.error('Error fetching whitelist:', err);
    res.status(500).json({ error: 'Failed to fetch whitelist' });
  }
};

// Initialize on module load
initializeCacheCleanup();
loadWhitelist();
