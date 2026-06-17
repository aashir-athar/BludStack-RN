// app/map/live.tsx
// ─────────────────────────────────────────────────────────────────────────────
// The live map closes the loop between a donor who said "I'm coming" and a
// recipient counting the minutes. Two roles share one screen:
//
//   • donor     - useDonorHeartbeat streams their position to the backend
//                 (persistent foreground service, survives swipe-to-kill), and
//                 a dashed route line points them at the hospital.
//   • recipient - subscribes to realtime UPDATEs on request_responses and
//                 watches each accepted donor's pin move in real time.
//
// Lever: goal gradient. A visibly shrinking distance and a moving dot make the
// help feel imminent, which is exactly when people hold on instead of giving up.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Map as MapLibreMap,
  Camera,
  type CameraRef,
  Marker,
  UserLocation,
  GeoJSONSource,
  Layer,
} from '@maplibre/maplibre-react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme, useIsDark } from '@/stores/themeStore';
import { useToast } from '@/stores/toastStore';
import { useDonorHeartbeat } from '@/hooks/useDonorHeartbeat';
import { supabase } from '@/utils/supabase';
import { getMapStyleJSON, zoomFromRadiusKm } from '@/utils/mapStyles';
import { haversineDistance, formatDistance, estimateDriveMinutes } from '@/utils/geo';
import { Spacing, Radius } from '@/constants/Typography';
import { Text, Button } from '@/ui';

interface DonorPin {
  id: string;
  latitude: number;
  longitude: number;
  full_name: string;
  blood_group: string;
}

interface LatLng {
  latitude: number;
  longitude: number;
}

const DEFAULT_CENTER: LatLng = { latitude: 31.5204, longitude: 74.3587 }; // Lahore

export default function LiveMapScreen() {
  const { requestId, role } = useLocalSearchParams<{ requestId: string; role: 'donor' | 'recipient' }>();
  const theme = useAppTheme();
  const isDark = useIsDark();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const cameraRef = useRef<CameraRef | null>(null);

  const isDonor = role === 'donor';

  const [hospital, setHospital] = useState<{ latitude: number; longitude: number; name: string } | null>(null);
  const [donors, setDonors] = useState<DonorPin[]>([]);

  // Donor role: the persistent-background heartbeat both streams our position to
  // the backend and hands us our own coordinates for the route line + the pin.
  const { coords: donorCoords, status: hbStatus, tracking } = useDonorHeartbeat(requestId, isDonor);

  // Surface a denied-permission state once, without nagging.
  const deniedToldRef = useRef(false);
  useEffect(() => {
    if (isDonor && hbStatus === 'denied' && !deniedToldRef.current) {
      deniedToldRef.current = true;
      toast.error('Location is off', { description: 'Turn it on so the recipient can see you on the way.' });
    }
    // Re-arm once tracking resumes, so a later denial is surfaced again.
    if (hbStatus === 'tracking') deniedToldRef.current = false;
  }, [isDonor, hbStatus, toast]);

  // ── Hospital (request) location ────────────────────────────────────────────
  useEffect(() => {
    if (!requestId) return;
    let cancelled = false;
    supabase
      .from('blood_requests')
      .select('latitude, longitude, hospital_name')
      .eq('id', requestId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setHospital({ latitude: data.latitude, longitude: data.longitude, name: data.hospital_name });
      });
    return () => { cancelled = true; };
  }, [requestId]);

  // ── Recipient role: accepted donors' live pins ─────────────────────────────
  const loadDonors = useCallback(async () => {
    if (!requestId || isDonor) return;
    const { data } = await supabase
      .from('request_responses')
      .select('donor_id, donor_lat, donor_lon, donor:profiles!donor_id ( id, full_name, blood_group )')
      .eq('request_id', requestId)
      .eq('status', 'accepted');

    type Row = {
      donor_lat: number | null;
      donor_lon: number | null;
      // PostgREST returns an embedded one-to-one relation as an object, but the
      // generated type widens it to an array - normalise both shapes.
      donor: { id: string; full_name: string; blood_group: string } | { id: string; full_name: string; blood_group: string }[] | null;
    };
    const pins: DonorPin[] = ((data ?? []) as unknown as Row[])
      .map((r): DonorPin | null => {
        const d = Array.isArray(r.donor) ? r.donor[0] : r.donor;
        const lat = r.donor_lat;
        const lon = r.donor_lon;
        if (!d || lat == null || lon == null) return null;
        return { id: d.id, latitude: lat, longitude: lon, full_name: d.full_name, blood_group: d.blood_group };
      })
      .filter((p): p is DonorPin => p !== null);
    setDonors(pins);
  }, [requestId, isDonor]);

  useEffect(() => {
    if (isDonor || !requestId) return;
    // Realtime data sync: seed the donor pins once, then keep them current from
    // the subscription below. Not a render cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDonors();
    const channel = supabase
      .channel(`live_${requestId}`)
      // event '*' (not just UPDATE): a donor who accepts after the map is open
      // arrives as an INSERT, and only re-running loadDonors paints their pin.
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'request_responses', filter: `request_id=eq.${requestId}` },
        () => void loadDonors())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isDonor, requestId, loadDonors]);

  // ── Fit the camera to everything worth seeing ──────────────────────────────
  const fitToMarkers = useCallback(() => {
    const points = [donorCoords, hospital, ...donors].filter(Boolean) as LatLng[];
    if (!cameraRef.current || points.length < 2) return;
    const lats = points.map((p) => p.latitude);
    const lons = points.map((p) => p.longitude);
    cameraRef.current.fitBounds(
      [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)],
      { padding: { top: 96, right: 48, bottom: 220, left: 48 }, duration: 600 },
    );
  }, [donorCoords, hospital, donors]);

  const distanceKm = useMemo(() => {
    if (!donorCoords || !hospital) return null;
    return haversineDistance(donorCoords.latitude, donorCoords.longitude, hospital.latitude, hospital.longitude);
  }, [donorCoords, hospital]);

  const center = donorCoords ?? hospital ?? DEFAULT_CENTER;

  const openExternalMaps = useCallback(() => {
    if (!hospital) return;
    void Haptics.selectionAsync();
    void Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${hospital.latitude},${hospital.longitude}&travelmode=driving`,
    );
  }, [hospital]);

  const onClose = useCallback(() => {
    void Haptics.selectionAsync();
    router.back();
  }, [router]);

  const onFit = useCallback(() => {
    void Haptics.selectionAsync();
    fitToMarkers();
  }, [fitToMarkers]);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* Top overlay */}
      <View style={[styles.topOverlay, { paddingTop: insets.top + Spacing[2] }]}>
        <View style={[styles.topCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close live map"
            style={[styles.iconBtn, { backgroundColor: theme.pillBg }]}
          >
            <Ionicons name="close" size={20} color={theme.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <View style={styles.liveRow}>
              <LiveDot color={theme.primary} active={isDonor ? tracking : donors.length > 0} />
              <Text variant="overline" tone="brand">{isDonor ? 'Sharing your location' : 'Live tracking'}</Text>
            </View>
            <Text variant="titleSm" numberOfLines={1}>{hospital?.name ?? 'Locating hospital...'}</Text>
          </View>
          <Pressable
            onPress={onFit}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Fit map to everyone"
            style={[styles.iconBtn, { backgroundColor: theme.pillBg }]}
          >
            <Ionicons name="scan-outline" size={18} color={theme.textPrimary} />
          </Pressable>
        </View>
      </View>

      {/* Map */}
      <MapLibreMap style={{ width, height }} mapStyle={getMapStyleJSON(isDark)}>
        <Camera
          ref={cameraRef}
          initialViewState={{ center: [center.longitude, center.latitude], zoom: zoomFromRadiusKm(8) }}
        />
        <UserLocation animated />

        {hospital ? (
          <Marker lngLat={[hospital.longitude, hospital.latitude]} anchor="bottom">
            <View style={styles.hospitalPin}>
              <View style={[styles.hospitalPinBody, { backgroundColor: theme.primary, borderColor: theme.textOnPrimary }]}>
                <Ionicons name="medical" size={18} color={theme.textOnPrimary} />
              </View>
              <View style={[styles.pinStem, { backgroundColor: theme.primary }]} />
            </View>
          </Marker>
        ) : null}

        {/* Recipient view: every accepted donor */}
        {donors.map((d) => (
          <Marker key={d.id} lngLat={[d.longitude, d.latitude]} anchor="center">
            <View style={[styles.donorPin, { backgroundColor: theme.primary, borderColor: theme.textOnPrimary }]}>
              <Ionicons name="water" size={15} color={theme.textOnPrimary} />
            </View>
          </Marker>
        ))}

        {/* Donor view: dashed route line to the hospital */}
        {isDonor && donorCoords && hospital ? (
          <GeoJSONSource
            id="route-src"
            data={{
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: [
                  [donorCoords.longitude, donorCoords.latitude],
                  [hospital.longitude, hospital.latitude],
                ],
              },
            }}
          >
            <Layer
              id="route-line"
              type="line"
              source="route-src"
              paint={{ 'line-color': theme.primary, 'line-width': 2.5, 'line-dasharray': [3, 2] }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </GeoJSONSource>
        ) : null}
      </MapLibreMap>

      {/* Bottom panel */}
      <View
        style={[
          styles.bottomPanel,
          { backgroundColor: theme.surface, borderTopColor: theme.border, paddingBottom: insets.bottom + Spacing[4] },
        ]}
      >
        <View style={styles.statsRow}>
          <Stat label="Distance" value={distanceKm !== null ? formatDistance(distanceKm) : '--'} color={theme.primary} />
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <Stat
            label="Est. drive"
            value={distanceKm !== null ? `${estimateDriveMinutes(distanceKm)} min` : '--'}
            color={theme.primary}
          />
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <Stat
            label={isDonor ? 'Tracking' : 'Donors'}
            value={isDonor ? (tracking ? 'Live' : 'Off') : String(donors.length)}
            color={isDonor ? (tracking ? theme.success : theme.textMuted) : theme.primary}
          />
        </View>

        {!isDonor && donors.length > 0 ? (
          <View style={[styles.enRouteRow, { borderTopColor: theme.border }]}>
            <Text variant="bodySm" tone="secondary">
              {donors.length === 1 ? '1 donor is on the way' : `${donors.length} donors are on the way`}
            </Text>
          </View>
        ) : null}

        {isDonor ? (
          <Button
            label="Open directions"
            variant="primary"
            size="lg"
            fullWidth
            icon="navigate"
            onPress={openExternalMaps}
            disabled={!hospital}
            accessibilityLabel="Open turn-by-turn directions"
          />
        ) : null}
      </View>
    </View>
  );
}

// A soft pulsing dot - the universal "this is live" tell. Honors reduced motion
// by holding a steady dot instead of animating.
function LiveDot({ color, active }: { color: string; active: boolean }) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!active || reduced) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease), reduceMotion: ReduceMotion.System }),
      -1,
      false,
    );
  }, [active, reduced, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 1.8 }],
  }));

  return (
    <View style={styles.liveDotBox}>
      {active ? <Animated.View style={[styles.liveDotRing, { backgroundColor: color }, ringStyle]} /> : null}
      <View style={[styles.liveDotCore, { backgroundColor: active ? color : 'transparent', borderColor: color }]} />
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.statItem}>
      <Text variant="title" style={{ color, fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text variant="caption" tone="muted">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: Spacing[4] },
  topCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[3], borderRadius: Radius.xl, borderCurve: 'continuous', borderWidth: 1,
  },
  iconBtn: { width: 40, height: 40, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  liveDotBox: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  liveDotRing: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  liveDotCore: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
  hospitalPin: { alignItems: 'center' },
  hospitalPinBody: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
  },
  pinStem: { width: 3, height: 8, marginTop: -1, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  donorPin: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
  },
  bottomPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: Radius['2xl'], borderTopRightRadius: Radius['2xl'], borderCurve: 'continuous',
    paddingTop: Spacing[5], paddingHorizontal: Spacing[5], gap: Spacing[4],
  },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  statItem: { alignItems: 'center', flex: 1, gap: 2 },
  statDivider: { width: 1, height: 32 },
  enRouteRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing[3], alignItems: 'center' },
});
