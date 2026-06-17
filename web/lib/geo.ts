// lib/geo.ts - haversine distance + formatting, ported from the app.

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function estimateDriveMinutes(km: number): number {
  return Math.ceil((km / 30) * 60);
}

export function filterByRadius<T extends { latitude: number; longitude: number }>(
  items: T[],
  lat: number,
  lon: number,
  radiusKm: number,
): (T & { distanceKm: number })[] {
  return items
    .map((d) => ({ ...d, distanceKm: haversineDistance(lat, lon, d.latitude, d.longitude) }))
    .filter((d) => d.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
