// api/cron/expire-requests.js
// Vercel Cron handler — expires stale blood requests.
// Triggers `expireStaleRequests` from the cron service on whatever Vercel
// schedule is configured in vercel.json (10 min by default).
'use strict';

const { expireStaleRequests } = require('../../src/services/cronService');

module.exports = async (req, res) => {
  const auth   = req.headers?.authorization ?? '';
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
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
