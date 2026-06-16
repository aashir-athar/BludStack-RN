// src/controllers/statsController.js
'use strict';

const { supabaseAdmin }  = require('../utils/supabaseAdmin');
const { success } = require('../utils/response');
const { activeJobCount } = require('../services/geoFencingService');

/**
 * GET /api/v1/stats/community
 * Public community stats for the home screen banner.
 */
async function getCommunityStats(req, res, next) {
  try {
    const [donationsRes, donorsRes, requestsRes, fulfilledRes] = await Promise.all([
      // Sum of all donation counts
      supabaseAdmin.from('profiles').select('total_donations'),
      // Count of active available donors
      supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('is_available_to_donate', true),
      // Count of all-time requests
      supabaseAdmin
        .from('blood_requests')
        .select('id', { count: 'exact', head: true }),
      // Count of fulfilled requests
      supabaseAdmin
        .from('blood_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'fulfilled'),
    ]);

    const totalDonations = (donationsRes.data ?? []).reduce(
      (sum, p) => sum + (p.total_donations ?? 0),
      0
    );

    // activeJobCount is async (DB-backed) — await it so we don't ship a
    // serialized Promise as the field value. On failure return null (not 0):
    // 0 would falsely read as "no fences running" when the DB is actually down.
    const activeJobs = await activeJobCount().catch(() => null);

    return success(res, {
      total_donations:  totalDonations,
      active_donors:    donorsRes.count   ?? 0,
      total_requests:   requestsRes.count ?? 0,
      fulfilled_requests: fulfilledRes.count ?? 0,
      lives_helped:     totalDonations, // 1 donor = 1 unit = 1 life (no inflation)
      active_geo_fencing_jobs: activeJobs,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/stats/leaderboard
 * Top 10 donors by total donation count.
 */
async function getLeaderboard(req, res, next) {
  try {
    const { data, error: dbErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, blood_group, total_donations, is_verified, avatar_url')
      .gt('total_donations', 0)
      .order('total_donations', { ascending: false })
      .limit(10);

    if (dbErr) throw dbErr;

    return success(res, data ?? []);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/stats/blood-availability
 * Count of available donors per blood group — useful for scarcity display.
 */
async function getBloodAvailability(req, res, next) {
  try {
    const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

    const { data, error: dbErr } = await supabaseAdmin
      .from('profiles')
      .select('blood_group')
      .eq('is_available_to_donate', true)
      .not('latitude', 'is', null);

    if (dbErr) throw dbErr;

    const counts = {};
    for (const bg of BLOOD_GROUPS) counts[bg] = 0;
    for (const row of data ?? []) {
      if (counts[row.blood_group] !== undefined) counts[row.blood_group]++;
    }

    const availability = BLOOD_GROUPS.map(bg => ({
      blood_group: bg,
      available_donors: counts[bg],
      scarcity: counts[bg] === 0 ? 'critical' : counts[bg] < 3 ? 'low' : counts[bg] < 10 ? 'moderate' : 'good',
    }));

    return success(res, availability);
  } catch (err) {
    next(err);
  }
}

module.exports = { getCommunityStats, getLeaderboard, getBloodAvailability };
