import { query } from '../config/database.js';

/**
 * Get delivery preferences for user
 */
export const getDeliveryPreferences = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT * FROM delivery_preferences WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Return default preferences if not set
      return res.json({
        preferences: {
          user_id: userId,
          user_type: req.user.role,
          preferred_days_of_week: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
          preferred_time_windows: [{ start: '08:00', end: '18:00' }],
          excluded_locations: [],
          preferred_locations: [],
          require_signature: true,
          allow_cash_payment: false,
        },
      });
    }

    res.json({ preferences: result.rows[0] });
  } catch (err) {
    console.error('Error fetching delivery preferences:', err);
    res.status(500).json({ error: 'Failed to fetch delivery preferences' });
  }
};

/**
 * Create or update delivery preferences
 */
export const updateDeliveryPreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      preferred_days_of_week,
      preferred_time_windows,
      excluded_locations,
      preferred_locations,
      max_weight_preference,
      delivery_radius_km,
      require_signature,
      allow_cash_payment,
      special_instructions,
      is_active,
    } = req.body;

    // Check if preferences already exist
    const existingResult = await query(
      `SELECT id FROM delivery_preferences WHERE user_id = $1`,
      [userId]
    );

    let result;

    if (existingResult.rows.length > 0) {
      // Update existing preferences
      const updates = [];
      const params = [userId];
      let paramIndex = 2;

      if (preferred_days_of_week) {
        updates.push(`preferred_days_of_week = $${paramIndex}`);
        params.push(JSON.stringify(preferred_days_of_week));
        paramIndex++;
      }

      if (preferred_time_windows) {
        updates.push(`preferred_time_windows = $${paramIndex}`);
        params.push(JSON.stringify(preferred_time_windows));
        paramIndex++;
      }

      if (excluded_locations) {
        updates.push(`excluded_locations = $${paramIndex}`);
        params.push(JSON.stringify(excluded_locations));
        paramIndex++;
      }

      if (preferred_locations) {
        updates.push(`preferred_locations = $${paramIndex}`);
        params.push(JSON.stringify(preferred_locations));
        paramIndex++;
      }

      if (max_weight_preference !== undefined) {
        updates.push(`max_weight_preference = $${paramIndex}`);
        params.push(max_weight_preference);
        paramIndex++;
      }

      if (delivery_radius_km !== undefined) {
        updates.push(`delivery_radius_km = $${paramIndex}`);
        params.push(delivery_radius_km);
        paramIndex++;
      }

      if (require_signature !== undefined) {
        updates.push(`require_signature = $${paramIndex}`);
        params.push(require_signature);
        paramIndex++;
      }

      if (allow_cash_payment !== undefined) {
        updates.push(`allow_cash_payment = $${paramIndex}`);
        params.push(allow_cash_payment);
        paramIndex++;
      }

      if (special_instructions !== undefined) {
        updates.push(`special_instructions = $${paramIndex}`);
        params.push(special_instructions);
        paramIndex++;
      }

      if (is_active !== undefined) {
        updates.push(`is_active = $${paramIndex}`);
        params.push(is_active);
        paramIndex++;
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');

      result = await query(
        `UPDATE delivery_preferences
         SET ${updates.join(', ')}
         WHERE user_id = $1
         RETURNING *`,
        params
      );
    } else {
      // Create new preferences
      result = await query(
        `INSERT INTO delivery_preferences (
          user_id, user_type, preferred_days_of_week, preferred_time_windows,
          excluded_locations, preferred_locations, max_weight_preference,
          delivery_radius_km, require_signature, allow_cash_payment,
          special_instructions, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          userId,
          req.user.role,
          JSON.stringify(preferred_days_of_week || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']),
          JSON.stringify(preferred_time_windows || [{ start: '08:00', end: '18:00' }]),
          JSON.stringify(excluded_locations || []),
          JSON.stringify(preferred_locations || []),
          max_weight_preference || null,
          delivery_radius_km || null,
          require_signature !== undefined ? require_signature : true,
          allow_cash_payment !== undefined ? allow_cash_payment : false,
          special_instructions || null,
          is_active !== undefined ? is_active : true,
        ]
      );
    }

    res.json({
      message: 'Delivery preferences updated successfully',
      preferences: result.rows[0],
    });
  } catch (err) {
    console.error('Error updating delivery preferences:', err);
    res.status(500).json({ error: 'Failed to update delivery preferences' });
  }
};

/**
 * Add a preferred location
 */
export const addPreferredLocation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { location, name, latitude, longitude } = req.body;

    if (!location || !latitude || !longitude) {
      return res.status(400).json({ error: 'Location details required' });
    }

    const result = await query(
      `SELECT preferred_locations FROM delivery_preferences WHERE user_id = $1`,
      [userId]
    );

    let preferredLocations = [];
    if (result.rows.length > 0) {
      preferredLocations = result.rows[0].preferred_locations || [];
    }

    const newLocation = {
      id: Math.random().toString(36).substr(2, 9),
      name: name || location,
      address: location,
      latitude,
      longitude,
      addedAt: new Date().toISOString(),
    };

    preferredLocations.push(newLocation);

    const updateResult = await query(
      `UPDATE delivery_preferences
       SET preferred_locations = $2, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
       RETURNING *`,
      [userId, JSON.stringify(preferredLocations)]
    );

    res.json({
      message: 'Preferred location added',
      preferences: updateResult.rows[0],
    });
  } catch (err) {
    console.error('Error adding preferred location:', err);
    res.status(500).json({ error: 'Failed to add preferred location' });
  }
};

/**
 * Remove a preferred location
 */
export const removePreferredLocation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { locationId } = req.params;

    const result = await query(
      `SELECT preferred_locations FROM delivery_preferences WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Delivery preferences not found' });
    }

    let preferredLocations = result.rows[0].preferred_locations || [];
    preferredLocations = preferredLocations.filter((loc) => loc.id !== locationId);

    const updateResult = await query(
      `UPDATE delivery_preferences
       SET preferred_locations = $2, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
       RETURNING *`,
      [userId, JSON.stringify(preferredLocations)]
    );

    res.json({
      message: 'Preferred location removed',
      preferences: updateResult.rows[0],
    });
  } catch (err) {
    console.error('Error removing preferred location:', err);
    res.status(500).json({ error: 'Failed to remove preferred location' });
  }
};

/**
 * Add an excluded location
 */
export const addExcludedLocation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { location, radius } = req.body;

    if (!location) {
      return res.status(400).json({ error: 'Location required' });
    }

    const result = await query(
      `SELECT excluded_locations FROM delivery_preferences WHERE user_id = $1`,
      [userId]
    );

    let excludedLocations = [];
    if (result.rows.length > 0) {
      excludedLocations = result.rows[0].excluded_locations || [];
    }

    const newExclusion = {
      id: Math.random().toString(36).substr(2, 9),
      address: location,
      radius: radius || 5,
      addedAt: new Date().toISOString(),
    };

    excludedLocations.push(newExclusion);

    const updateResult = await query(
      `UPDATE delivery_preferences
       SET excluded_locations = $2, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
       RETURNING *`,
      [userId, JSON.stringify(excludedLocations)]
    );

    res.json({
      message: 'Excluded location added',
      preferences: updateResult.rows[0],
    });
  } catch (err) {
    console.error('Error adding excluded location:', err);
    res.status(500).json({ error: 'Failed to add excluded location' });
  }
};

/**
 * Remove an excluded location
 */
export const removeExcludedLocation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { locationId } = req.params;

    const result = await query(
      `SELECT excluded_locations FROM delivery_preferences WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Delivery preferences not found' });
    }

    let excludedLocations = result.rows[0].excluded_locations || [];
    excludedLocations = excludedLocations.filter((loc) => loc.id !== locationId);

    const updateResult = await query(
      `UPDATE delivery_preferences
       SET excluded_locations = $2, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
       RETURNING *`,
      [userId, JSON.stringify(excludedLocations)]
    );

    res.json({
      message: 'Excluded location removed',
      preferences: updateResult.rows[0],
    });
  } catch (err) {
    console.error('Error removing excluded location:', err);
    res.status(500).json({ error: 'Failed to remove excluded location' });
  }
};
