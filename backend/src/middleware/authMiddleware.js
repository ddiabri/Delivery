import { verifyToken, extractToken } from '../utils/auth.js';

/**
 * Middleware to verify JWT token
 */
export const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = extractToken(authHeader);

    if (!token) {
      return res.status(401).json({
        error: 'Access token required',
        code: 'NO_TOKEN',
      });
    }

    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN',
      message: err.message,
    });
  }
};

/**
 * Middleware to check user role
 * @param {...string} allowedRoles - Allowed user roles
 */
export const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: allowedRoles,
        current: req.user.role,
      });
    }

    next();
  };
};

/**
 * Middleware for optional authentication
 */
export const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = extractToken(authHeader);

    if (token) {
      const decoded = verifyToken(token);
      req.user = decoded;
    }
  } catch (err) {
    // Silently ignore auth errors in optional mode
    console.debug('Optional auth failed:', err.message);
  }

  next();
};

/**
 * Middleware for error handling
 */
export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.details,
    });
  }

  if (err.name === 'AuthenticationError') {
    return res.status(401).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR',
    });
  }

  if (err.status) {
    return res.status(err.status).json({
      error: err.message,
      code: err.code,
    });
  }

  return res.status(500).json({
    error: 'Internal server error',
    code: 'SERVER_ERROR',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
};

export default {
  authenticateToken,
  authorizeRole,
  optionalAuth,
  errorHandler,
};
