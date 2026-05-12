// src/controllers/profileController.js
'use strict';

const { supabaseAdmin } = require('../utils/supabaseAdmin');
const { success, error } = require('../utils/response');

/**
 * GET /api/v1/profiles/:id
 * Public profile view — respects share_medical_history flag.
 */
async function getProfile(req, res, next) {
  try {
    const { id } = req.params;

    const { data, error: dbErr } = await supabaseAdmin
      .from('profiles')
      .select(`
        id, full_name, blood_group, gender,
        is_available_to_donate, total_donations, is_verified,
        last_donation_date, avatar_url,
        share_medical_history, medical_conditions,
        latitude, longitude, created_at
      `)
      .eq('id', id)
      .single();

    if (dbErr || !data) return error(res, 'Profile not found', 404);

    // Mask medical conditions if sharing is disabled
    if (!data.share_medical_history) {
      data.medical_conditions = [];
    }
    // Never return location to arbitrary callers (only to matched parties via request detail)
    delete data.latitude;
    delete data.longitude;

    return success(res, data, 'Profile fetched');
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/profiles/me
 * Update the authenticated user's own profile.
 */
async function updateMyProfile(req, res, next) {
  try {
    const ALLOWED_FIELDS = [
      'full_name', 'gender', 'date_of_birth', 'avatar_url',
      'blood_group', 'medical_conditions', 'share_medical_history',
      'is_available_to_donate', 'address',
      'phone', 'whatsapp_available',
    ];

    const updates = {};
    for (const field of ALLOWED_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    if (Object.keys(updates).length === 0) {
      return error(res, 'No valid fields provided', 400);
    }

    // Role change is allowed but re-validates the donor age gate.
    if (req.body.role !== undefined) {
      const VALID = new Set(['donor', 'recipient', 'both']);
      if (!VALID.has(req.body.role)) {
        return error(res, 'Invalid role', 400);
      }
      if (req.body.role === 'donor' || req.body.role === 'both') {
        const dob = req.body.date_of_birth !== undefined ? req.body.date_of_birth : null;
        // Pull current DOB if not in payload, so existing donors don't get dropped
        let dobIso = dob;
        if (!dobIso) {
          const { data: cur } = await supabaseAdmin
            .from('profiles').select('date_of_birth').eq('id', req.userId).single();
          dobIso = cur?.date_of_birth ?? null;
        }
        if (!dobIso) {
          return error(res, 'Donor role requires date_of_birth on the profile', 400);
        }
        const ageMs = Date.now() - new Date(dobIso).getTime();
        const ageYears = ageMs / (365.25 * 86_400_000);
        // Donor eligibility window: 18-65 inclusive (WHO standard).
        if (ageYears < 18 || ageYears > 65) {
          return error(res, 'Donor role requires age 18–65', 400);
        }
      }
      updates.role = req.body.role;
      if (req.body.role === 'recipient') {
        updates.is_available_to_donate = false;
      }
    }

    const { data, error: dbErr } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', req.userId)
      .select()
      .single();

    if (dbErr) throw dbErr;

    return success(res, data, 'Profile updated');
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/profiles/me/location
 * Update authenticated user's GPS coordinates.
 */
async function updateLocation(req, res, next) {
  try {
    const { latitude, longitude } = req.body;

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return error(res, 'latitude and longitude must be numbers', 400);
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return error(res, 'Coordinates out of valid range', 400);
    }

    const { data, error: dbErr } = await supabaseAdmin
      .from('profiles')
      .update({ latitude, longitude })
      .eq('id', req.userId)
      .select('id, latitude, longitude')
      .single();

    if (dbErr) throw dbErr;

    return success(res, data, 'Location updated');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/profiles/nearby-donors
 * Find available donors near a given location for a given blood group.
 * Query params: lat, lon, radiusKm (default 50), bloodGroup
 */
async function getNearbyDonors(req, res, next) {
  try {
    const lat        = parseFloat(req.query.lat);
    const lon        = parseFloat(req.query.lon);
    const radiusKm   = parseFloat(req.query.radiusKm ?? '50');
    const bloodGroup = req.query.bloodGroup;

    if (isNaN(lat) || isNaN(lon)) {
      return error(res, 'lat and lon query params are required', 400);
    }

    const { filterByRadius, compatibleDonorGroups } = require('../utils/geo');

    let query = supabaseAdmin
      .from('profiles')
      .select('id, full_name, blood_group, latitude, longitude, is_verified, total_donations, avatar_url')
      .eq('is_available_to_donate', true)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (bloodGroup) {
      const compatible = compatibleDonorGroups(bloodGroup);
      query = query.in('blood_group', compatible);
    }

    const { data, error: dbErr } = await query;
    if (dbErr) throw dbErr;

    const nearby = filterByRadius(data ?? [], lat, lon, radiusKm);

    // Never leak exact coordinates — return distance only
    const sanitised = nearby.map(({ latitude, longitude, distanceKm, ...rest }) => ({
      ...rest,
      distanceKm: Math.round(distanceKm * 10) / 10,
    }));

    return success(res, { donors: sanitised, count: sanitised.length, radiusKm });
  } catch (err) {
    next(err);
  }
}

module.exports = { getProfile, updateMyProfile, updateLocation, getNearbyDonors };
