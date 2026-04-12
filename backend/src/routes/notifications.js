// src/routes/notifications.js
'use strict';

const router = require('express').Router();
const { body } = require('express-validator');

const { requireAuth }       = require('../middleware/auth');
const { validate }          = require('../middleware/validate');
const { notifRateLimiter }  = require('../middleware/rateLimiter');
const {
  registerToken,
  removeToken,
  sendTestNotification,
} = require('../controllers/notificationController');

// PUT  /api/v1/notifications/token
router.put(
  '/token',
  requireAuth,
  [
    body('token')
      .isString()
      .isLength({ min: 10, max: 200 })
      .withMessage('A valid Expo push token is required'),
  ],
  validate,
  registerToken,
);

// DELETE /api/v1/notifications/token
router.delete('/token', requireAuth, removeToken);

// POST /api/v1/notifications/test
router.post(
  '/test',
  requireAuth,
  notifRateLimiter,
  sendTestNotification,
);

module.exports = router;
