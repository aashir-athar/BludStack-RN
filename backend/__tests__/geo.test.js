'use strict';

// The backend's geo + compatibility helpers gate the nearest-donor search and
// the matching rules. They must stay byte-for-byte in agreement with the mobile
// client (mobile/src/utils/geo.ts, constants/BloodData.ts) or a donor matched on
// one side is rejected on the other.
const {
  haversineDistance,
  filterByRadius,
  compatibleDonorGroups,
  estimateDriveMinutes,
  GEO_RINGS_KM,
} = require('../src/utils/geo');

describe('haversineDistance', () => {
  it('is zero for identical coordinates', () => {
    expect(haversineDistance(31.5204, 74.3587, 31.5204, 74.3587)).toBe(0);
  });

  it('matches Lahore -> Islamabad (~268 km)', () => {
    const km = haversineDistance(31.5204, 74.3587, 33.6844, 73.0479);
    expect(km).toBeGreaterThan(255);
    expect(km).toBeLessThan(280);
  });

  it('is symmetric', () => {
    const a = haversineDistance(31.5, 74.3, 24.86, 67.0);
    const b = haversineDistance(24.86, 67.0, 31.5, 74.3);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe('filterByRadius', () => {
  const donors = [
    { id: 'near', latitude: 31.53, longitude: 74.36 },
    { id: 'far', latitude: 33.6844, longitude: 73.0479 },
  ];

  it('keeps only donors within the radius, nearest first', () => {
    const within = filterByRadius(donors, 31.5204, 74.3587, 50);
    expect(within.map((d) => d.id)).toEqual(['near']);
    expect(within[0].distanceKm).toBeGreaterThan(0);
  });

  it('orders all donors by ascending distance when radius is wide', () => {
    const within = filterByRadius(donors, 31.5204, 74.3587, 500);
    expect(within.map((d) => d.id)).toEqual(['near', 'far']);
    expect(within[0].distanceKm).toBeLessThan(within[1].distanceKm);
  });
});

describe('compatibleDonorGroups', () => {
  it('returns only O- for an O- recipient', () => {
    expect(compatibleDonorGroups('O-')).toEqual(['O-']);
  });

  it('returns all eight groups for an AB+ recipient', () => {
    expect(compatibleDonorGroups('AB+').sort()).toEqual(
      ['A+', 'A-', 'AB+', 'AB-', 'B+', 'B-', 'O+', 'O-'].sort(),
    );
  });

  it('never offers positive blood to a negative recipient', () => {
    for (const recipient of ['A-', 'B-', 'AB-', 'O-']) {
      for (const donor of compatibleDonorGroups(recipient)) {
        expect(donor.endsWith('+')).toBe(false);
      }
    }
  });

  it('returns an empty list for an unknown group', () => {
    expect(compatibleDonorGroups('Z+')).toEqual([]);
  });
});

describe('estimateDriveMinutes', () => {
  it('assumes a 30 km/h average and rounds up', () => {
    expect(estimateDriveMinutes(15)).toBe(30);
    expect(estimateDriveMinutes(1)).toBe(2);
  });
});

describe('GEO_RINGS_KM', () => {
  it('escalates the search outward in fixed rings', () => {
    expect(GEO_RINGS_KM).toEqual([1, 5, 15, 30, 50]);
  });
});
