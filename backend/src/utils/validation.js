import Joi from 'joi';

// User validation schemas
export const userSchemas = {
  register: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Email must be a valid email address',
      'any.required': 'Email is required',
    }),
    password: Joi.string().min(8).required().messages({
      'string.min': 'Password must be at least 8 characters',
      'any.required': 'Password is required',
    }),
    full_name: Joi.string().min(2).required().messages({
      'string.min': 'Full name must be at least 2 characters',
      'any.required': 'Full name is required',
    }),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional().messages({
      'string.pattern.base': 'Phone must be a valid international format',
    }),
    role: Joi.string().valid('customer', 'driver').default('customer'),
    address: Joi.string().optional(),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  updateProfile: Joi.object({
    full_name: Joi.string().min(2).optional(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
    address: Joi.string().optional(),
  }),

  refreshToken: Joi.object({
    refreshToken: Joi.string().required(),
  }),
};

// Delivery validation schemas
export const deliverySchemas = {
  create: Joi.object({
    pickup_address: Joi.string().required(),
    pickup_latitude: Joi.number().min(-90).max(90).required(),
    pickup_longitude: Joi.number().min(-180).max(180).required(),
    delivery_address: Joi.string().required(),
    delivery_latitude: Joi.number().min(-90).max(90).required(),
    delivery_longitude: Joi.number().min(-180).max(180).required(),
    package_description: Joi.string().optional(),
    package_weight: Joi.number().positive().optional(),
    package_dimensions: Joi.string().optional(),
    priority: Joi.string().valid('LOW', 'NORMAL', 'HIGH', 'URGENT').default('NORMAL'),
    special_instructions: Joi.string().optional(),
  }),

  updateStatus: Joi.object({
    status: Joi.string()
      .valid('PENDING', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED')
      .required(),
  }),

  search: Joi.object({
    status: Joi.string().optional(),
    priority: Joi.string().optional(),
    role: Joi.string().optional(),
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0),
  }),
};

// Driver validation schemas
export const driverSchemas = {
  updateLocation: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    bearing: Joi.number().min(0).max(360).optional(),
    speed: Joi.number().min(0).optional(),
    accuracy: Joi.number().min(0).optional(),
  }),

  acceptDelivery: Joi.object({
    deliveryId: Joi.string().uuid().required(),
  }),
};

// Review validation schemas
export const reviewSchemas = {
  create: Joi.object({
    deliveryId: Joi.string().uuid().required(),
    driverId: Joi.string().uuid().required(),
    rating: Joi.number().integer().min(1).max(5).required().messages({
      'number.min': 'Rating must be between 1 and 5',
      'number.max': 'Rating must be between 1 and 5',
      'any.required': 'Rating is required',
    }),
    comment: Joi.string().max(500).optional(),
    is_anonymous: Joi.boolean().default(false),
  }),

  update: Joi.object({
    rating: Joi.number().integer().min(1).max(5).optional(),
    comment: Joi.string().max(500).optional(),
  }),
};

/**
 * Validate data against schema
 * @param {Object} data - Data to validate
 * @param {Joi.Schema} schema - Joi schema
 * @returns {Object} { value, error }
 */
export const validate = (data, schema) => {
  return schema.validate(data, {
    abortEarly: false,
    convert: true,
    stripUnknown: true,
  });
};

/**
 * Middleware to validate request body
 * @param {Joi.Schema} schema - Joi schema
 */
export const validateMiddleware = (schema) => {
  return (req, res, next) => {
    const { value, error } = validate(req.body, schema);

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details,
      });
    }

    req.validated = value;
    next();
  };
};

export default {
  userSchemas,
  deliverySchemas,
  driverSchemas,
  reviewSchemas,
  validate,
  validateMiddleware,
};
