// src/server.js
'use strict';

require('dotenv').config({ quiet: true });

const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const morgan  = require('morgan');

const { globalRateLimiter } = require('./middleware/rateLimiter');
const { errorHandler }      = require('./middleware/errorHandler');
const { requestLogger }     = require('./middleware/requestLogger');

const authRoutes         = require('./routes/auth');
const profileRoutes      = require('./routes/profiles');
const requestRoutes      = require('./routes/requests');
const notificationRoutes = require('./routes/notifications');
const donationRoutes     = require('./routes/donations');
const statsRoutes        = require('./routes/stats');

const { startCronJobs }   = require('./services/cronService');
const { startWorker }     = require('./services/geoFencingService');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Trust proxy (Railway / Render / any reverse proxy) ──────
// Without this, express-rate-limit shares one bucket across all users behind
// the proxy. Set to the number of proxies in front of the app; '1' is correct
// for Railway and Render single-hop deployments.
app.set('trust proxy', parseInt(process.env.TRUST_PROXY ?? '1', 10));

// ── Security headers ─────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ── CORS ─────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
app.use(cors({
  origin: allowedOrigins.includes('*') ? '*' : (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parsing ─────────────────────────────────────────────
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: true, limit: '512kb' }));

// ── HTTP logging ─────────────────────────────────────────────
// Strip query strings from production logs so coordinates (lat/lon) and
// search filters aren't persisted to log aggregators. Path only.
if (process.env.NODE_ENV !== 'test') {
  if (process.env.NODE_ENV === 'production') {
    morgan.token('path-only', (req) => {
      try { return req.originalUrl.split('?')[0]; } catch { return req.url; }
    });
    app.use(morgan(':remote-addr - :method :path-only :status :res[content-length] - :response-time ms'));
  } else {
    app.use(morgan('dev'));
  }
}

// ── Global rate limiter ───────────────────────────────────────
app.use(globalRateLimiter);

// ── Request logger (attaches requestId) ──────────────────────
app.use(requestLogger);

// ── Health check (no auth required) ──────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'bludstack-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

// ── API routes ────────────────────────────────────────────────
app.use('/api/v1/auth',          authRoutes);
app.use('/api/v1/profiles',      profileRoutes);
app.use('/api/v1/requests',      requestRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/donations',     donationRoutes);
app.use('/api/v1/stats',         statsRoutes);

// ── 404 handler ───────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found', status: 404 });
});

// ── Global error handler ─────────────────────────────────────
app.use(errorHandler);

// ── Start server (only outside Vercel) ───────────────────────
// Vercel runs each invocation as a short-lived serverless function. A
// long-running setInterval-based worker would be killed by the runtime, so on
// Vercel we expose the tick + cron logic through /api/cron/* HTTPS endpoints
// that Vercel Cron Jobs hit on a schedule. See vercel.json.
const IS_VERCEL = !!process.env.VERCEL;

if (!IS_VERCEL && require.main === module) {
  app.listen(PORT, () => {
    console.log(`\nBludStack API running on port ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   Env:    ${process.env.NODE_ENV || 'development'}\n`);

    startCronJobs();
    startWorker();
  });
}

module.exports = app;
