// src/controllers/authController.js
'use strict';

const { supabaseAdmin } = require('../utils/supabaseAdmin');
const { success, error } = require('../utils/response');

/**
 * GET /api/v1/auth/me
 * Returns the authenticated user's profile.
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
 * Called after first OTP verification to create a full profile.
 * The DB trigger creates the row; this endpoint populates fields.
 */
async function register(req, res, next) {
  try {
    const {
      full_name,
      gender,
      blood_group,
      date_of_birth,
      medical_conditions = [],
      share_medical_history = false,
      is_available_to_donate = true,
    } = req.body;

    const upsertData = {
      id:                    req.userId,
      email:                 req.user.email ?? '',    // ← email from Supabase auth
      full_name:             full_name.trim(),
      gender,
      blood_group,
      date_of_birth:         date_of_birth ?? null,
      medical_conditions,
      share_medical_history,
      is_available_to_donate,
      total_donations:       0,
      is_verified:           false,
    };

    const { data, error: dbErr } = await supabaseAdmin
      .from('profiles')
      .upsert(upsertData, { onConflict: 'id' })
      .select()
      .single();

    if (dbErr) throw dbErr;

    return success(res, data, 'Profile created', 201);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/logout
 * Invalidates the Supabase session server-side.
 */
async function logout(req, res, next) {
  try {
    // Supabase doesn't have server-side session invalidation with JWT —
    // the client clears its token. We log the event and return 200.
    console.log(`[auth] User ${req.userId} logged out`);

    // Optionally: clear push token so user stops receiving notifications
    await supabaseAdmin
      .from('profiles')
      .update({ push_token: null })
      .eq('id', req.userId);

    return success(res, null, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
}

<<<<<<< HEAD
module.exports = { getMe, register, logout };
=======
module.exports = { getMe, register, logout };
>>>>>>> 49202d67bd59792b4429cfd0a90fbf7f58c45535
