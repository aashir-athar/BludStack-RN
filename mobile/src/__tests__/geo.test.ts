// Geo math drives the nearest-donor search rings and the live-map distance/ETA.
// Wrong haversine output means donors get matched to the wrong requests, so we
// pin it against known city-to-city distances and check the formatting edges.
import { describe, it, expect } from '@jest/globals';
import {
  haversineDistance,
  formatDistance,
  estimateDriveMinutes,
  filterDonorsByRadius,
} from '@/utils/geo';

describe('haversineDistance', () => {
  it('is zero for the same point', () => {
    expect(haversineDistance(31.5204, 74.3587, 31.5204, 74.3587)).toBe(0);
  });

  it('matches the Lahore -> Islamabad great-circle distance (~268 km)', () => {
    const km = haversineDistance(31.5204, 74.3587, 33.6844, 73.0479);
    expect(km).toBeGreaterThan(255);
    expect(km).toBeLessThan(280);
  });

  it('is symmetric', () => {
    const a = haversineDistance(31.5, 74.3, 24.86, 67.0);
    const b = haversineDistance(24.86, 67.0, 31.5, 74.3);
    expect(a).toBeCloseTo(b, 6);
  });

  it('keeps ~111 km per degree of latitude at the equator', () => {
    const km = haversineDistance(0, 0, 1, 0);
    expect(km).toBeGreaterThan(110);
    expect(km).toBeLessThan(112);
  });
});

describe('formatDistance', () => {
  it('shows metres below 1 km', () => {
    expect(formatDistance(0.4)).toBe('400 m');
  });
  it('shows one decimal between 1 and 10 km', () => {
    expect(formatDistance(3.27)).toBe('3.3 km');
  });
  it('rounds to whole km at 10 km and above', () => {
    expect(formatDistance(42.6)).toBe('43 km');
  });
});

describe('estimateDriveMinutes', () => {
  it('assumes a 30 km/h urban average and rounds up', () => {
    expect(estimateDriveMinutes(15)).toBe(30);
    expect(estimateDriveMinutes(1)).toBe(2);
  });
});

describe('filterDonorsByRadius', () => {
  const here = { latitude: 31.5204, longitude: 74.3587 };
  const donors = [
    { id: 'near', latitude: 31.53, longitude: 74.36 }, // ~1 km
    { id: 'far', latitude: 33.6844, longitude: 73.0479 }, // ~268 km
  ];

  it('keeps only donors inside the radius, nearest first, with distanceKm', () => {
    const within = filterDonorsByRadius(donors, here.latitude, here.longitude, 50);
    expect(within.map((d) => d.id)).toEqual(['near']);
    expect(within[0].distanceKm).toBeGreaterThan(0);
  });

  it('returns everyone when the radius is wide enough, sorted by distance', () => {
    const within = filterDonorsByRadius(donors, here.latitude, here.longitude, 500);
    expect(within.map((d) => d.id)).toEqual(['near', 'far']);
    expect(within[0].distanceKm).toBeLessThan(within[1].distanceKm);
  });
});
