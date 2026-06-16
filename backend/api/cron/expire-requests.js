// api/cron/expire-requests.js
// Scheduled handler — expires stale blood requests.
// Hit on a schedule by an external scheduler (see api/cron/tick-geofence.js).
// 10-minute interval is the original design; longer intervals are fine, the
// expiry windows (critical=2h, urgent=6h, standard=24h) are not minute-precise.

'use strict';

const { expireStaleRequests } = require('../../src/services/cronService');

function isAuthorised(req) {
  const secret = process.env.CRON_SECRET;
  // Fail closed in production — a missing secret must never leave the cron
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

  try {
    await expireStaleRequests();
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[cron/expire-requests] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
