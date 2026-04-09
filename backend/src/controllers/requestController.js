// src/controllers/requestController.js
'use strict';

const { supabaseAdmin }      = require('../utils/supabaseAdmin');
const { success, error }     = require('../utils/response');
const { startGeoFencing, cancelGeoFencing } = require('../services/geoFencingService');
const { filterByRadius, compatibleDonorGroups } = require('../utils/geo');

/**
 * POST /api/v1/requests
 * Create a new blood request and immediately kick off geo-fencing.
 */
async function createRequest(req, res, next) {
  try {
    const {
      blood_group,
      urgency        = 'urgent',
      units_needed   = 1,
      hospital_name,
      hospital_address,
      latitude,
      longitude,
      notes,
    } = req.body;

    const { data, error: dbErr } = await supabaseAdmin
      .from('blood_requests')
      .insert({
        recipient_id:     req.userId,
        blood_group,
        urgency,
        units_needed,
        hospital_name:    hospital_name.trim(),
        hospital_address: hospital_address.trim(),
        latitude,
        longitude,
        notes:            notes?.trim() ?? null,
        status:           'active',
      })
      .select()
      .single();

    if (dbErr) throw dbErr;

    // 🚀 Start geo-fencing expansion in background (non-blocking)
    setImmediate(() => startGeoFencing(data));

    return success(res, data, 'Blood request posted. Notifying nearby donors…', 201);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/requests
 * List active blood requests, optionally filtered by location + blood group.
 */
async function listRequests(req, res, next) {
  try {
    const lat        = parseFloat(req.query.lat);
    const lon        = parseFloat(req.query.lon);
    const radiusKm   = parseFloat(req.query.radiusKm ?? '50');
    const bloodGroup = req.query.bloodGroup;
    const urgency    = req.query.urgency;
    const page       = Math.max(1, parseInt(req.query.page ?? '1', 10));
    const limit      = Math.min(50, parseInt(req.query.limit ?? '20', 10));

    let query = supabaseAdmin
      .from('blood_requests')
      .select(`
        *,
        recipient:profiles!recipient_id (
          full_name, avatar_url
        )
      `, { count: 'exact' })
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (bloodGroup) query = query.eq('blood_group', bloodGroup);
    if (urgency)    query = query.eq('urgency', urgency);

    const { data, error: dbErr, count } = await query;
    if (dbErr) throw dbErr;

    let requests = data ?? [];

    // Client-side radius filter (PostGIS-free approach)
    if (!isNaN(lat) && !isNaN(lon)) {
      requests = filterByRadius(requests, lat, lon, radiusKm)
        .map(({ distanceKm, ...r }) => ({ ...r, distanceKm }));
    }

    return success(res, {
      requests,
      pagination: { page, limit, total: count ?? requests.length },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/requests/:id
 * Get a single request with full recipient profile + responses.
 */
async function getRequest(req, res, next) {
  try {
    const { id } = req.params;

    const { data, error: dbErr } = await supabaseAdmin
      .from('blood_requests')
      .select(`
        *,
        recipient:profiles!recipient_id (
          id, full_name, phone, avatar_url, blood_group,
          total_donations, is_verified, share_medical_history, medical_conditions
        )
      `)
      .eq('id', id)
      .single();

    if (dbErr || !data) return error(res, 'Request not found', 404);

    // Mask recipient medical history
    if (data.recipient && !data.recipient.share_medical_history) {
      data.recipient.medical_conditions = [];
    }

    // Fetch accepted responses for this request
    const { data: responses } = await supabaseAdmin
      .from('request_responses')
      .select(`
        id, donor_id, status, created_at,
        donor:profiles!donor_id (
          id, full_name, phone, blood_group, avatar_url,
          total_donations, is_verified, share_medical_history, medical_conditions,
          latitude, longitude, is_available_to_donate, last_donation_date
        )
      `)
      .eq('request_id', id)
      .in('status', ['accepted', 'pending', 'completed'])
      .order('created_at', { ascending: false });

    // Only expose accepted donor location to the request owner
    const safeResponses = (responses ?? []).map(r => {
      if (r.donor && req.userId !== data.recipient_id) {
        delete r.donor.latitude;
        delete r.donor.longitude;
      }
      if (r.donor && !r.donor.share_medical_history) {
        r.donor.medical_conditions = [];
      }
      return r;
    });

    return success(res, { ...data, responses: safeResponses });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/requests/my
 * List the authenticated user's own requests.
 */
async function getMyRequests(req, res, next) {
  try {
    const status = req.query.status;

    let query = supabaseAdmin
      .from('blood_requests')
      .select('*')
      .eq('recipient_id', req.userId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error: dbErr } = await query;
    if (dbErr) throw dbErr;

    return success(res, data ?? []);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/requests/:id/status
 * Update request status (recipient only: cancel or fulfil).
 */
async function updateRequestStatus(req, res, next) {
  try {
    const { id }     = req.params;
    const { status } = req.body;

    const ALLOWED = ['cancelled', 'fulfilled'];
    if (!ALLOWED.includes(status)) {
      return error(res, `status must be one of: ${ALLOWED.join(', ')}`, 400);
    }

    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from('blood_requests')
      .select('recipient_id, status')
      .eq('id', id)
      .single();

    if (!existing)                          return error(res, 'Request not found', 404);
    if (existing.recipient_id !== req.userId) return error(res, 'Not authorised', 403);
    if (existing.status !== 'active')       return error(res, `Request is already ${existing.status}`, 409);

    const { data, error: dbErr } = await supabaseAdmin
      .from('blood_requests')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (dbErr) throw dbErr;

    // Stop geo-fencing if cancelled
    if (status === 'cancelled') cancelGeoFencing(id);

    return success(res, data, `Request marked as ${status}`);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/requests/:id
 * Hard-delete a request (recipient only, only if cancelled/expired).
 */
async function deleteRequest(req, res, next) {
  try {
    const { id } = req.params;

    const { data: existing } = await supabaseAdmin
      .from('blood_requests')
      .select('recipient_id, status')
      .eq('id', id)
      .single();

    if (!existing)                          return error(res, 'Request not found', 404);
    if (existing.recipient_id !== req.userId) return error(res, 'Not authorised', 403);

    const DELETABLE = ['cancelled', 'expired'];
    if (!DELETABLE.includes(existing.status)) {
      return error(res, `Cannot delete an ${existing.status} request`, 409);
    }

    const { error: dbErr } = await supabaseAdmin.from('blood_requests').delete().eq('id', id);
    if (dbErr) throw dbErr;

    return success(res, null, 'Request deleted');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createRequest,
  listRequests,
  getRequest,
  getMyRequests,
  updateRequestStatus,
  deleteRequest,
};
