// api/cron/tick-geofence.js
// Vercel Cron handler — drives the geo-fence ring expansion.
//
// Scheduling lives in vercel.json. The handler is protected by the standard
// Vercel `CRON_SECRET` env var so only Vercel's scheduler can fire it.
//
// IMPORTANT: Vercel's minimum cron interval is 1 minute (Pro) / 1 hour (Hobby).
// The geo-fence design wants 5-second ticks; on Vercel the practical floor is
// 1 minute. If you need sub-minute fan-out, deploy to Railway/Render instead
// where startWorker() in src/server.js handles a 5-second in-process tick.

'use strict';

const { tick } = require('../../src/services/geoFencingService');

module.exports = async (req, res) => {
  // Auth — Vercel Cron sets Authorization: Bearer <CRON_SECRET>
  const auth   = req.headers?.authorization ?? '';
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
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
