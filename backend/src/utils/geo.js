// src/utils/geo.js
'use strict';

const GEO_RINGS_KM = [1, 5, 15, 30, 50];

/**
 * Haversine great-circle distance in kilometres.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R    = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) { return (deg * Math.PI) / 180; }

/**
 * Filter an array of donors (each must have .latitude / .longitude)
 * to those within radiusKm, sorted by ascending distance.
 */
function filterByRadius(donors, lat, lon, radiusKm) {
  return donors
    .map(d => ({ ...d, distanceKm: haversineDistance(lat, lon, d.latitude, d.longitude) }))
    .filter(d => d.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Blood group → list of blood groups that can donate to it.
 */
const DONOR_FOR_RECIPIENT = {
  'A+':  ['A+', 'A-', 'O+', 'O-'],
  'A-':  ['A-', 'O-'],
  'B+':  ['B+', 'B-', 'O+', 'O-'],
  'B-':  ['B-', 'O-'],
  'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  'AB-': ['A-', 'B-', 'AB-', 'O-'],
  'O+':  ['O+', 'O-'],
  'O-':  ['O-'],
};

/**
 * Return compatible donor blood groups for a given recipient blood group.
 */
function compatibleDonorGroups(recipientBloodGroup) {
  return DONOR_FOR_RECIPIENT[recipientBloodGroup] ?? [];
}

/**
 * Estimate drive time in minutes (assumes ~30 km/h urban average).
 */
function estimateDriveMinutes(km) {
  return Math.ceil((km / 30) * 60);
}

module.exports = {
  GEO_RINGS_KM,
  haversineDistance,
  filterByRadius,
  compatibleDonorGroups,
  estimateDriveMinutes,
};
