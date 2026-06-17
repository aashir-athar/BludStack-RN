// api/cron/tick-geofence.js
// Scheduled handler - drives the geo-fence ring expansion.
//
// Vercel Hobby caps cron at DAILY, which is useless for ring expansion.
// `vercel.json` therefore does NOT register a Vercel Cron entry; instead this
// endpoint is hit by an external scheduler (cron-job.org, Upstash QStash,
// Supabase pg_cron, GitHub Actions, etc.) on the schedule of your choice.
//
// Auth: send the shared secret in EITHER
//   • Authorization: Bearer <CRON_SECRET>  (Vercel-Cron-style; preferred)
//   • ?secret=<CRON_SECRET>                (query param; most external services)
//
// Auth fails CLOSED in production: if CRON_SECRET is unset, the endpoint returns
// 401 in production and is open only in non-production (local dev). Always set
// CRON_SECRET in your hosting env (Render / Railway / Vercel).

'use strict';

const { tick } = require('../../src/services/geoFencingService');

function isAuthorised(req) {
  const secret = process.env.CRON_SECRET;
  // Fail closed in production - a missing secret must never leave the cron
  // endpoint publicly triggerable. Open only outside production for local dev.
  if (!secret) return process.env.NODE_ENV !== 'production';
  const auth  = req.headers?.authorization ?? '';
  const query = (req.query && (req.query.secret ?? req.query.token)) ?? null;
  return auth === `Bearer ${secret}` || query === secret;
}

module.exports = async (req, res) => {
  if (!isAuthorised(req)) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  const start = Date.now();
  try {
    await tick();
    return res.status(200).json({ ok: true, ms: Date.now() - start });
  } catch (err) {
    console.error('[cron/tick-geofence] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
