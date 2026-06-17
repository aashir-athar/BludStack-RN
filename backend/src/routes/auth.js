// src/routes/auth.js
'use strict';

const router = require('express').Router();
const { body } = require('express-validator');

const { requireAuth }             = require('../middleware/auth');
const { validate }                = require('../middleware/validate');
const { authRateLimiter }         = require('../middleware/rateLimiter');
const { getMe, register, logout } = require('../controllers/authController');

const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const ROLES        = ['donor', 'recipient', 'both'];

// GET  /api/v1/auth/me
router.get('/me', requireAuth, getMe);

// POST /api/v1/auth/register
router.post(
  '/register',
  authRateLimiter,
  requireAuth,
  [
    body('full_name')
      .trim()
      .isLength({ min: 2, max: 80 })
      .withMessage('full_name must be 2-80 characters'),
    body('blood_group')
      .isIn(BLOOD_GROUPS)
      .withMessage(`blood_group must be one of: ${BLOOD_GROUPS.join(', ')}`),
    body('gender')
      .optional({ nullable: true })
      .isString()
      .isLength({ max: 40 }),
    body('date_of_birth')
      .optional({ nullable: true })
      .isISO8601({ strict: true })
      .withMessage('date_of_birth must be ISO-8601 YYYY-MM-DD'),
    body('phone')
      .optional({ nullable: true })
      .isString()
      .isLength({ max: 32 }),
    body('whatsapp_available')
      .optional()
      .isBoolean(),
    body('medical_conditions')
      .optional()
      .isArray(),
    body('share_medical_history')
      .optional()
      .isBoolean(),
    body('is_available_to_donate')
      .optional()
      .isBoolean(),
    body('role')
      .optional()
      .isIn(ROLES)
      .withMessage(`role must be one of: ${ROLES.join(', ')}`),
  ],
  validate,
  register,
);

// POST /api/v1/auth/logout
router.post('/logout', requireAuth, logout);

module.exports = router;
