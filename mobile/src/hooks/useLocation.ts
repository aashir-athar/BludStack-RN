// hooks/useLocation.ts
// ─────────────────────────────────────────────────────────────────────────────
// Fixes flaw #13: every refreshLocation() used to write to the DB unconditionally.
// Now:
//   • Writes go through the backend (consistent with the rest of the app)
//   • Writes are throttled — at most one write per LOCATION_WRITE_MIN_GAP_MS
//   • Writes only fire if the user has moved more than LOCATION_MIN_DELTA_M
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import { useAuth } from '@/contexts/AuthContext';
import { apiUpdateLocation } from '@/utils/api';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface UseLocationReturn {
  location: LocationCoords | null;
  address: string | null;
  permissionGranted: boolean;
  loading: boolean;
  error: string | null;
  requestPermission: () => Promise<boolean>;
  refreshLocation: () => Promise<void>;
}

const LOCATION_WRITE_MIN_GAP_MS = 60_000;  // 1 minute
const LOCATION_MIN_DELTA_M      = 100;     // 100 metres

function metresBetween(a: LocationCoords, b: LocationCoords): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function useLocation(autoStart = false): UseLocationReturn {
  const { user } = useAuth();
  const [location, setLocation]           = useState<LocationCoords | null>(null);
  const [address, setAddress]             = useState<string | null>(null);
  const [permissionGranted, setGranted]   = useState(false);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  const lastWriteAtRef = useRef<number>(0);
  const lastWroteRef   = useRef<LocationCoords | null>(null);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    const granted = status === 'granted';
    setGranted(granted);
    return granted;
  }, []);

  const reverseGeocode = useCallback(async (lat: number, lon: number) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      if (results.length > 0) {
        const r = results[0];
        const parts = [r.street, r.district, r.city, r.region].filter(Boolean);
        setAddress(parts.join(', '));
      }
    } catch {
      // address is non-critical
    }
  }, []);

  const maybeWriteLocation = useCallback(async (coords: LocationCoords) => {
    if (!user?.id) return;
    const now = Date.now();
    const last = lastWroteRef.current;
    const movedEnough = !last || metresBetween(last, coords) >= LOCATION_MIN_DELTA_M;
    const cooledDown  = now - lastWriteAtRef.current >= LOCATION_WRITE_MIN_GAP_MS;
    if (!movedEnough && !cooledDown) return;

    try {
      await apiUpdateLocation(coords.latitude, coords.longitude);
      lastWriteAtRef.current = now;
      lastWroteRef.current   = coords;
    } catch {
      // server may be down — keep last-known state, don't error to user
    }
  }, [user?.id]);

  const refreshLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const granted = await requestPermission();
        if (!granted) { setError('Location permission denied'); return; }
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords: LocationCoords = {
        latitude:  pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy:  pos.coords.accuracy ?? undefined,
      };
      setLocation(coords);
      setGranted(true);
      await Promise.all([
        reverseGeocode(coords.latitude, coords.longitude),
        maybeWriteLocation(coords),
      ]);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to get location');
    } finally {
      setLoading(false);
    }
  }, [requestPermission, reverseGeocode, maybeWriteLocation]);

  useEffect(() => {
    if (!autoStart) return;
    refreshLocation();
  }, [autoStart, refreshLocation]);

  return { location, address, permissionGranted, loading, error, requestPermission, refreshLocation };
}
