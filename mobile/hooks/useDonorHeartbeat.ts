// hooks/useDonorHeartbeat.ts
// Push the donor's live GPS to /donations/heartbeat while they're en-route to
// the hospital. The recipient subscribes to realtime UPDATEs on
// request_responses and renders a moving pin on /map/live.
//
// Foreground-only — when the donor backgrounds the app the watcher stops.
// This matches Uber's actual "driver" UX (you keep the app open while
// driving). Background-location is opt-in via a system permission prompt
// and adds complexity / battery cost we don't justify yet.
//
// Heartbeat policy:
//   • Push every 30 seconds OR every 50 metres of movement, whichever first.
//   • Stop on unmount, on hook-disabled, or on a server 400/404 (donor no
//     longer accepted on this request).

import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { apiDonationHeartbeat } from '@/utils/api';
import { errorReporter } from '@/lib/errorReporter';

const HEARTBEAT_MIN_GAP_MS    = 30_000;
const HEARTBEAT_MIN_DELTA_M   = 50;
const LOCATION_TIME_INTERVAL  = 15_000; // watcher firing interval
const LOCATION_DISTANCE_DELTA = 25;

function metresBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function useDonorHeartbeat(requestId: string | undefined, enabled: boolean) {
  const subRef         = useRef<Location.LocationSubscription | null>(null);
  const lastPushAtRef  = useRef<number>(0);
  const lastCoordsRef  = useRef<{ latitude: number; longitude: number } | null>(null);
  const fatalErrorRef  = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled || !requestId) return;
    fatalErrorRef.current = false;

    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        if (req.status !== 'granted') return;
      }

      subRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: LOCATION_TIME_INTERVAL,
          distanceInterval: LOCATION_DISTANCE_DELTA,
        },
        async (pos) => {
          if (fatalErrorRef.current) return;
          const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          const now = Date.now();
          const last = lastCoordsRef.current;
          const movedEnough = !last || metresBetween(last, coords) >= HEARTBEAT_MIN_DELTA_M;
          const cooledDown  = now - lastPushAtRef.current >= HEARTBEAT_MIN_GAP_MS;
          if (!movedEnough && !cooledDown) return;

          try {
            await apiDonationHeartbeat(requestId, coords.latitude, coords.longitude);
            lastPushAtRef.current = now;
            lastCoordsRef.current = coords;
          } catch (e: any) {
            // 400/404 means the donor no longer accepts this request — stop.
            const status = e?.status as number | undefined;
            if (status === 400 || status === 404) {
              fatalErrorRef.current = true;
              subRef.current?.remove();
              subRef.current = null;
              return;
            }
            errorReporter.warn('Heartbeat failed', { requestId, message: e?.message });
          }
        },
      );
    })();

    return () => {
      subRef.current?.remove();
      subRef.current = null;
      lastPushAtRef.current = 0;
      lastCoordsRef.current = null;
    };
  }, [requestId, enabled]);
}
