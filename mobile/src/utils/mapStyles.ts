// utils/mapStyles.ts
// ────────────────────────────────────────────────────────────────────────────
// Free, no-API-key MapLibre style specs for BludStack's map screens.
//
//   • Light → OpenStreetMap's standard raster tiles (free, no key, no quota
//             at hobby scale; respect tile usage policy at scale).
//   • Dark  → CARTO's "Dark Matter (no labels removed)" raster tiles —
//             free, no key, derived from OSM data, CC-BY 3.0.
//
// Both servers serve standard 256×256 raster tiles. MapLibre composes them
// into a smooth pannable layer; the rest of the map UI (markers, lines,
// circles) is rendered by us on top.
// ────────────────────────────────────────────────────────────────────────────

export const OSM_LIGHT_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
} as const;

export const OSM_DARK_STYLE = {
  version: 8,
  sources: {
    'carto-dark': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'carto-dark',
      type: 'raster',
      source: 'carto-dark',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
} as const;

export function getMapStyleJSON(isDark: boolean): string {
  return JSON.stringify(isDark ? OSM_DARK_STYLE : OSM_LIGHT_STYLE);
}

// MapLibre coordinate order is [longitude, latitude] (GeoJSON convention),
// the opposite of react-native-maps' { latitude, longitude }. Helpers keep
// the screens readable.
export const lonLat = (latitude: number, longitude: number): [number, number] => [longitude, latitude];

// Approximate zoom level that frames `radiusKm` around the given point.
// Linear-ish fit calibrated against OSM tile pixel density at lat ~30°.
export function zoomFromRadiusKm(radiusKm: number): number {
  if (radiusKm <= 1)    return 15;
  if (radiusKm <= 2)    return 14;
  if (radiusKm <= 5)    return 13;
  if (radiusKm <= 10)   return 12;
  if (radiusKm <= 25)   return 11;
  if (radiusKm <= 50)   return 10;
  if (radiusKm <= 100)  return 9;
  return 8;
}
