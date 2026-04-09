// src/controllers/donationController.js
'use strict';

const { supabaseAdmin } = require('../utils/supabaseAdmin');
const { success, error } = require('../utils/response');
const {
  notifyRecipientDonorAccepted,
  notifyDonorDonationComplete,
} = require('../services/notificationService');
const { cancelGeoFencing } = require('../services/geoFencingService');

/**
 * POST /api/v1/donations/accept
 * Donor accepts a blood request.
 * Body: { requestId }
 */
async function acceptRequest(req, res, next) {
  try {
    const { requestId } = req.body;

    // 1. Verify the request exists and is still active
    const { data: request, error: reqErr } = await supabaseAdmin
      .from('blood_requests')
      .select('id, status, blood_group, hospital_name, recipient_id')
      .eq('id', requestId)
      .single();

    if (reqErr || !request)        return error(res, 'Request not found', 404);
    if (request.status !== 'active') return error(res, `Request is ${request.status}`, 409);
    if (request.recipient_id === req.userId) return error(res, 'You cannot donate to your own request', 400);

    // 2. Fetch donor profile for validation
    const { data: donorProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, blood_group, last_donation_date, is_available_to_donate, push_token')
      .eq('id', req.userId)
      .single();

    if (!donorProfile) return error(res, 'Donor profile not found', 404);

    // 3. Check 90-day cooldown
    if (donorProfile.last_donation_date) {
      const daysSinceLast = (Date.now() - new Date(donorProfile.last_donation_date).getTime()) / 86_400_000;
      if (daysSinceLast < 90) {
        return error(res, `You must wait ${Math.ceil(90 - daysSinceLast)} more days before donating again`, 400);
      }
    }

    // 4. Upsert response record
    const { data: response, error: respErr } = await supabaseAdmin
      .from('request_responses')
      .upsert({
        request_id: requestId,
        donor_id:   req.userId,
        status:     'accepted',
      }, { onConflict: 'request_id,donor_id' })
      .select()
      .single();

    if (respErr) throw respErr;

    // 5. Notify recipient
    const { data: recipientProfile } = await supabaseAdmin
      .from('profiles')
      .select('push_token, full_name')
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

    // 6. Stop expanding geo-fence (a donor is on the way)
    cancelGeoFencing(requestId);

    return success(res, {
      response,
      request: {
        id:           request.id,
        hospital_name: request.hospital_name,
        blood_group:  request.blood_group,
      },
    }, 'You have accepted the request. Please head to the hospital as soon as possible.');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/donations/decline
 * Donor declines a blood request.
 * Body: { requestId }
 */
async function declineRequest(req, res, next) {
  try {
    const { requestId } = req.body;

    const { error: dbErr } = await supabaseAdmin
      .from('request_responses')
      .upsert({
        request_id: requestId,
        donor_id:   req.userId,
        status:     'declined',
      }, { onConflict: 'request_id,donor_id' });

    if (dbErr) throw dbErr;

    return success(res, null, 'Request declined');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/donations/complete
 * Recipient marks a donation as completed.
 * Body: { requestId, donorId }
 */
async function completeDonation(req, res, next) {
  try {
    const { requestId, donorId } = req.body;

    // 1. Verify the caller owns the request
    const { data: request } = await supabaseAdmin
      .from('blood_requests')
      .select('recipient_id, status, blood_group, hospital_name')
      .eq('id', requestId)
      .single();

    if (!request)                          return error(res, 'Request not found', 404);
    if (request.recipient_id !== req.userId) return error(res, 'Not authorised', 403);
    if (request.status !== 'active')       return error(res, `Request is already ${request.status}`, 409);

    // 2. Verify the donor_id has an accepted response
    const { data: response } = await supabaseAdmin
      .from('request_responses')
      .select('id, status')
      .eq('request_id', requestId)
      .eq('donor_id', donorId)
      .single();

    if (!response || response.status !== 'accepted') {
      return error(res, 'Donor has not accepted this request', 400);
    }

    // 3. Fetch donor's current stats
    const { data: donorProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, total_donations, push_token')
      .eq('id', donorId)
      .single();

    if (!donorProfile) return error(res, 'Donor profile not found', 404);

    const newTotal = (donorProfile.total_donations ?? 0) + 1;

    // 4. Atomic updates (in parallel)
    const [requestUpdate, responseUpdate, donorUpdate] = await Promise.all([
      supabaseAdmin
        .from('blood_requests')
        .update({ status: 'fulfilled' })
        .eq('id', requestId),
      supabaseAdmin
        .from('request_responses')
        .update({ status: 'completed' })
        .eq('id', response.id),
      supabaseAdmin
        .from('profiles')
        .update({
          total_donations:    newTotal,
          last_donation_date: new Date().toISOString(),
        })
        .eq('id', donorId),
    ]);

    if (requestUpdate.error) throw requestUpdate.error;
    if (responseUpdate.error) throw responseUpdate.error;
    if (donorUpdate.error)   throw donorUpdate.error;

    // 5. Notify donor
    if (donorProfile.push_token) {
      await notifyDonorDonationComplete({
        token:          donorProfile.push_token,
        donorName:      donorProfile.full_name,
        totalDonations: newTotal,
        requestId,
      });
    }

    return success(res, {
      requestId,
      donorId,
      totalDonations: newTotal,
    }, '🎉 Donation recorded. Thank you for saving a life!');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/donations/history
 * Returns the authenticated user's donation history (as donor).
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

module.exports = {
  acceptRequest,
  declineRequest,
  completeDonation,
  getDonationHistory,
};
