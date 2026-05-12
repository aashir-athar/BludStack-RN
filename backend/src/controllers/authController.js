// src/controllers/authController.js
'use strict';

const { supabaseAdmin }  = require('../utils/supabaseAdmin');
const { success, error } = require('../utils/response');

const VALID_ROLES = new Set(['donor', 'recipient', 'both']);

function computeAge(dobISO) {
  if (!dobISO) return null;
  const birth = new Date(dobISO);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/**
 * GET /api/v1/auth/me — returns the authenticated user's profile.
 */
async function getMe(req, res, next) {
  try {
    const { data, error: dbErr } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.userId)
      .single();

    if (dbErr) {
      if (dbErr.code === 'PGRST116') return error(res, 'Profile not found', 404);
      throw dbErr;
    }

    return success(res, data, 'Profile fetched');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/register
 *
 * Called after first OTP verification to populate the profile row created by
 * the `on_auth_user_created` trigger. Idempotent — re-running just updates
 * the same row.
 *
 * Server-enforced rules (mirrored in supabase_schema.sql constraints):
 *   • Donor age gate: any role granting donor capability ('donor' | 'both')
 *     requires age 18+. Under-18 users are silently downgraded to 'recipient'
 *     and the response includes a notice.
 *   • Push token, total_donations, last_donation_date, is_verified are never
 *     accepted from this payload — they are server-managed.
 */
async function register(req, res, next) {
  try {
    const {
      full_name,
      gender,
      blood_group,
      date_of_birth          = null,
      phone                  = null,
      whatsapp_available     = false,
      medical_conditions     = [],
      share_medical_history  = false,
      is_available_to_donate = true,
      role: requestedRole    = 'donor',
    } = req.body;

    let role = VALID_ROLES.has(requestedRole) ? requestedRole : 'donor';
    let downgraded = false;
    const age = computeAge(date_of_birth);

    if (role === 'donor' || role === 'both') {
      if (age === null) {
        return error(res, 'date_of_birth is required to register as a donor', 400);
      }
      // Donor eligibility window: 18-65 (WHO + most national blood-bank
      // guidelines). Outside this window, downgrade silently to recipient
      // — the caller gets `downgraded: true` and can surface a toast.
      if (age < 18 || age > 65) {
        role = 'recipient';
        downgraded = true;
      }
    }

    const effectiveAvailability = role === 'recipient' ? false : !!is_available_to_donate;

    const upsertData = {
      id:                     req.userId,
      email:                  req.user.email ?? '',
      full_name:              full_name.trim(),
      gender:                 gender ?? null,
      blood_group,
      date_of_birth,
      phone:                  phone ? String(phone).trim() : null,
      whatsapp_available:     phone ? !!whatsapp_available : false,
      medical_conditions:     Array.isArray(medical_conditions) ? medical_conditions : [],
      share_medical_history:  !!share_medical_history,
      is_available_to_donate: effectiveAvailability,
      role,
    };

    const { data, error: dbErr } = await supabaseAdmin
      .from('profiles')
      .upsert(upsertData, { onConflict: 'id' })
      .select()
      .single();

    if (dbErr) throw dbErr;

    return success(
      res,
      { profile: data, downgraded },
      downgraded
        ? 'Profile created. Donor role requires age 18–65; account set up as recipient.'
        : 'Profile created',
      201,
    );
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/logout
 *
 * Clears the device's push token so the user stops receiving notifications.
 * Supabase JWTs are stateless — the client must drop the access token locally.
 */
async function logout(req, res, next) {
  try {
    await supabaseAdmin
      .from('profiles')
      .update({ push_token: null })
      .eq('id', req.userId);

    return success(res, null, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
}

module.exports = { getMe, register, logout };
