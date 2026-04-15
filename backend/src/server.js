// src/server.js
'use strict';

require('dotenv').config();

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

const { startCronJobs } = require('./services/cronService');

const app  = express();
const PORT = process.env.PORT || 4000;

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
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
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

// ── TEMPORARY: Debug env vars — REMOVE AFTER FIXING ──────────
app.get('/debug-env', (_req, res) => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  res.json({
    SUPABASE_URL: process.env.SUPABASE_URL || '❌ missing',
    SERVICE_ROLE_KEY_SET: !!key,
    SERVICE_ROLE_KEY_LENGTH: key.length,
    SERVICE_ROLE_KEY_PREVIEW: key ? `${key.slice(0, 20)}...${key.slice(-10)}` : '❌ missing',
    NODE_ENV: process.env.NODE_ENV,
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

// ── Start server ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🩸 BludStack API running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Env:    ${process.env.NODE_ENV || 'development'}\n`);

  // Start background cron jobs
  startCronJobs();
});

module.exports = app; // for testing
