// src/services/notificationService.js
'use strict';

const { Expo } = require('expo-server-sdk');

const expo = new Expo({ useFcmV1: true });

/**
 * Send push notifications to a list of Expo push tokens.
 *
 * @param {Array<{
 *   token: string,
 *   title: string,
 *   body: string,
 *   data?: object,
 *   sound?: string,
 *   badge?: number,
 *   channelId?: string,
 * }>} messages
 * @returns {Promise<{ sent: number, failed: number, errors: any[] }>}
 */
async function sendPushNotifications(messages) {
  const results = { sent: 0, failed: 0, errors: [] };

  // Build valid Expo messages
  const expoMessages = [];

  for (const msg of messages) {
    if (!Expo.isExpoPushToken(msg.token)) {
      console.warn(`[notify] Invalid Expo push token: ${msg.token}`);
      results.failed++;
      continue;
    }

    const isEmergency = msg.channelId === 'emergency';

    // ── Killed-state delivery rules ───────────────────────────────────────
    // iOS: `interruptionLevel: 'time-sensitive'` punches through Focus modes
    //   without the special "Critical Alerts" Apple entitlement.
    //   `mutableContent` enables our notification-service extension (if any)
    //   to enrich the payload before display.
    // Android: `priority: 'high'` maps to FCM `priority: high` (wakes the
    //   device immediately). `ttl: 0` tells FCM "deliver now or drop" — so a
    //   2-hour-stale 'blood needed' push never wakes someone at midnight.
    // Both: `_displayInForeground` ensures the notification still shows when
    //   the app is in the foreground (default behaviour suppresses it).
    expoMessages.push({
      to:        msg.token,
      sound:     msg.sound ?? 'default',
      title:     msg.title,
      subtitle:  msg.subtitle,
      body:      msg.body,
      data:      { ...(msg.data ?? {}), _displayInForeground: true },
      badge:     msg.badge ?? 1,
      channelId: msg.channelId ?? 'default',
      priority:  isEmergency ? 'high' : 'normal',
      ttl:       isEmergency ? 0 : 3600,
      mutableContent: true,
      // iOS-only — Expo passes this through to APNs
      ...(isEmergency ? { _category: 'emergency', interruptionLevel: 'time-sensitive' } : { interruptionLevel: 'active' }),
    });
  }

  if (expoMessages.length === 0) return results;

  // Expo recommends chunking into batches of 100
  const chunks = expo.chunkPushNotifications(expoMessages);

  // We need to map ticket-index → token so we can prune dead tokens.
  const tokenByIndex = expoMessages.map(m => m.to);
  const deadTokens = new Set();

  let cursor = 0;
  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);

      for (const ticket of ticketChunk) {
        if (ticket.status === 'ok') {
          results.sent++;
        } else {
          results.failed++;
          results.errors.push(ticket.message ?? ticket.details);
          if (ticket.details?.error === 'DeviceNotRegistered') {
            const tok = tokenByIndex[cursor];
            if (tok) deadTokens.add(tok);
          }
        }
        cursor++;
      }
    } catch (err) {
      console.error('[notify] Chunk send error:', err.message);
      results.failed += chunk.length;
      results.errors.push(err.message);
      cursor += chunk.length;
    }
  }

  // Prune permanently-invalid tokens. Lazy import to avoid a circular
  // require with the supabase admin client at module load.
  if (deadTokens.size > 0) {
    try {
      const { supabaseAdmin } = require('../utils/supabaseAdmin');
      await supabaseAdmin
        .from('profiles')
        .update({ push_token: null })
        .in('push_token', Array.from(deadTokens));
      console.log(`[notify] Pruned ${deadTokens.size} dead push token(s)`);
    } catch (err) {
      console.error('[notify] Token prune failed:', err.message);
    }
  }

  return results;
}

/**
 * Build and send an emergency blood request notification to a single donor.
 */
async function notifyDonor({ token, bloodGroup, urgency, hospitalName, distanceKm, requestId }) {
  const urgencyLabels = { critical: '🚨 CRITICAL', urgent: '⚠️ Urgent', standard: '🩸 Request' };
  const label         = urgencyLabels[urgency] ?? '🩸 Request';

  return sendPushNotifications([{
    token,
    title:     `${label}: ${bloodGroup} Blood Needed`,
    body:      `${hospitalName} · ${distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`} away. Can you help?`,
    data:      { type: 'BLOOD_REQUEST', requestId, screen: 'request_detail' },
    channelId: urgency === 'critical' ? 'emergency' : 'default',
    sound:     'default',
  }]);
}

/**
 * Notify recipient that a donor has accepted their request.
 */
async function notifyRecipientDonorAccepted({ token, donorName, bloodGroup, requestId }) {
  return sendPushNotifications([{
    token,
    title:     `✅ Donor on the way!`,
    body:      `${donorName} (${bloodGroup}) has accepted your request and is heading to the hospital.`,
    data:      { type: 'DONOR_ACCEPTED', requestId, screen: 'request_detail' },
    channelId: 'default',
    sound:     'default',
  }]);
}

/**
 * Notify donor that the donation was marked as completed.
 */
async function notifyDonorDonationComplete({ token, donorName, totalDonations, requestId }) {
  return sendPushNotifications([{
    token,
    title:     `🎉 Donation recorded — thank you, ${donorName}!`,
    body:      `You've now completed ${totalDonations} donation${totalDonations !== 1 ? 's' : ''}. You are a hero.`,
    data:      { type: 'DONATION_COMPLETE', requestId },
    channelId: 'default',
    sound:     'default',
  }]);
}

/**
 * Notify recipient that their request is still unfulfilled (reminder).
 */
async function notifyRequestStillOpen({ token, bloodGroup, requestId, ringKm }) {
  return sendPushNotifications([{
    token,
    title:     `🩸 Still searching for ${bloodGroup} donors…`,
    body:      `We've expanded the search to ${ringKm} km. Stay hopeful — help is coming.`,
    data:      { type: 'SEARCH_EXPANDING', requestId, ringKm },
    channelId: 'default',
    sound:     'default',
  }]);
}

module.exports = {
  sendPushNotifications,
  notifyDonor,
  notifyRecipientDonorAccepted,
  notifyDonorDonationComplete,
  notifyRequestStillOpen,
};
