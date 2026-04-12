// hooks/useLocation.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';

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

export function useLocation(autoStart = false): UseLocationReturn {
  const { user } = useAuth();
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    const granted = status === 'granted';
    setPermissionGranted(granted);
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
      // silence — address is non-critical
    }
  }, []);

  const updateLocationInDB = useCallback(async (lat: number, lon: number) => {
    if (!user?.id) return;
    await supabase
      .from('profiles')
      .update({ latitude: lat, longitude: lon })
      .eq('id', user.id);
  }, [user]);

  const refreshLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const granted = await requestPermission();
        if (!granted) {
          setError('Location permission denied');
          return;
        }
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const coords = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? undefined,
      };
      setLocation(coords);
      setPermissionGranted(true);
      await Promise.all([
        reverseGeocode(coords.latitude, coords.longitude),
        updateLocationInDB(coords.latitude, coords.longitude),
      ]);
    } catch (e: any) {
      setError(e.message ?? 'Failed to get location');
    } finally {
      setLoading(false);
    }
  }, [requestPermission, reverseGeocode, updateLocationInDB]);

  useEffect(() => {
    if (!autoStart) return;
    refreshLocation();
    return () => {
      watchRef.current?.remove();
    };
  }, [autoStart, refreshLocation]);

  return { location, address, permissionGranted, loading, error, requestPermission, refreshLocation };
}
