// src/controllers/notificationController.js
'use strict';

const { Expo }                  = require('expo-server-sdk');
const { supabaseAdmin }         = require('../utils/supabaseAdmin');
const { success, error }        = require('../utils/response');
const { sendPushNotifications } = require('../services/notificationService');

/**
 * PUT /api/v1/notifications/token
 * Register or update the device's Expo push token.
 * Body: { token }
 */
async function registerToken(req, res, next) {
  try {
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return error(res, 'push token is required', 400);
    }

    if (!Expo.isExpoPushToken(token)) {
      return error(res, 'Invalid Expo push token format', 400);
    }

    const { error: dbErr } = await supabaseAdmin
      .from('profiles')
      .update({ push_token: token })
      .eq('id', req.userId);

    if (dbErr) throw dbErr;

    return success(res, { token }, 'Push token registered');
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/notifications/token
 * Remove push token (called on logout / notification opt-out).
 */
async function removeToken(req, res, next) {
  try {
    const { error: dbErr } = await supabaseAdmin
      .from('profiles')
      .update({ push_token: null })
      .eq('id', req.userId);

    if (dbErr) throw dbErr;

    return success(res, null, 'Push token removed');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/notifications/test
 * Send a test push notification to the authenticated user.
 * Useful for verifying the push pipeline is working.
 */
async function sendTestNotification(req, res, next) {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('push_token, full_name')
      .eq('id', req.userId)
      .single();

    if (!profile?.push_token) {
      return error(res, 'No push token registered for your account', 404);
    }

    const result = await sendPushNotifications([{
      token:     profile.push_token,
      title:     'BludStack test notification',
      body:      `Hi ${profile.full_name} - push notifications are working.`,
      data:      { type: 'TEST' },
      channelId: 'default',
    }]);

    return success(res, result, 'Test notification sent');
  } catch (err) {
    next(err);
  }
}

module.exports = { registerToken, removeToken, sendTestNotification };
