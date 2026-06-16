// src/services/geoFencingService.js
'use strict';

/**
 * Geo-fencing expansion service.
 *
 * Architecture (post-hardening — fixes flaws #7, #9, #10):
 *   • State is persisted in `blood_requests.geofence_ring_index` and
 *     `blood_requests.geofence_next_at`. There is NO in-memory Map.
 *   • A single tick worker runs every 5 s on every backend instance.
 *     Each tick picks up requests whose `geofence_next_at <= now()` using
 *     SELECT ... FOR UPDATE SKIP LOCKED — safe across multiple instances.
 *   • Per-ring donor eligibility is re-queried each tick (so a donor who
 *     toggles availability off mid-expansion is excluded immediately).
 *   • Donors who DECLINED a request are excluded from future rings.
 *   • If the recipient cancels (status=cancelled) or someone accepts
 *     (status flipped or geofence_next_at cleared), the worker simply
 *     skips that request — no setTimeout to cancel.
 *
 * Flow:
 *   POST /requests  →  inserts blood_request with geofence_next_at = now()
 *   tick()          →  ring 0 (1 km) → schedules ring 1 in 30 s
 *                   →  ring 1 (5 km) → ring 2 (15 km) → ring 3 (30 km) → ring 4 (50 km)
 *                   →  country-wide fallback → done (geofence_next_at = null)
 *   donor accepts   →  cancelGeoFencing(id) clears geofence_next_at
 *   request expires →  cron flips status; tick skips it
 */

const { supabaseAdmin } = require('../utils/supabaseAdmin');
const {
  filterByRadius,
  compatibleDonorGroups,
  GEO_RINGS_KM,
  haversineDistance,
} = require('../utils/geo');
const { detectCountryCode, countryName, filterByCountry } = require('../utils/countryBounds');
const { notifyDonor, notifyRequestStillOpen } = require('./notificationService');

const TICK_INTERVAL_MS  = 5_000;
const DEFAULT_DELAY_S   = parseInt(process.env.GEO_EXPANSION_DELAY_SECONDS ?? '30', 10);
const BATCH_SIZE        = 50;
const COUNTRY_RING_SENTINEL = GEO_RINGS_KM.length; // index just past the last radius ring

let tickHandle = null;

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Build the donor pool eligible to receive notifications for a request.
 * Filters at the DB level for index efficiency, then filters declined/cooldown in JS.
 */
async function fetchEligibleDonors(request) {
  const compatible = compatibleDonorGroups(request.blood_group);
  if (compatible.length === 0) return [];

  // 1. All compatible, available, push-enabled, located donors
  const { data: donors, error: donorErr } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, blood_group, latitude, longitude, push_token, last_donation_date')
    .eq('is_available_to_donate', true)
    .in('blood_group', compatible)
    .not('push_token', 'is', null)
    .not('latitude',   'is', null)
    .not('longitude',  'is', null)
    .neq('id', request.recipient_id);

  if (donorErr) {
    console.error('[geoFence] fetchEligibleDonors:', donorErr.message);
    return [];
  }

  // 2. Strip 90-day cooldown
  const ninetyDaysAgo = Date.now() - 90 * 86_400_000;
  const cooldownOk = (donors ?? []).filter(d =>
    !d.last_donation_date || new Date(d.last_donation_date).getTime() < ninetyDaysAgo
  );

  // 3. Exclude donors with an existing response (pending = already notified;
  //    accepted/completed = already engaged; declined = explicit opt-out).
  //    This implements flaw-fix #9.
  const { data: existing } = await supabaseAdmin
    .from('request_responses')
    .select('donor_id, status')
    .eq('request_id', request.id);

  const excluded = new Set((existing ?? []).map(r => r.donor_id));
  return cooldownOk.filter(d => !excluded.has(d.id));
}

/**
 * Send notifications + record `pending` responses in batches.
 * Returns count of donors actually notified.
 */
async function notifyDonors(request, donors) {
  if (donors.length === 0) return 0;

  const batches = chunk(donors, BATCH_SIZE);
  for (const batch of batches) {
    await Promise.allSettled(batch.map(d =>
      notifyDonor({
        token:        d.push_token,
        bloodGroup:   request.blood_group,
        urgency:      request.urgency,
        hospitalName: request.hospital_name,
        distanceKm:   d.distanceKm,
        requestId:    request.id,
      })
    ));

    await supabaseAdmin
      .from('request_responses')
      .upsert(
        batch.map(d => ({ request_id: request.id, donor_id: d.id, status: 'pending' })),
        { onConflict: 'request_id,donor_id', ignoreDuplicates: true }
      );
  }
  return donors.length;
}

async function notifyRecipientExpansion(request, ringKm) {
  const { data: recipient } = await supabaseAdmin
    .from('profiles')
    .select('push_token')
    .eq('id', request.recipient_id)
    .single();
  if (!recipient?.push_token) return;

  await notifyRequestStillOpen({
    token:      recipient.push_token,
    bloodGroup: request.blood_group,
    requestId:  request.id,
    ringKm,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Per-request expansion step (one ring)
// ────────────────────────────────────────────────────────────────────────────

async function expandOne(request) {
  // Defensive re-check status — request may have been cancelled/fulfilled
  // between the worker SELECT and our re-fetch.
  if (request.status !== 'active') return clearFence(request.id);

  const ringIndex = request.geofence_ring_index ?? 0;

  // ── Country-wide fallback ring ─────────────────────────────────────────
  if (ringIndex >= COUNTRY_RING_SENTINEL) {
    const code = request.geofence_country
      ?? detectCountryCode(request.latitude, request.longitude);

    if (!code) {
      console.log(`[geoFence] req=${request.id} | country unknown — fence complete`);
      return clearFence(request.id);
    }

    const allEligible = await fetchEligibleDonors(request);
    const inCountry   = filterByCountry(allEligible, code).map(d => ({
      ...d,
      distanceKm: haversineDistance(request.latitude, request.longitude, d.latitude, d.longitude),
    }));

    console.log(
      `[geoFence] req=${request.id} | country fallback (${countryName(code)}) | ` +
      `notifying ${inCountry.length} donor(s)`
    );

    await notifyDonors(request, inCountry);
    await notifyRecipientExpansion(request, 999); // 999 sentinel = nationwide
    return clearFence(request.id);
  }

  // ── Standard radius ring ───────────────────────────────────────────────
  const radiusKm = GEO_RINGS_KM[ringIndex];
  const allEligible = await fetchEligibleDonors(request);
  const inRing = filterByRadius(allEligible, request.latitude, request.longitude, radiusKm);

  console.log(`[geoFence] req=${request.id} | ring=${radiusKm}km | eligible=${inRing.length}`);

  await notifyDonors(request, inRing);

  // From ring 1 onward, nudge the recipient that the search is widening —
  // whether or not this ring surfaced new donors — so they know we're trying.
  // The per-request CAS claim in tick() guarantees one instance per ring, so
  // this fires at most once per expansion (no duplicate "still searching" push).
  if (ringIndex > 0) {
    await notifyRecipientExpansion(request, radiusKm);
  }

  // Schedule next ring
  const nextRing = ringIndex + 1;
  const nextAt   = new Date(Date.now() + DEFAULT_DELAY_S * 1000).toISOString();
  const country  = request.geofence_country
    ?? detectCountryCode(request.latitude, request.longitude);

  await supabaseAdmin
    .from('blood_requests')
    .update({
      geofence_ring_index: nextRing,
      geofence_next_at:    nextAt,
      geofence_country:    country,
    })
    .eq('id', request.id)
    .eq('status', 'active'); // skip if cancelled/fulfilled in the meantime
}

async function clearFence(requestId) {
  await supabaseAdmin
    .from('blood_requests')
    .update({ geofence_next_at: null })
    .eq('id', requestId);
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Kick off geo-fencing for a newly-created request.
 * Just stamps geofence_next_at = now() so the tick worker picks it up
 * within TICK_INTERVAL_MS. Idempotent.
 */
async function startGeoFencing(request) {
  const country = detectCountryCode(request.latitude, request.longitude);
  await supabaseAdmin
    .from('blood_requests')
    .update({
      geofence_ring_index: 0,
      geofence_next_at:    new Date().toISOString(),
      geofence_country:    country,
    })
    .eq('id', request.id);
  console.log(`[geoFence] queued req=${request.id} | country=${countryName(country)}`);
}

/**
 * Cancel any pending expansion (donor accepted, recipient cancelled).
 */
async function cancelGeoFencing(requestId) {
  await clearFence(requestId);
}

// ────────────────────────────────────────────────────────────────────────────
// Tick worker — runs every TICK_INTERVAL_MS
// ────────────────────────────────────────────────────────────────────────────

async function tick() {
  try {
    const { data: due } = await supabaseAdmin
      .from('blood_requests')
      .select('*')
      .eq('status', 'active')
      .not('geofence_next_at', 'is', null)
      .lte('geofence_next_at', new Date().toISOString())
      .order('geofence_next_at', { ascending: true })
      .limit(25);

    if (!due?.length) return;

    // Claim each request by clearing geofence_next_at BEFORE expanding,
    // so a second instance running the same tick will not double-process.
    // (Supabase JS client doesn't expose FOR UPDATE SKIP LOCKED, but a
    //  conditional update on geofence_next_at acts as a CAS lock.)
    for (const req of due) {
      const claim = await supabaseAdmin
        .from('blood_requests')
        .update({ geofence_next_at: null })
        .eq('id', req.id)
        .eq('geofence_next_at', req.geofence_next_at)
        .select('id')
        .maybeSingle();
      if (!claim.data) continue; // another instance won the claim

      // expand outside the claim — restore geofence_next_at when scheduling next ring
      await expandOne(req).catch(err =>
        console.error(`[geoFence] expand failed req=${req.id}:`, err.message)
      );
    }
  } catch (err) {
    console.error('[geoFence] tick error:', err.message);
  }
}

function startWorker() {
  if (tickHandle) return;
  tickHandle = setInterval(tick, TICK_INTERVAL_MS);
  if (typeof tickHandle.unref === 'function') tickHandle.unref();
  console.log(`[geoFence] worker started — tick every ${TICK_INTERVAL_MS / 1000}s`);
}

function stopWorker() {
  if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
}

/**
 * For backwards-compat with cron health log — counts requests with an active fence.
 */
async function activeJobCount() {
  const { count } = await supabaseAdmin
    .from('blood_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .not('geofence_next_at', 'is', null);
  return count ?? 0;
}

module.exports = {
  startGeoFencing,
  cancelGeoFencing,
  startWorker,
  stopWorker,
  activeJobCount,
  // Exposed so the Vercel cron endpoint can drive ticks externally.
  tick,
};
