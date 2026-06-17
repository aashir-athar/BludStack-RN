// utils/geo.ts
import { COUNTRY_BOUNDS } from '@/constants/BloodData';

export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number) { return (deg * Math.PI) / 180; }

export function formatDistance(km: number): string {
  if (km < 1)   return `${Math.round(km * 1000)} m`;
  if (km < 10)  return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function estimateDriveMinutes(km: number): number {
  return Math.ceil((km / 30) * 60);
}

export const GEO_RINGS_KM = [1, 5, 15, 30, 50] as const;

export function filterDonorsByRadius<T extends { latitude: number; longitude: number }>(
  donors: T[],
  lat: number,
  lon: number,
  radiusKm: number,
): (T & { distanceKm: number })[] {
  return donors
    .map(d => ({ ...d, distanceKm: haversineDistance(lat, lon, d.latitude, d.longitude) }))
    .filter(d => d.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export function deltaFromKm(km: number): number {
  return km / 111;
}

/**
 * Detect which country code a coordinate belongs to.
 * Returns undefined if no bounding box matches (open ocean, etc.)
 */
export function detectCountryCode(lat: number, lon: number): string | undefined {
  for (const [code, box] of Object.entries(COUNTRY_BOUNDS)) {
    if (
      lat >= box.latMin && lat <= box.latMax &&
      lon >= box.lonMin && lon <= box.lonMax
    ) {
      return code;
    }
  }
  return undefined;
}

/**
 * Returns true if a coordinate is within the bounding box of a country code.
 */
export function isInCountry(lat: number, lon: number, countryCode: string): boolean {
  const box = COUNTRY_BOUNDS[countryCode];
  if (!box) return true; // unknown country — don't block
  return (
    lat >= box.latMin && lat <= box.latMax &&
    lon >= box.lonMin && lon <= box.lonMax
  );
}

/**
 * Filter donors to those inside a country bounding box.
 * Used when geo-fence expands past 50 km — prevents cross-border matches.
 */
export function filterDonorsByCountry<T extends { latitude: number; longitude: number }>(
  donors: T[],
  countryCode: string,
): T[] {
  const box = COUNTRY_BOUNDS[countryCode];
  if (!box) return donors; // no box known — return all
  return donors.filter(d =>
    d.latitude  >= box.latMin && d.latitude  <= box.latMax &&
    d.longitude >= box.lonMin && d.longitude <= box.lonMax
  );
}
