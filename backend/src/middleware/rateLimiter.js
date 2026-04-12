// src/middleware/rateLimiter.js
'use strict';

const rateLimit = require('express-rate-limit');

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 min
const MAX       = parseInt(process.env.RATE_LIMIT_MAX       || '100',    10);

/**
 * Global rate limiter — 100 req / 15 min per IP by default.
 */
const globalRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please slow down.',
    status: 429,
  },
  skip: (req) => req.path === '/health', // never limit health check
});

/**
 * Strict limiter for auth endpoints (OTP, etc.)
 * 10 requests per 15 minutes per IP.
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication attempts. Please wait 15 minutes.',
    status: 429,
  },
});

/**
 * Notification sender limiter — prevent spam.
 * 20 notification triggers per 5 minutes per user.
 */
const notifRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.userId || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many notifications sent. Please wait.',
    status: 429,
  },
});

module.exports = { globalRateLimiter, authRateLimiter, notifRateLimiter };
