// src/services/cronService.js
'use strict';

const cron            = require('node-cron');
const { supabaseAdmin } = require('../utils/supabaseAdmin');
const { activeJobCount } = require('./geoFencingService');

/**
 * Expire blood requests that are older than their urgency window
 * and have not been fulfilled or cancelled.
 *
 * Runs every 10 minutes.
 */
async function expireStaleRequests() {
  try {
    const URGENCY_EXPIRY_HOURS = { critical: 2, urgent: 6, standard: 24 };

    const { data: activeRequests } = await supabaseAdmin
      .from('blood_requests')
      .select('id, urgency, created_at')
      .eq('status', 'active');

    if (!activeRequests?.length) return;

    const now  = Date.now();
    const toExpire = activeRequests.filter(req => {
      const expiryHours = URGENCY_EXPIRY_HOURS[req.urgency] ?? 24;
      const ageHours    = (now - new Date(req.created_at).getTime()) / 3_600_000;
      return ageHours > expiryHours;
    });

    if (toExpire.length === 0) return;

    const ids = toExpire.map(r => r.id);
    const { error } = await supabaseAdmin
      .from('blood_requests')
      .update({ status: 'expired' })
      .in('id', ids);

    if (error) {
      console.error('[cron] expireStaleRequests error:', error.message);
    } else {
      console.log(`[cron] Expired ${toExpire.length} stale request(s): ${ids.join(', ')}`);
    }
  } catch (err) {
    console.error('[cron] expireStaleRequests exception:', err.message);
  }
}

/**
 * Clean up stale / invalid push tokens (DeviceNotRegistered).
 * Supabase realtime notifies us of errors — here we batch-clean weekly.
 * In practice, tokens are cleaned when Expo returns DeviceNotRegistered.
 *
 * Runs every Sunday at 02:00.
 */
async function cleanStalePushTokens() {
  try {
    console.log('[cron] cleanStalePushTokens: checking for stale tokens…');
    // This is a placeholder — actual invalid token removal happens
    // in the notification service when Expo returns DeviceNotRegistered.
    // Here we could ping all tokens and remove ones that fail repeatedly.
    console.log('[cron] cleanStalePushTokens: done');
  } catch (err) {
    console.error('[cron] cleanStalePushTokens error:', err.message);
  }
}

/**
 * Health log — periodically log active geo-fencing jobs count.
 * Runs every 5 minutes.
 */
function logSystemHealth() {
  const jobs = activeJobCount();
  console.log(`[cron] health | active geo-fence jobs: ${jobs} | memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
}

function startCronJobs() {
  // Expire stale requests — every 10 minutes
  cron.schedule('*/10 * * * *', expireStaleRequests, {
    name: 'expire-stale-requests',
    timezone: 'UTC',
  });

  // Clean stale push tokens — every Sunday at 02:00 UTC
  cron.schedule('0 2 * * 0', cleanStalePushTokens, {
    name: 'clean-push-tokens',
    timezone: 'UTC',
  });

  // System health log — every 5 minutes
  cron.schedule('*/5 * * * *', logSystemHealth, {
    name: 'health-log',
  });

  console.log('⏰  Cron jobs started: [expire-stale-requests, clean-push-tokens, health-log]');
}

module.exports = { startCronJobs, expireStaleRequests };
