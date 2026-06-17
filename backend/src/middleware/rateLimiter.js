// src/middleware/rateLimiter.js
'use strict';

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

// express-rate-limit v8 requires IP-based keys to pass through `ipKeyGenerator`
// so IPv6 addresses are normalised to a /56 subnet (prevents trivial limit
// evasion by rotating within a single IPv6 allocation). Prefer the authed user.
const userOrIpKey = (req) => req.userId ?? ipKeyGenerator(req.ip ?? '');

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 min
const MAX       = parseInt(process.env.RATE_LIMIT_MAX       || '100',    10);

/**
 * Global rate limiter - 100 req / 15 min per IP by default.
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
 * Notification sender limiter - prevent spam.
 * 20 notification triggers per 5 minutes per user.
 */
const notifRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many notifications sent. Please wait.',
    status: 429,
  },
});

/**
 * Live-location heartbeat limiter - the donor app throttles itself to roughly
 * one push per 30s (or per 50m moved), so ~2-4 req/min is the legitimate ceiling.
 * Cap at 15/min, keyed per (donor, request) so a single token cannot flood one
 * request's row or fan a flood across many requests. Generous headroom over the
 * real cadence while still blocking a runaway or malicious client.
 */
const heartbeatKey = (req) => `${userOrIpKey(req)}:${(req.body && req.body.requestId) || ''}`;

const heartbeatRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  keyGenerator: heartbeatKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Heartbeat rate exceeded. Slow down location updates.',
    status: 429,
  },
});

module.exports = { globalRateLimiter, authRateLimiter, notifRateLimiter, heartbeatRateLimiter };
