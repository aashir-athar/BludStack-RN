// src/services/geoFencingService.js
'use strict';

<<<<<<< HEAD
const { supabaseAdmin }     = require('../utils/supabaseAdmin');
const { filterByRadius, compatibleDonorGroups, GEO_RINGS_KM, haversineDistance } = require('../utils/geo');
const { notifyDonor, notifyRequestStillOpen } = require('./notificationService');

// ─────────────────────────────────────────────────────────────
// Country bounding boxes — matches frontend constants/BloodData.ts
// When all 50 km rings are exhausted, we search within the same
// country as the request origin (never cross-border).
// ─────────────────────────────────────────────────────────────
const COUNTRY_BOUNDS = {
  PK: { latMin: 23.5, latMax: 37.1, lonMin: 60.8,  lonMax: 77.8,  name: 'Pakistan' },
  IN: { latMin: 8.0,  latMax: 37.1, lonMin: 68.0,  lonMax: 97.4,  name: 'India' },
  BD: { latMin: 20.6, latMax: 26.6, lonMin: 88.0,  lonMax: 92.7,  name: 'Bangladesh' },
  US: { latMin: 24.4, latMax: 49.4, lonMin: -125.0, lonMax: -66.9, name: 'United States' },
  GB: { latMin: 49.9, latMax: 60.9, lonMin: -8.6,  lonMax: 1.8,   name: 'United Kingdom' },
  SA: { latMin: 16.3, latMax: 32.2, lonMin: 36.4,  lonMax: 55.7,  name: 'Saudi Arabia' },
  AE: { latMin: 22.6, latMax: 26.1, lonMin: 51.5,  lonMax: 56.4,  name: 'UAE' },
  NG: { latMin: 4.2,  latMax: 13.9, lonMin: 2.7,   lonMax: 14.7,  name: 'Nigeria' },
  EG: { latMin: 22.0, latMax: 31.7, lonMin: 24.7,  lonMax: 37.2,  name: 'Egypt' },
  ZA: { latMin: -34.8, latMax: -22.1, lonMin: 16.4, lonMax: 32.9, name: 'South Africa' },
};

/**
 * Detect country code from coordinates.
 * Returns undefined if no bounding box matches.
 */
function detectCountryCode(lat, lon) {
  for (const [code, box] of Object.entries(COUNTRY_BOUNDS)) {
    if (lat >= box.latMin && lat <= box.latMax && lon >= box.lonMin && lon <= box.lonMax) {
      return code;
    }
  }
  return undefined;
}

/**
 * Filter donors to those within a country bounding box.
 * Ensures cross-border donors are never matched.
 */
function filterByCountry(donors, countryCode) {
  const box = COUNTRY_BOUNDS[countryCode];
  if (!box) return donors; // unknown country — don't block
  return donors.filter(d =>
    d.latitude  >= box.latMin && d.latitude  <= box.latMax &&
    d.longitude >= box.lonMin && d.longitude <= box.lonMax
  );
}

// ─────────────────────────────────────────────────────────────
// Active geo-fencing jobs: requestId → timeoutId
// In production with multiple instances, use Redis pub/sub.
// ─────────────────────────────────────────────────────────────
const activeJobs = new Map();

/**
 * Fetch all eligible donors:
 * - available to donate
 * - compatible blood group
 * - has a push token
 * - has known GPS coords
 * - last donated 90+ days ago
 */
async function fetchEligibleDonors(bloodGroup) {
  const compatible = compatibleDonorGroups(bloodGroup);
=======
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
>>>>>>> 49202d67bd59792b4429cfd0a90fbf7f58c45535

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, blood_group, latitude, longitude, push_token, last_donation_date')
    .eq('is_available_to_donate', true)
<<<<<<< HEAD
    .in('blood_group', compatible)
    .not('push_token', 'is', null)
    .not('latitude',   'is', null)
    .not('longitude',  'is', null);

  if (error) {
    console.error('[geoFence] fetchEligibleDonors:', error.message);
    return [];
  }

  const ninetyDaysAgo = Date.now() - 90 * 86_400_000;
  return (data ?? []).filter(d =>
    !d.last_donation_date ||
    new Date(d.last_donation_date).getTime() < ninetyDaysAgo
  );
}

/**
 * Notify donors in a given ring who haven't been notified yet.
 * Returns the count of new notifications sent.
 */
async function notifyRing({ request, donors, radiusKm, notifiedIds }) {
  const inRing = filterByRadius(donors, request.latitude, request.longitude, radiusKm)
    .filter(d => !notifiedIds.has(d.id));

  if (inRing.length === 0) return 0;

  console.log(`[geoFence] req=${request.id} | ring=${radiusKm}km | new=${inRing.length}`);

  // Batch into 50 to avoid overwhelming Expo push service
=======
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
>>>>>>> 49202d67bd59792b4429cfd0a90fbf7f58c45535
  const batches = chunk(inRing, 50);
  for (const batch of batches) {
    await Promise.allSettled(
      batch.map(donor =>
        notifyDonor({
<<<<<<< HEAD
          token:        donor.push_token,
          bloodGroup:   request.blood_group,
          urgency:      request.urgency,
          hospitalName: request.hospital_name,
          distanceKm:   donor.distanceKm,
          requestId:    request.id,
        })
      )
    );

    // Record as pending in DB
    await supabaseAdmin
      .from('request_responses')
      .upsert(
        batch.map(d => ({ request_id: request.id, donor_id: d.id, status: 'pending' })),
        { onConflict: 'request_id,donor_id', ignoreDuplicates: true }
      );

    batch.forEach(d => notifiedIds.add(d.id));
=======
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
>>>>>>> 49202d67bd59792b4429cfd0a90fbf7f58c45535
  }

  return inRing.length;
}

/**
<<<<<<< HEAD
 * Country-wide fallback search.
 * Called after all 50 km rings are exhausted.
 * Only searches within the same country as the request — never cross-border.
 */
async function runCountryWideFallback({ request, allDonors, notifiedIds, countryCode, countryName }) {
  // Filter to same country only
  const countryDonors = filterByCountry(allDonors, countryCode)
    .filter(d => !notifiedIds.has(d.id));

  if (countryDonors.length === 0) {
    console.log(`[geoFence] req=${request.id} | country fallback (${countryName}) | no new donors`);
    return;
  }

  console.log(
    `[geoFence] req=${request.id} | country fallback (${countryName}) | ` +
    `notifying ${countryDonors.length} donor(s) across entire country`
  );

  // Attach distanceKm for logging
  const withDist = countryDonors.map(d => ({
    ...d,
    distanceKm: haversineDistance(request.latitude, request.longitude, d.latitude, d.longitude),
  }));

  const batches = chunk(withDist, 50);
  for (const batch of batches) {
    await Promise.allSettled(
      batch.map(donor =>
        notifyDonor({
          token:        donor.push_token,
          bloodGroup:   request.blood_group,
          urgency:      request.urgency,
          hospitalName: request.hospital_name,
          distanceKm:   donor.distanceKm,
          requestId:    request.id,
        })
      )
    );

    await supabaseAdmin
      .from('request_responses')
      .upsert(
        batch.map(d => ({ request_id: request.id, donor_id: d.id, status: 'pending' })),
        { onConflict: 'request_id,donor_id', ignoreDuplicates: true }
      );

    batch.forEach(d => notifiedIds.add(d.id));
  }

  // Notify recipient that country-wide search is active
  const { data: recipient } = await supabaseAdmin
    .from('profiles')
    .select('push_token')
    .eq('id', request.recipient_id)
    .single();

  if (recipient?.push_token) {
    await notifyRequestStillOpen({
      token:      recipient.push_token,
      bloodGroup: request.blood_group,
      requestId:  request.id,
      ringKm:     999, // sentinel — UI shows "nationwide"
    });
  }
}

/**
 * Start geo-fencing expansion for a new blood request.
 *
 * Flow:
 *   Ring 0 (1 km) → Ring 1 (5 km) → Ring 2 (15 km) → Ring 3 (30 km) → Ring 4 (50 km)
 *   → Country-wide fallback (same country, NOT cross-border)
 *
 * Expansion stops when a donor accepts.
=======
 * Start geo-fencing expansion for a new blood request.
 * Expands outward through GEO_RINGS_KM every GEO_EXPANSION_DELAY_SECONDS.
>>>>>>> 49202d67bd59792b4429cfd0a90fbf7f58c45535
 */
async function startGeoFencing(request) {
  const delayMs = (parseInt(process.env.GEO_EXPANSION_DELAY_SECONDS ?? '30', 10)) * 1000;

<<<<<<< HEAD
  cancelGeoFencing(request.id);

  const notifiedIds  = new Set();
  const allDonors    = await fetchEligibleDonors(request.blood_group);
  const countryCode  = detectCountryCode(request.latitude, request.longitude);
  const countryName  = countryCode ? (COUNTRY_BOUNDS[countryCode]?.name ?? countryCode) : 'your country';

  console.log(
    `[geoFence] Starting for req=${request.id} | ` +
    `blood=${request.blood_group} | eligible=${allDonors.length} | country=${countryName}`
  );

  if (allDonors.length === 0) {
    console.log(`[geoFence] req=${request.id} | no eligible donors anywhere`);
=======
  // Cancel any previous expansion for this request
  cancelGeoFencing(request.id);

  const alreadyNotifiedIds = new Set();

  // Fetch all eligible donors once — avoids hammering DB on every ring
  const allDonors = await fetchEligibleDonors(request.blood_group);

  if (allDonors.length === 0) {
    console.log(`[geoFence] req ${request.id} | no eligible donors anywhere`);
>>>>>>> 49202d67bd59792b4429cfd0a90fbf7f58c45535
    return;
  }

  let ringIndex = 0;

  async function expandRing() {
<<<<<<< HEAD
    // Abort if request is no longer active
    const { data: current } = await supabaseAdmin
=======
    // Check request is still active before each expansion
    const { data: currentRequest } = await supabaseAdmin
>>>>>>> 49202d67bd59792b4429cfd0a90fbf7f58c45535
      .from('blood_requests')
      .select('status')
      .eq('id', request.id)
      .single();

<<<<<<< HEAD
    if (!current || current.status !== 'active') {
      console.log(`[geoFence] req=${request.id} | no longer active — stopping`);
=======
    if (!currentRequest || currentRequest.status !== 'active') {
      console.log(`[geoFence] req ${request.id} | no longer active, stopping expansion`);
>>>>>>> 49202d67bd59792b4429cfd0a90fbf7f58c45535
      activeJobs.delete(request.id);
      return;
    }

<<<<<<< HEAD
    if (ringIndex < GEO_RINGS_KM.length) {
      // ── Standard radius ring ──────────────────────────────
      const radiusKm = GEO_RINGS_KM[ringIndex];
      await notifyRing({ request, donors: allDonors, radiusKm, notifiedIds });

      // Notify recipient on expansion rings (not the first)
      if (ringIndex > 0) {
        const { data: recipient } = await supabaseAdmin
          .from('profiles')
          .select('push_token')
          .eq('id', request.recipient_id)
          .single();

        if (recipient?.push_token) {
          await notifyRequestStillOpen({
            token:      recipient.push_token,
            bloodGroup: request.blood_group,
            requestId:  request.id,
            ringKm:     radiusKm,
          });
        }
      }

      ringIndex++;

      // Schedule next ring
      const timeoutId = setTimeout(expandRing, delayMs);
      activeJobs.set(request.id, timeoutId);

    } else {
      // ── All radius rings exhausted → country-wide fallback ──
      activeJobs.delete(request.id);

      if (countryCode) {
        await runCountryWideFallback({
          request, allDonors, notifiedIds, countryCode, countryName,
        });
      } else {
        console.log(`[geoFence] req=${request.id} | all rings exhausted | country unknown — no fallback`);
      }
=======
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
>>>>>>> 49202d67bd59792b4429cfd0a90fbf7f58c45535
    }
  }

  // Start immediately with ring 0
  await expandRing();
}

/**
<<<<<<< HEAD
 * Stop an active expansion (called when a donor accepts or request is cancelled).
=======
 * Cancel an active geo-fencing expansion job.
>>>>>>> 49202d67bd59792b4429cfd0a90fbf7f58c45535
 */
function cancelGeoFencing(requestId) {
  const existing = activeJobs.get(requestId);
  if (existing) {
    clearTimeout(existing);
    activeJobs.delete(requestId);
<<<<<<< HEAD
    console.log(`[geoFence] req=${requestId} | expansion stopped`);
  }
}

=======
    console.log(`[geoFence] req ${requestId} | expansion cancelled`);
  }
}

/**
 * Return the number of currently active expansion jobs.
 */
>>>>>>> 49202d67bd59792b4429cfd0a90fbf7f58c45535
function activeJobCount() {
  return activeJobs.size;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

module.exports = { startGeoFencing, cancelGeoFencing, activeJobCount };
