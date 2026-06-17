// hooks/useDonorHeartbeat.ts
// ─────────────────────────────────────────────────────────────────────────────
// A donor who accepted a request shares their live position with the recipient
// until they arrive. This is the hardest reliability problem in the app: the
// donor is driving, the screen is off, the OS wants to reclaim the process.
//
// expo-persistent-background-location solves the survival half - a `location`-
// typed foreground service on Android (survives swipe-to-kill) and significant-
// location-change monitoring on iOS (resumes after force-quit). We own the
// delivery half: each fix is POSTed to /donations/heartbeat under the donor's
// Supabase identity, which writes request_responses.donor_lat/lon. The recipient
// subscribes to realtime UPDATEs and renders a moving pin on /map/live.
//
// The native module's own `syncUrl` can't carry our rotating Bearer token or
// match the endpoint's body contract, so JS drives the writes while the native
// service keeps the fixes flowing even when the runtime is backgrounded.
//
// Lever: commitment + consistency. Once a donor says "I'm coming," a moving dot
// on the recipient's screen is the proof that holds them to it.
//
// Graceful degradation: in Expo Go (no native module) we fall back to
// expo-location foreground watching, so the donor still shares a position while
// the app is open, just without the kill-survival guarantee.
//
// Heartbeat policy: push every 30s OR every 50m of movement, whichever first,
// to stay well under the backend rate limiter and easy on the battery. Stop on
// unmount, on disable, or on a terminal 400/404/409 (donor no longer accepted).
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable react-hooks/set-state-in-effect -- this hook syncs an imperative
   external system (the GPS / native foreground service) into React state: the
   effect brings up tracking and updates status/coords as fixes arrive. That is a
   subscription, not a render cascade. */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { apiDonationHeartbeat, isApiError } from '@/utils/api';
import { errorReporter } from '@/lib/errorReporter';

export interface HeartbeatCoords {
  latitude: number;
  longitude: number;
}

export type HeartbeatStatus = 'idle' | 'requesting' | 'tracking' | 'denied' | 'stopped';

interface UseDonorHeartbeatReturn {
  coords: HeartbeatCoords | null;
  status: HeartbeatStatus;
  /** True while a native foreground service / fallback watcher is delivering fixes. */
  tracking: boolean;
}

const HEARTBEAT_MIN_GAP_MS  = 30_000;
const HEARTBEAT_MIN_DELTA_M = 50;
const WATCH_TIME_INTERVAL   = 15_000;
const WATCH_DISTANCE_DELTA  = 25;

function metresBetween(a: HeartbeatCoords, b: HeartbeatCoords): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// The persistent module is native - absent in Expo Go. Resolve it lazily so
// importing this hook never crashes the bundle on a client that lacks the build.
type BgModule = typeof import('expo-persistent-background-location');
function loadBgModule(): BgModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-persistent-background-location') as BgModule;
  } catch {
    return null;
  }
}

const FOREGROUND_NOTIFICATION = {
  notificationTitle: 'Sharing your live location',
  notificationBody: 'The recipient can see you on the way. Tap to return.',
  notificationChannelId: 'bludstack_live_location',
  notificationChannelName: 'Live location sharing',
  notificationColor: '#E5314F', // crimson500 - keeps the service notification on-brand
} as const;

/**
 * @param requestId  The request being fulfilled.
 * @param enabled    Drive tracking on/off (donor role, donation still accepted).
 */
export function useDonorHeartbeat(
  requestId: string | undefined,
  enabled: boolean,
): UseDonorHeartbeatReturn {
  const [coords, setCoords] = useState<HeartbeatCoords | null>(null);
  const [status, setStatus] = useState<HeartbeatStatus>('idle');

  // Throttle/terminal bookkeeping. Touched only inside callbacks and effects,
  // never read during render.
  const lastPushAtRef = useRef(0);
  const lastCoordsRef = useRef<HeartbeatCoords | null>(null);
  const stoppedRef    = useRef(false);

  // Throttled push to the backend - the source of truth for the recipient's
  // live pin. A terminal 400/404/409 means the donation is no longer accepted:
  // stand down for good.
  const pushFix = useCallback(async (c: HeartbeatCoords) => {
    if (!requestId || stoppedRef.current) return;

    const now  = Date.now();
    const last = lastCoordsRef.current;
    const movedEnough = !last || metresBetween(last, c) >= HEARTBEAT_MIN_DELTA_M;
    const cooledDown  = now - lastPushAtRef.current >= HEARTBEAT_MIN_GAP_MS;
    if (!movedEnough && !cooledDown) return;

    try {
      await apiDonationHeartbeat(requestId, c.latitude, c.longitude);
      lastPushAtRef.current = now;
      lastCoordsRef.current = c;
    } catch (err) {
      if (isApiError(err) && (err.status === 400 || err.status === 404 || err.status === 409)) {
        stoppedRef.current = true;
        setStatus('stopped');
        return;
      }
      // Transient (offline / 5xx) - the next fix retries; native buffer holds
      // positions while the runtime is gone.
      errorReporter.warn('Heartbeat failed', {
        requestId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [requestId]);

  useEffect(() => {
    if (!enabled || !requestId) {
      setStatus('idle');
      return;
    }

    stoppedRef.current   = false;
    lastPushAtRef.current = 0;
    lastCoordsRef.current = null;
    let disposed = false;
    const bg = loadBgModule();
    // EventSubscription | Location.LocationSubscription - both expose remove().
    let subscription: { remove: () => void } | null = null;

    const onFix = (c: HeartbeatCoords) => {
      if (disposed || stoppedRef.current) return;
      setCoords(c);
      setStatus('tracking');
      void pushFix(c);
    };

    setStatus('requesting');

    // Keepalive: a stationary donor stops producing new fixes (the native
    // tracker only delivers on movement), which would freeze the recipient's pin
    // and let the backend treat the session as stale. Re-push the last known fix
    // on the heartbeat cadence; pushFix's own throttle drops it whenever a real
    // fix already covered the window, so this never double-sends.
    const keepalive = setInterval(() => {
      const c = lastCoordsRef.current;
      if (c && !disposed && !stoppedRef.current) void pushFix(c);
    }, HEARTBEAT_MIN_GAP_MS);

    (async () => {
      // ── Native, kill-surviving path ──────────────────────────────────────
      if (bg) {
        try {
          const perm = await bg.requestPermissions({ background: true });
          if (disposed) return;
          if (perm.foreground !== 'granted') {
            setStatus('denied');
            return;
          }

          subscription = bg.onLocation((fix) => onFix({ latitude: fix.latitude, longitude: fix.longitude }));

          await bg.start({
            accuracy: 'high',
            distanceFilter: WATCH_DISTANCE_DELTA, // metres - granular enough for an ETA, gentle on battery
            interval: WATCH_TIME_INTERVAL,
            stopOnTerminate: false,   // survive swipe-to-kill (the whole point)
            restartOnBoot: true,
            useSignificantChanges: true,
            showsBackgroundLocationIndicator: true,
            activityType: 'automotiveNavigation',
            foregroundService: FOREGROUND_NOTIFICATION,
          });
          if (disposed) return;

          // Seed an immediate fix so the recipient sees the dot without waiting
          // for the first interval tick.
          try {
            const first = await bg.getCurrentPosition({ accuracy: 'high' });
            if (!disposed) onFix({ latitude: first.latitude, longitude: first.longitude });
          } catch {
            // first fix is best-effort; the listener delivers shortly
          }
          return;
        } catch (err) {
          errorReporter.warn('bg-location start failed, using foreground fallback', {
            message: err instanceof Error ? err.message : String(err),
          });
          // fall through to the expo-location fallback
        }
      }

      // ── Foreground fallback (Expo Go / native start failed) ──────────────
      const { status: fg } = await Location.requestForegroundPermissionsAsync();
      if (disposed) return;
      if (fg !== 'granted') {
        setStatus('denied');
        return;
      }
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: WATCH_TIME_INTERVAL, distanceInterval: WATCH_DISTANCE_DELTA },
        (pos) => onFix({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      );
      if (disposed) subscription.remove();
    })();

    return () => {
      disposed = true;
      clearInterval(keepalive);
      subscription?.remove();
      subscription = null;
      // Tear down the foreground service so the notification clears the instant
      // the donor leaves the screen / the donation closes. Cleanup is the game.
      if (bg) void bg.stop().catch(() => {});
    };
  }, [requestId, enabled, pushFix]);

  return { coords, status, tracking: status === 'tracking' };
}
