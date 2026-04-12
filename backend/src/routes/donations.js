// src/routes/donations.js
'use strict';

const router = require('express').Router();
const { body } = require('express-validator');

const { requireAuth }  = require('../middleware/auth');
const { validate }     = require('../middleware/validate');
const {
  acceptRequest,
  declineRequest,
  completeDonation,
  getDonationHistory,
} = require('../controllers/donationController');

// GET  /api/v1/donations/history
router.get('/history', requireAuth, getDonationHistory);

// POST /api/v1/donations/accept
router.post(
  '/accept',
  requireAuth,
  [
    body('requestId')
      .isUUID()
      .withMessage('requestId must be a valid UUID'),
  ],
  validate,
  acceptRequest,
);

// POST /api/v1/donations/decline
router.post(
  '/decline',
  requireAuth,
  [
    body('requestId')
      .isUUID()
      .withMessage('requestId must be a valid UUID'),
  ],
  validate,
  declineRequest,
);

// POST /api/v1/donations/complete
router.post(
  '/complete',
  requireAuth,
  [
    body('requestId').isUUID().withMessage('requestId must be a valid UUID'),
    body('donorId').isUUID().withMessage('donorId must be a valid UUID'),
  ],
  validate,
  completeDonation,
);

module.exports = router;
