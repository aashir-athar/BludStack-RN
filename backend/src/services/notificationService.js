// src/services/notificationService.js
'use strict';

const { Expo } = require('expo-server-sdk');

// expo-server-sdk v6: FCM v1 is the default transport (legacy FCM was removed
// by Google), so `useFcmV1` is no longer needed. `accessToken` is optional and
// enables Expo's enhanced push security when set.
const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

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
    //   device immediately). `ttl: 0` tells FCM "deliver now or drop" - so a
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
      // iOS-only - Expo passes this through to APNs
      ...(isEmergency ? { _category: 'emergency', interruptionLevel: 'time-sensitive' } : { interruptionLevel: 'active' }),
    });
  }

  if (expoMessages.length === 0) return results;

  // Expo recommends chunking into batches of 100.
  const chunks = expo.chunkPushNotifications(expoMessages);

  // Map each ticket back to its token by reading it from the SAME chunk array
  // the tickets came from (`chunk[i].to`). Tickets are returned 1:1 and in
  // order with the messages in their chunk, so this is exact - and it removes
  // the global-cursor index-drift class of bug, where a chunk returning fewer
  // tickets than messages would mis-align every subsequent token.
  const deadTokens = new Set();

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      ticketChunk.forEach((ticket, i) => {
        if (ticket.status === 'ok') {
          results.sent++;
        } else {
          results.failed++;
          results.errors.push(ticket.message ?? ticket.details);
          if (ticket.details?.error === 'DeviceNotRegistered' && chunk[i]?.to) {
            deadTokens.add(chunk[i].to);
          }
        }
      });
    } catch (err) {
      console.error('[notify] Chunk send error:', err.message);
      results.failed += chunk.length;
      results.errors.push(err.message);
    }
  }

  // Prune permanently-invalid tokens in bounded batches so a large dead set
  // never builds an oversized `IN (...)` clause. Lazy import avoids a circular
  // require with the supabase admin client at module load.
  if (deadTokens.size > 0) {
    try {
      const { supabaseAdmin } = require('../utils/supabaseAdmin');
      const dead = Array.from(deadTokens);
      const PRUNE_BATCH = 100;
      for (let i = 0; i < dead.length; i += PRUNE_BATCH) {
        await supabaseAdmin
          .from('profiles')
          .update({ push_token: null })
          .in('push_token', dead.slice(i, i + PRUNE_BATCH));
      }
      console.log(`[notify] Pruned ${dead.length} dead push token(s)`);
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
  const urgencyLabels = { critical: 'Critical', urgent: 'Urgent', standard: 'Request' };
  const label         = urgencyLabels[urgency] ?? 'Request';
  const distance      = distanceKm < 1
    ? `${Math.round(distanceKm * 1000)} m`
    : `${distanceKm.toFixed(1)} km`;

  return sendPushNotifications([{
    token,
    title:     `${label}: ${bloodGroup} blood needed`,
    body:      `${hospitalName} · ${distance} away. Can you help?`,
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
    title:     'A donor is on the way',
    body:      `${donorName} (${bloodGroup}) accepted your request and is heading to the hospital.`,
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
    title:     `Donation recorded - thank you, ${donorName}`,
    body:      `That's ${totalDonations} donation${totalDonations !== 1 ? 's' : ''} so far. Someone got the blood they needed because of you.`,
    data:      { type: 'DONATION_COMPLETE', requestId },
    channelId: 'default',
    sound:     'default',
  }]);
}

/**
 * Notify recipient that their request is still unfulfilled (reminder).
 * `ringKm >= 999` is the nationwide-fallback sentinel.
 */
async function notifyRequestStillOpen({ token, bloodGroup, requestId, ringKm }) {
  const where = ringKm >= 999 ? 'nationwide' : `to ${ringKm} km`;
  return sendPushNotifications([{
    token,
    title:     `Still finding ${bloodGroup} donors`,
    body:      `We widened the search ${where}. Hang tight - we'll keep looking.`,
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
