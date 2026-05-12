// src/utils/countryBounds.js
'use strict';

/**
 * Country bounding boxes — single source of truth on the backend.
 * Kept intentionally narrow so we never match a donor across an international
 * border (e.g. Pakistani Punjab vs Indian Punjab on either side of the line).
 *
 * If you add a country, mirror the entry in mobile/constants/BloodData.ts
 * (the mobile copy is informational only — actual matching happens server-side).
 */
const COUNTRY_BOUNDS = Object.freeze({
  PK: { latMin: 23.5,  latMax: 37.1, lonMin: 60.8,   lonMax: 75.4,  name: 'Pakistan' },
  IN: { latMin: 8.0,   latMax: 37.1, lonMin: 68.0,   lonMax: 97.4,  name: 'India' },
  BD: { latMin: 20.6,  latMax: 26.6, lonMin: 88.0,   lonMax: 92.7,  name: 'Bangladesh' },
  US: { latMin: 24.4,  latMax: 49.4, lonMin: -125.0, lonMax: -66.9, name: 'United States' },
  GB: { latMin: 49.9,  latMax: 60.9, lonMin: -8.6,   lonMax: 1.8,   name: 'United Kingdom' },
  SA: { latMin: 16.3,  latMax: 32.2, lonMin: 36.4,   lonMax: 55.7,  name: 'Saudi Arabia' },
  AE: { latMin: 22.6,  latMax: 26.1, lonMin: 51.5,   lonMax: 56.4,  name: 'UAE' },
  NG: { latMin: 4.2,   latMax: 13.9, lonMin: 2.7,    lonMax: 14.7,  name: 'Nigeria' },
  EG: { latMin: 22.0,  latMax: 31.7, lonMin: 24.7,   lonMax: 37.2,  name: 'Egypt' },
  ZA: { latMin: -34.8, latMax: -22.1, lonMin: 16.4,  lonMax: 32.9,  name: 'South Africa' },
});

function detectCountryCode(lat, lon) {
  for (const [code, box] of Object.entries(COUNTRY_BOUNDS)) {
    if (lat >= box.latMin && lat <= box.latMax && lon >= box.lonMin && lon <= box.lonMax) {
      return code;
    }
  }
  return null;
}

function countryName(code) {
  return COUNTRY_BOUNDS[code]?.name ?? 'your country';
}

function filterByCountry(donors, code) {
  const box = COUNTRY_BOUNDS[code];
  if (!box) return donors;
  return donors.filter(d =>
    d.latitude  >= box.latMin && d.latitude  <= box.latMax &&
    d.longitude >= box.lonMin && d.longitude <= box.lonMax
  );
}

module.exports = { COUNTRY_BOUNDS, detectCountryCode, countryName, filterByCountry };
