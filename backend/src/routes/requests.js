// src/routes/requests.js
'use strict';

const router = require('express').Router();
const { body, param, query } = require('express-validator');

const { requireAuth }     = require('../middleware/auth');
const { validate }        = require('../middleware/validate');
const {
  createRequest,
  listRequests,
  getRequest,
  getMyRequests,
  updateRequestStatus,
  deleteRequest,
} = require('../controllers/requestController');

const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const URGENCY      = ['critical','urgent','standard'];

// GET  /api/v1/requests/my  - must be before /:id
router.get('/my', requireAuth, getMyRequests);

// GET  /api/v1/requests
router.get(
  '/',
  requireAuth,
  [
    query('lat').optional().isFloat({ min: -90, max: 90 }),
    query('lon').optional().isFloat({ min: -180, max: 180 }),
    query('radiusKm').optional().isFloat({ min: 1, max: 200 }),
    query('bloodGroup').optional().isIn(BLOOD_GROUPS),
    query('urgency').optional().isIn(URGENCY),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  validate,
  listRequests,
);

// POST /api/v1/requests
router.post(
  '/',
  requireAuth,
  [
    body('blood_group')
      .isIn(BLOOD_GROUPS)
      .withMessage(`blood_group must be one of: ${BLOOD_GROUPS.join(', ')}`),
    body('urgency')
      .optional()
      .isIn(URGENCY)
      .withMessage(`urgency must be one of: ${URGENCY.join(', ')}`),
    body('units_needed')
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage('units_needed must be 1-20'),
    body('hospital_name')
      .trim()
      .isLength({ min: 2, max: 200 })
      .withMessage('hospital_name is required (2-200 chars)'),
    body('hospital_address')
      .trim()
      .isLength({ min: 5, max: 400 })
      .withMessage('hospital_address is required (5-400 chars)'),
    body('latitude')
      .isFloat({ min: -90, max: 90 })
      .withMessage('latitude must be a valid coordinate'),
    body('longitude')
      .isFloat({ min: -180, max: 180 })
      .withMessage('longitude must be a valid coordinate'),
    body('notes')
      .optional()
      .isString()
      .isLength({ max: 1000 }),
  ],
  validate,
  createRequest,
);

// GET  /api/v1/requests/:id
router.get(
  '/:id',
  requireAuth,
  [param('id').isUUID()],
  validate,
  getRequest,
);

// PATCH /api/v1/requests/:id/status
router.patch(
  '/:id/status',
  requireAuth,
  [
    param('id').isUUID(),
    body('status')
      .isIn(['cancelled','fulfilled'])
      .withMessage('status must be "cancelled" or "fulfilled"'),
  ],
  validate,
  updateRequestStatus,
);

// DELETE /api/v1/requests/:id
router.delete(
  '/:id',
  requireAuth,
  [param('id').isUUID()],
  validate,
  deleteRequest,
);

module.exports = router;
