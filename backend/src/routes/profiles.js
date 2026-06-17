// src/routes/profiles.js
'use strict';

const router = require('express').Router();
const { body, query, param } = require('express-validator');

const { requireAuth }     = require('../middleware/auth');
const { validate }        = require('../middleware/validate');
const {
  getProfile,
  updateMyProfile,
  updateLocation,
  getNearbyDonors,
} = require('../controllers/profileController');

const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

// GET  /api/v1/profiles/nearby-donors
// Must be declared before /:id to avoid param collision
router.get(
  '/nearby-donors',
  requireAuth,
  [
    query('lat').isFloat({ min: -90, max: 90 }).withMessage('lat must be a valid latitude'),
    query('lon').isFloat({ min: -180, max: 180 }).withMessage('lon must be a valid longitude'),
    query('radiusKm').optional().isFloat({ min: 1, max: 200 }),
    query('bloodGroup').optional().isIn(BLOOD_GROUPS),
  ],
  validate,
  getNearbyDonors,
);

// PATCH /api/v1/profiles/me
router.patch(
  '/me',
  requireAuth,
  [
    body('full_name').optional().trim().isLength({ min: 2, max: 80 }),
    body('blood_group').optional().isIn(BLOOD_GROUPS),
    body('gender').optional().isString().isLength({ max: 40 }),
    body('medical_conditions').optional().isArray(),
    body('share_medical_history').optional().isBoolean(),
    body('is_available_to_donate').optional().isBoolean(),
    body('push_token').optional().isString().isLength({ max: 200 }),
    // `optional({ nullable: true })` so an explicit `null` from the client
    // (mobile sends `address.trim() || null` to clear the column) skips the
    // .isString() check. Without this, "clear the address" returns
    // "address: Invalid value" - surfaced on profile/edit save.
    body('address').optional({ nullable: true }).isString().isLength({ max: 300 }),
  ],
  validate,
  updateMyProfile,
);

// PATCH /api/v1/profiles/me/location
router.patch(
  '/me/location',
  requireAuth,
  [
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('latitude must be valid'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('longitude must be valid'),
  ],
  validate,
  updateLocation,
);

// GET  /api/v1/profiles/:id
router.get(
  '/:id',
  requireAuth,
  [
    param('id').isUUID().withMessage('id must be a valid UUID'),
  ],
  validate,
  getProfile,
);

module.exports = router;
