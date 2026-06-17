"use client";

// MapLibre GL JS map - the web counterpart of the app's MapLibre screens. Same
// free tiles (OSM / CARTO dark), no API key, no cost. Two modes: a click-to-place
// picker (onPick) and a live view (markers). SSR-safe via dynamic import in use.
import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export interface MapMarker {
  id: string;
  lng: number;
  lat: number;
  color: string;
  label?: string;
}

interface MapViewProps {
  center: { lng: number; lat: number };
  zoom?: number;
  markers?: MapMarker[];
  onPick?: (coords: { lng: number; lat: number }) => void;
  className?: string;
}

// CARTO Dark Matter raster tiles - free, derived from OSM, matches the app's dark map.
const DARK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    },
  },
  layers: [{ id: "carto", type: "raster", source: "carto" }],
};

export function MapView({ center, zoom = 12, markers = [], onPick, className }: MapViewProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markerRefs = useRef<maplibregl.Marker[]>([]);
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  // Init once.
  useEffect(() => {
    if (!container.current || map.current) return;
    const m = new maplibregl.Map({
      container: container.current,
      style: DARK_STYLE,
      center: [center.lng, center.lat],
      zoom,
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    if (onPickRef.current) {
      m.on("click", (e) => onPickRef.current?.({ lng: e.lngLat.lng, lat: e.lngLat.lat }));
    }
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep center in sync.
  useEffect(() => {
    map.current?.easeTo({ center: [center.lng, center.lat], duration: 400 });
  }, [center.lng, center.lat]);

  // Render markers.
  useEffect(() => {
    markerRefs.current.forEach((mk) => mk.remove());
    markerRefs.current = [];
    if (!map.current) return;
    for (const mk of markers) {
      const el = document.createElement("div");
      el.style.width = "20px";
      el.style.height = "20px";
      el.style.borderRadius = "9999px";
      el.style.background = mk.color;
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.4)";
      if (mk.label) el.title = mk.label;
      const marker = new maplibregl.Marker({ element: el }).setLngLat([mk.lng, mk.lat]).addTo(map.current);
      markerRefs.current.push(marker);
    }
  }, [markers]);

  return (
    <div className={className} style={{ position: "relative" }}>
      <div ref={container} style={{ position: "absolute", inset: 0, borderRadius: "inherit" }} />
      {onPick ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 24,
            height: 24,
            marginLeft: -12,
            marginTop: -24,
            pointerEvents: "none",
          }}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="#D4183D" stroke="white" strokeWidth="1.5">
            <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" />
          </svg>
        </div>
      ) : null}
    </div>
  );
}
