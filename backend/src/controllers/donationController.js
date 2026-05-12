// src/controllers/donationController.js
'use strict';

const { supabaseAdmin }    = require('../utils/supabaseAdmin');
const { success, error }   = require('../utils/response');
const {
  notifyRecipientDonorAccepted,
  notifyDonorDonationComplete,
} = require('../services/notificationService');
const { cancelGeoFencing } = require('../services/geoFencingService');

const MIN_DONATION_GAP_DAYS = 90;

/**
 * POST /api/v1/donations/accept
 * Donor accepts a blood request. Body: { requestId }
 *
 * Uses the `accept_blood_request` RPC for race-free capacity + status checks
 * (fixes the read-then-write race in flaw #8). Cooldown is checked server-side
 * here because it depends on the donor profile, not the request.
 */
async function acceptRequest(req, res, next) {
  try {
    const { requestId } = req.body;

    // ── 1. Donor profile + cooldown ───────────────────────────────────────
    const { data: donorProfile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, blood_group, last_donation_date, is_available_to_donate, push_token')
      .eq('id', req.userId)
      .single();

    if (profileErr || !donorProfile) return error(res, 'Donor profile not found', 404);
    if (!donorProfile.is_available_to_donate) {
      return error(res, 'You are currently marked as unavailable to donate', 400);
    }

    if (donorProfile.last_donation_date) {
      const daysSinceLast =
        (Date.now() - new Date(donorProfile.last_donation_date).getTime()) / 86_400_000;
      if (daysSinceLast < MIN_DONATION_GAP_DAYS) {
        return error(
          res,
          `You must wait ${Math.ceil(MIN_DONATION_GAP_DAYS - daysSinceLast)} more days before donating again`,
          400,
        );
      }
    }

    // ── 2. Atomic accept via RPC (race-free capacity check) ──────────────
    const { data: rpcRows, error: rpcErr } = await supabaseAdmin
      .rpc('accept_blood_request', { p_request_id: requestId, p_donor_id: req.userId });
    if (rpcErr) throw rpcErr;

    const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    if (!row) return error(res, 'Accept failed — no result from database', 500);
    if (!row.response_id) {
      const status = /not found/i.test(row.message) ? 404
                   : /already/i.test(row.message)   ? 409
                   : 400;
      return error(res, row.message ?? 'Accept failed', status);
    }

    // ── 3. Notify recipient (best-effort) ─────────────────────────────────
    const { data: request } = await supabaseAdmin
      .from('blood_requests')
      .select('id, blood_group, hospital_name, recipient_id')
      .eq('id', requestId)
      .single();

    if (request) {
      const { data: recipientProfile } = await supabaseAdmin
        .from('profiles')
        .select('push_token')
        .eq('id', request.recipient_id)
        .single();

      if (recipientProfile?.push_token) {
        await notifyRecipientDonorAccepted({
          token:      recipientProfile.push_token,
          donorName:  donorProfile.full_name,
          bloodGroup: donorProfile.blood_group,
          requestId,
        });
      }
    }

    // ── 4. Stop expanding the geo-fence ──────────────────────────────────
    await cancelGeoFencing(requestId);

    return success(
      res,
      {
        responseId: row.response_id,
        request:    request
          ? { id: request.id, blood_group: request.blood_group, hospital_name: request.hospital_name }
          : null,
      },
      row.message === 'Already accepted'
        ? 'You already accepted — head to the hospital.'
        : 'You have accepted the request. Please head to the hospital as soon as possible.',
    );
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/donations/decline — donor declines a request. Body: { requestId }
 */
async function declineRequest(req, res, next) {
  try {
    const { requestId } = req.body;

    const { error: dbErr } = await supabaseAdmin
      .from('request_responses')
      .upsert(
        { request_id: requestId, donor_id: req.userId, status: 'declined' },
        { onConflict: 'request_id,donor_id' },
      );
    if (dbErr) throw dbErr;

    return success(res, null, 'Request declined');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/donations/complete
 * Recipient marks a donation as completed. Body: { requestId, donorId }
 *
 * Uses `complete_blood_donation` RPC so request flip, response flip, and donor
 * stat increment happen in one transaction. Idempotent.
 */
async function completeDonation(req, res, next) {
  try {
    const { requestId, donorId } = req.body;

    const { data: rpcRows, error: rpcErr } = await supabaseAdmin.rpc(
      'complete_blood_donation',
      { p_request_id: requestId, p_donor_id: donorId, p_caller_id: req.userId },
    );
    if (rpcErr) throw rpcErr;

    const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    if (!row || row.total_donations === null) {
      const msg = row?.message ?? 'Complete failed';
      const status = /not found/i.test(msg)      ? 404
                   : /not authorised/i.test(msg) ? 403
                   : /already/i.test(msg)        ? 409
                   :                               400;
      return error(res, msg, status);
    }

    const { data: donorProfile } = await supabaseAdmin
      .from('profiles')
      .select('push_token, full_name')
      .eq('id', donorId)
      .single();

    if (donorProfile?.push_token) {
      await notifyDonorDonationComplete({
        token:          donorProfile.push_token,
        donorName:      donorProfile.full_name,
        totalDonations: row.total_donations,
        requestId,
      });
    }

    return success(
      res,
      { requestId, donorId, totalDonations: row.total_donations },
      row.message === 'Already completed'
        ? 'Donation was already recorded.'
        : 'Donation recorded. Thank you for saving a life.',
    );
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/donations/history — authenticated user's donor history.
 */
async function getDonationHistory(req, res, next) {
  try {
    const { data, error: dbErr } = await supabaseAdmin
      .from('request_responses')
      .select(`
        id, status, created_at,
        request:blood_requests!request_id (
          id, blood_group, hospital_name, hospital_address,
          urgency, created_at, status
        )
      `)
      .eq('donor_id', req.userId)
      .in('status', ['accepted', 'completed', 'declined'])
      .order('created_at', { ascending: false });

    if (dbErr) throw dbErr;

    return success(res, data ?? []);
  } catch (err) {
    next(err);
  }
}

module.exports = { acceptRequest, declineRequest, completeDonation, getDonationHistory };
