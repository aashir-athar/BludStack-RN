// src/middleware/auth.js
'use strict';

const { supabaseAdmin } = require('../utils/supabaseAdmin');
const { error }         = require('../utils/response');

/**
 * requireAuth — verifies the Bearer JWT from Supabase.
 * Attaches req.user (Supabase User object) and req.userId.
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'Missing or malformed Authorization header', 401);
    }

    const token = authHeader.slice(7).trim();
    if (!token) return error(res, 'Access token required', 401);

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);

    if (authErr || !user) {
      return error(res, 'Invalid or expired access token', 401);
    }

    req.user   = user;
    req.userId = user.id;
    next();
  } catch (err) {
    console.error('[auth middleware]', err.message);
    return error(res, 'Authentication failed', 401);
  }
}

/**
 * optionalAuth — same as requireAuth but does NOT reject unauthenticated requests.
 * Useful for public endpoints that behave differently when logged in.
 */
async function optionalAuth(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return next();

    const token = authHeader.slice(7).trim();
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (user) { req.user = user; req.userId = user.id; }
  } catch { /* ignore */ } finally { next(); }
}

module.exports = { requireAuth, optionalAuth };
