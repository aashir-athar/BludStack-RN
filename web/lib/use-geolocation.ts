"use client";

import { useEffect, useState } from "react";

export interface Coords {
  latitude: number;
  longitude: number;
}

// Best-effort browser geolocation. Never blocks the UI: returns null until (or
// unless) the user grants permission. Mirrors the app's location-optional feeds.
export function useGeolocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let active = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (active) setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      () => {
        if (active) setDenied(true);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
    return () => {
      active = false;
    };
  }, []);

  return { coords, denied };
}
