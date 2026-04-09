// src/services/geoFencingService.js
'use strict';

const { supabaseAdmin }           = require('../utils/supabaseAdmin');
const { filterByRadius, compatibleDonorGroups, GEO_RINGS_KM } = require('../utils/geo');
const {
  notifyDonor,
  notifyRequestStillOpen,
} = require('./notificationService');

// In-memory map of active expansion jobs: requestId → timeoutId
// In production with multiple server instances, use Redis instead.
const activeJobs = new Map();

/**
 * Fetch all active, available donors from the DB that have:
 * - is_available_to_donate = true
 * - a valid push_token
 * - a compatible blood group
 * - known latitude/longitude
 */
async function fetchEligibleDonors(bloodGroup) {
  const compatibleGroups = compatibleDonorGroups(bloodGroup);

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, blood_group, latitude, longitude, push_token, last_donation_date')
    .eq('is_available_to_donate', true)
    .in('blood_group', compatibleGroups)
    .not('push_token', 'is', null)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);

  if (error) {
    console.error('[geoFence] fetchEligibleDonors error:', error.message);
    return [];
  }

  // Exclude donors who donated within the last 90 days
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
  return (data ?? []).filter(donor => {
    if (!donor.last_donation_date) return true;
    return new Date(donor.last_donation_date).getTime() < ninetyDaysAgo;
  });
}

/**
 * Notify donors within a given radius, skipping any already notified.
 *
 * @returns {number} count of new notifications sent
 */
async function notifyRing({ request, allDonors, radiusKm, alreadyNotifiedIds }) {
  const inRing = filterByRadius(allDonors, request.latitude, request.longitude, radiusKm)
    .filter(d => !alreadyNotifiedIds.has(d.id));

  if (inRing.length === 0) return 0;

  console.log(`[geoFence] req ${request.id} | ring ${radiusKm} km | ${inRing.length} new donor(s)`);

  // Notify in parallel, max 50 at once to avoid hammering Expo
  const batches = chunk(inRing, 50);
  for (const batch of batches) {
    await Promise.allSettled(
      batch.map(donor =>
        notifyDonor({
          token:       donor.push_token,
          bloodGroup:  request.blood_group,
          urgency:     request.urgency,
          hospitalName: request.hospital_name,
          distanceKm:  donor.distanceKm,
          requestId:   request.id,
        })
      )
    );
    // Mark as notified in DB
    await supabaseAdmin.from('request_responses').upsert(
      batch.map(d => ({
        request_id: request.id,
        donor_id:   d.id,
        status:     'pending',
      })),
      { onConflict: 'request_id,donor_id', ignoreDuplicates: true }
    );

    batch.forEach(d => alreadyNotifiedIds.add(d.id));
  }

  return inRing.length;
}

/**
 * Start geo-fencing expansion for a new blood request.
 * Expands outward through GEO_RINGS_KM every GEO_EXPANSION_DELAY_SECONDS.
 */
async function startGeoFencing(request) {
  const delayMs = (parseInt(process.env.GEO_EXPANSION_DELAY_SECONDS ?? '30', 10)) * 1000;

  // Cancel any previous expansion for this request
  cancelGeoFencing(request.id);

  const alreadyNotifiedIds = new Set();

  // Fetch all eligible donors once — avoids hammering DB on every ring
  const allDonors = await fetchEligibleDonors(request.blood_group);

  if (allDonors.length === 0) {
    console.log(`[geoFence] req ${request.id} | no eligible donors anywhere`);
    return;
  }

  let ringIndex = 0;

  async function expandRing() {
    // Check request is still active before each expansion
    const { data: currentRequest } = await supabaseAdmin
      .from('blood_requests')
      .select('status')
      .eq('id', request.id)
      .single();

    if (!currentRequest || currentRequest.status !== 'active') {
      console.log(`[geoFence] req ${request.id} | no longer active, stopping expansion`);
      activeJobs.delete(request.id);
      return;
    }

    const radiusKm = GEO_RINGS_KM[ringIndex];
    const sent     = await notifyRing({ request, allDonors, radiusKm, alreadyNotifiedIds });

    // Notify recipient about expansion (only if no donor has accepted yet)
    if (ringIndex > 0) {
      const { data: recipientProfile } = await supabaseAdmin
        .from('profiles')
        .select('push_token')
        .eq('id', request.recipient_id)
        .single();

      if (recipientProfile?.push_token) {
        await notifyRequestStillOpen({
          token:     recipientProfile.push_token,
          bloodGroup: request.blood_group,
          requestId: request.id,
          ringKm:    radiusKm,
        });
      }
    }

    ringIndex++;

    if (ringIndex < GEO_RINGS_KM.length) {
      // Schedule next ring expansion
      const timeoutId = setTimeout(expandRing, delayMs);
      activeJobs.set(request.id, timeoutId);
    } else {
      // All rings exhausted
      console.log(`[geoFence] req ${request.id} | all rings exhausted | total notified: ${alreadyNotifiedIds.size}`);
      activeJobs.delete(request.id);
    }
  }

  // Start immediately with ring 0
  await expandRing();
}

/**
 * Cancel an active geo-fencing expansion job.
 */
function cancelGeoFencing(requestId) {
  const existing = activeJobs.get(requestId);
  if (existing) {
    clearTimeout(existing);
    activeJobs.delete(requestId);
    console.log(`[geoFence] req ${requestId} | expansion cancelled`);
  }
}

/**
 * Return the number of currently active expansion jobs.
 */
function activeJobCount() {
  return activeJobs.size;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

module.exports = { startGeoFencing, cancelGeoFencing, activeJobCount };
