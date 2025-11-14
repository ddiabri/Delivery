import { query } from '../config/database.js';
import {
  hashPassword,
  comparePassword,
  createTokenPair,
  verifyRefreshToken,
} from '../utils/auth.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Register a new user
 */
export const register = async (req, res) => {
  try {
    const { email, password, full_name, phone, role = 'customer', address } = req.validated;

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'Email already registered',
        code: 'EMAIL_EXISTS',
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);
    const userId = uuidv4();

    // Create user
    const result = await query(
      `INSERT INTO users (id, email, password_hash, full_name, phone, role, address, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, full_name, phone, role, address, created_at`,
      [userId, email, passwordHash, full_name, phone, role, address, true]
    );

    const user = result.rows[0];

    // Generate tokens
    const tokens = createTokenPair(user);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        role: user.role,
      },
      ...tokens,
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({
      error: 'Registration failed',
      code: 'REGISTRATION_ERROR',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

/**
 * Login user
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.validated;

    // Find user
    const result = await query(
      `SELECT id, email, password_hash, full_name, phone, role, is_active
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid email or password',
        code: 'AUTH_FAILED',
      });
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({
        error: 'Account is disabled',
        code: 'ACCOUNT_DISABLED',
      });
    }

    // Verify password
    const passwordMatch = await comparePassword(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        error: 'Invalid email or password',
        code: 'AUTH_FAILED',
      });
    }

    // Generate tokens
    const tokens = createTokenPair(user);

    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        role: user.role,
      },
      ...tokens,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      error: 'Login failed',
      code: 'LOGIN_ERROR',
    });
  }
};

/**
 * Get current user profile
 */
export const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT id, email, full_name, phone, role, address, profile_image_url, is_active, created_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    res.status(200).json({
      user: result.rows[0],
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({
      error: 'Failed to fetch user',
      code: 'FETCH_ERROR',
    });
  }
};

/**
 * Update user profile
 */
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { full_name, phone, address } = req.validated;

    const result = await query(
      `UPDATE users
       SET full_name = COALESCE($1, full_name),
           phone = COALESCE($2, phone),
           address = COALESCE($3, address),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, email, full_name, phone, role, address, updated_at`,
      [full_name, phone, address, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    res.status(200).json({
      message: 'Profile updated successfully',
      user: result.rows[0],
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({
      error: 'Failed to update profile',
      code: 'UPDATE_ERROR',
    });
  }
};

/**
 * Refresh access token
 */
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token required',
        code: 'NO_REFRESH_TOKEN',
      });
    }

    try {
      const decoded = verifyRefreshToken(refreshToken);

      // Fetch user to ensure they still exist
      const result = await query(
        'SELECT id, email, full_name, phone, role FROM users WHERE id = $1',
        [decoded.id]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      const user = result.rows[0];
      const tokens = createTokenPair(user);

      res.status(200).json({
        message: 'Token refreshed successfully',
        ...tokens,
      });
    } catch (err) {
      return res.status(401).json({
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      });
    }
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(500).json({
      error: 'Token refresh failed',
      code: 'REFRESH_ERROR',
    });
  }
};

/**
 * Logout user (client-side token removal)
 */
export const logout = async (req, res) => {
  try {
    // In a stateless JWT system, logout is handled client-side by removing the token
    // This endpoint can be used for logging purposes or invalidating tokens in a token blacklist
    res.status(200).json({
      message: 'Logged out successfully',
      code: 'LOGOUT_SUCCESS',
    });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({
      error: 'Logout failed',
      code: 'LOGOUT_ERROR',
    });
  }
};

export default {
  register,
  login,
  getCurrentUser,
  updateProfile,
  refreshToken,
  logout,
};
