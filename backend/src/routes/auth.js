// src/routes/auth.js
'use strict';

const router = require('express').Router();
const { body } = require('express-validator');

const { requireAuth }             = require('../middleware/auth');
const { validate }                = require('../middleware/validate');
const { authRateLimiter }         = require('../middleware/rateLimiter');
const { getMe, register, logout } = require('../controllers/authController');

const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

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
      .withMessage('full_name must be 2–80 characters'),
    body('blood_group')
      .isIn(BLOOD_GROUPS)
      .withMessage(`blood_group must be one of: ${BLOOD_GROUPS.join(', ')}`),
    body('gender')
      .optional()
      .isString()
      .isLength({ max: 40 }),
    body('medical_conditions')
      .optional()
      .isArray(),
    body('share_medical_history')
      .optional()
      .isBoolean(),
    body('is_available_to_donate')
      .optional()
      .isBoolean(),
  ],
  validate,
  register,
);

// POST /api/v1/auth/logout
router.post('/logout', requireAuth, logout);

module.exports = router;
