// src/routes/stats.js
'use strict';

const router = require('express').Router();
const { optionalAuth } = require('../middleware/auth');
const {
  getCommunityStats,
  getLeaderboard,
  getBloodAvailability,
} = require('../controllers/statsController');

// All stats endpoints are public (optionalAuth for future personalisation)

// GET /api/v1/stats/community
router.get('/community', optionalAuth, getCommunityStats);

// GET /api/v1/stats/leaderboard
router.get('/leaderboard', optionalAuth, getLeaderboard);

// GET /api/v1/stats/blood-availability
router.get('/blood-availability', optionalAuth, getBloodAvailability);

module.exports = router;
