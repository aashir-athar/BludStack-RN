// utils/geo.ts

/**
 * Haversine formula — great-circle distance between two points (km)
 */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Earth radius km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Format distance for human display
 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/**
 * Estimate driving time (rough: 30 km/h average urban)
 */
export function estimateDriveMinutes(km: number): number {
  return Math.ceil((km / 30) * 60);
}

/**
 * Geo-fence ring radii — Uber-surge style expansion
 */
export const GEO_RINGS_KM = [1, 5, 15, 30, 50] as const;

/**
 * Determine which geo-ring index covers a given distance
 */
export function geoRingIndex(km: number): number {
  for (let i = 0; i < GEO_RINGS_KM.length; i++) {
    if (km <= GEO_RINGS_KM[i]) return i;
  }
  return GEO_RINGS_KM.length - 1;
}

/**
 * Filter donors by radius, sorted by distance
 */
export function filterDonorsByRadius<T extends { latitude: number; longitude: number }>(
  donors: T[],
  lat: number,
  lon: number,
  radiusKm: number
): Array<T & { distanceKm: number }> {
  return donors
    .map((d) => ({ ...d, distanceKm: haversineDistance(lat, lon, d.latitude, d.longitude) }))
    .filter((d) => d.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Convert coordinate delta to approximate km (for map region)
 */
export function deltaFromKm(km: number): number {
  return km / 111; // 1 degree lat ≈ 111 km
}
