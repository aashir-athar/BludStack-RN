// app/(tabs)/request.tsx
// Lever: DECIDE -> VERIFY -> ACT. Uber's ride-request pattern, blood-app remix.
//
//   DECIDE  Map dominates ~55% — oversized hospital pin + pulsing crimson
//           dots showing compatible available donors near the pin. Motion =
//           perceived availability. Live donor-count badge in the corner.
//
//   VERIFY  Bottom sheet rises with spring on mount (peak-end on entry).
//           Crimson accent strip above the handle for brand presence.
//           Route summary bar (your location -> hospital) with the actual
//           reverse-geocoded address so the user catches wrong pins before
//           committing. Horizontal urgency carousel — cards spring-scale on
//           select. 2x4 blood group grid (tap-friendly Fitts's Law). Compact
//           units stepper with a visible dot row. Preview card showing what
//           a donor will see — last sanity check before commit (verification
//           reduces post-booking cancellations).
//
//   ACT     Sticky full-width pill above the tab bar, label mirrors urgency
//           tier ("Post critical request"). When urgency is critical the
//           button breathes — subtle loss-aversion via motion. Haptic
//           medium-impact on tap. Always one tap away.
//
// Role-aware: only renders for recipients and 'both'. Donor-only users
// never see this tab.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle, useSharedValue, withRepeat, withTiming, withSpring,
  withSequence, interpolate, Easing, runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/hooks/useLocation';
import { useMyRequests } from '@/hooks/useRequests';
import { useToast } from '@/contexts/ToastContext';
import Button from '@/components/Button';
import Input from '@/components/Input';
import BloodGroupBadge from '@/components/BloodGroupBadge';
import {
  BLOOD_GROUPS, URGENCY_LEVELS, type BloodGroup, type UrgencyLevel,
} from '@/constants/BloodData';
import {
  FontSize, FontWeight, LetterSpacing, Spacing, Radius, Elevation, Motion,
  TAB_BAR_HEIGHT,
} from '@/constants/Typography';
import { deltaFromKm, formatDistance } from '@/utils/geo';
import { apiNearbyDonors } from '@/utils/api';
import { errorReporter } from '@/lib/errorReporter';

// ────────────────────────────────────────────────────────────────────────────
// Urgency meta — drives carousel cards, copy, and the dynamic CTA label.
// ────────────────────────────────────────────────────────────────────────────
const URGENCY_META: Record<UrgencyLevel, {
  label: string;
  windowLabel: string;
  sub: string;
  iconName: keyof typeof Ionicons.glyphMap;
}> = {
  critical: { label: 'Critical', windowLabel: 'in 30 min', sub: 'Alarm-tone alert · bypasses silent mode', iconName: 'flash'            },
  urgent:   { label: 'Urgent',   windowLabel: 'in 2 hrs',  sub: 'Heads-up notification, no alarm',         iconName: 'time'             },
  standard: { label: 'Standard', windowLabel: 'today',     sub: 'Standard notification',                   iconName: 'calendar-outline' },
};

// ────────────────────────────────────────────────────────────────────────────
// Pulsing-dot for live donors — Reanimated worklet, UI thread, 120fps-safe.
// ────────────────────────────────────────────────────────────────────────────
const PulseDot = React.memo(function PulseDot({ color }: { color: string }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
      -1, false,
    );
  }, [progress]);
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.6, 2.4]) }],
    opacity:   interpolate(progress.value, [0, 0.6, 1], [0.45, 0.2, 0]),
  }));
  return (
    <View style={pulseStyles.wrap}>
      <Animated.View style={[pulseStyles.ring, { backgroundColor: color }, ringStyle]} />
      <View style={[pulseStyles.dot, { backgroundColor: color }]} />
    </View>
  );
});
const pulseStyles = StyleSheet.create({
  wrap: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 24, height: 24, borderRadius: 12 },
  dot:  { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: '#FFFFFF' },
});

// ────────────────────────────────────────────────────────────────────────────
// Tactile urgency card — scales 1.04× on select with spring physics.
// ────────────────────────────────────────────────────────────────────────────
const UrgencyCard = React.memo(function UrgencyCard({
  level, selected, onPress, theme,
}: {
  level: UrgencyLevel; selected: boolean; onPress: () => void; theme: any;
}) {
  const scale = useSharedValue(selected ? 1.04 : 1);
  useEffect(() => {
    scale.value = withSpring(selected ? 1.04 : 1, Motion.spring.snappy);
  }, [selected, scale]);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const meta = URGENCY_META[level];
  const bg   = selected ? theme.primary       : theme.cardElevated;
  const fg   = selected ? theme.textOnPrimary : theme.textPrimary;
  const sub  = selected ? theme.textOnPrimary : theme.textMuted;

  return (
    <Animated.View style={aStyle}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onPress();
        }}
        style={[
          urgencyStyles.card,
          { backgroundColor: bg, borderColor: selected ? theme.primary : theme.border },
          selected && Elevation.sm,
        ]}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${meta.label} urgency, ${meta.windowLabel}`}
      >
        <View
          style={[
            urgencyStyles.iconWrap,
            { backgroundColor: selected ? 'rgba(255,255,255,0.18)' : theme.surface },
          ]}
        >
          <Ionicons name={meta.iconName} size={18} color={fg} />
        </View>
        <Text style={[urgencyStyles.label, { color: fg }]}>{meta.label}</Text>
        <Text style={[urgencyStyles.window, { color: sub }]}>{meta.windowLabel}</Text>
      </Pressable>
    </Animated.View>
  );
});
const urgencyStyles = StyleSheet.create({
  card: {
    width: 132,
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[3],
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    alignItems: 'flex-start',
    gap: Spacing[2],
    marginRight: Spacing[3],
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  label:  { fontSize: FontSize.base, fontWeight: FontWeight.black,    letterSpacing: LetterSpacing.snug },
  window: { fontSize: FontSize.xs,   fontWeight: FontWeight.semibold, letterSpacing: LetterSpacing.snug },
});

// ────────────────────────────────────────────────────────────────────────────
// Smooth count-up label — animates the live-donor count when it changes.
// ────────────────────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 600) {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const tweenRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    const steps = Math.min(Math.abs(target - from), 30);
    const stepMs = Math.max(16, duration / Math.max(steps, 1));
    let i = 0;
    if (tweenRef.current) clearInterval(tweenRef.current);
    tweenRef.current = setInterval(() => {
      i++;
      const ratio = i / steps;
      const v = Math.round(from + (target - from) * ratio);
      setDisplay(v);
      if (i >= steps) {
        if (tweenRef.current) clearInterval(tweenRef.current);
        fromRef.current = target;
      }
    }, stepMs);
    return () => { if (tweenRef.current) clearInterval(tweenRef.current); };
  }, [target, duration]);
  return display;
}

// ────────────────────────────────────────────────────────────────────────────
// Breathing wrapper for the CTA when urgency is critical (loss-aversion motion)
// ────────────────────────────────────────────────────────────────────────────
const BreathingWrapper = React.memo(function BreathingWrapper({
  enabled, children,
}: { enabled: boolean; children: React.ReactNode }) {
  const breath = useSharedValue(1);
  useEffect(() => {
    if (enabled) {
      breath.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.00, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, false,
      );
    } else {
      breath.value = withTiming(1, { duration: Motion.duration.fast });
    }
  }, [enabled, breath]);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: breath.value }] }));
  return <Animated.View style={aStyle}>{children}</Animated.View>;
});

// ────────────────────────────────────────────────────────────────────────────
// Bottom-sheet entrance — slides up with spring on mount.
// ────────────────────────────────────────────────────────────────────────────
function useSheetEntrance() {
  const offset  = useSharedValue(60);
  const opacity = useSharedValue(0);
  useEffect(() => {
    offset.value  = withSpring(0, Motion.spring.soft);
    opacity.value = withTiming(1, { duration: Motion.duration.base });
  }, [offset, opacity]);
  return useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
    opacity:   opacity.value,
  }));
}

// ────────────────────────────────────────────────────────────────────────────
// Helper — friendly relative-distance string for the live badge.
// ────────────────────────────────────────────────────────────────────────────
function distanceWord(count: number, avgKm: number | null): string {
  if (count === 0) return 'Searching…';
  if (avgKm == null || !isFinite(avgKm)) return `${count} ready`;
  return `${count} within ${formatDistance(avgKm)}`;
}

// ────────────────────────────────────────────────────────────────────────────
// The screen
// ────────────────────────────────────────────────────────────────────────────
export default function RequestScreen() {
  const { theme, isDark } = useTheme();
  const { profile } = useAuth();
  const router  = useRouter();
  const toast   = useToast();
  const insets  = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const { location, refreshLocation } = useLocation(true);
  const { createRequest } = useMyRequests();

  // Form state
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>(
    (profile?.blood_group as BloodGroup) ?? 'O+',
  );
  const [urgency, setUrgency] = useState<UrgencyLevel>('urgent');
  const [units, setUnits]     = useState(1);
  const [hospital, setHospital] = useState('');
  const [hospAddr, setHospAddr] = useState('');
  const [notes, setNotes]       = useState('');
  const [loading, setLoading]   = useState(false);

  // Pin + reverse geocoding
  const mapRef = useRef<MapView | null>(null);
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);

  // Live donor data
  const [nearbyDonors, setNearbyDonors] = useState<Array<{ id: string; lat: number; lon: number; distanceKm: number }>>([]);
  const donorCount = nearbyDonors.length;
  const animatedDonorCount = useCountUp(donorCount);
  const avgDonorKm = useMemo(() => {
    if (donorCount === 0) return null;
    return nearbyDonors.reduce((s, d) => s + (d.distanceKm ?? 0), 0) / donorCount;
  }, [nearbyDonors, donorCount]);

  // Center map on user once we have their location
  useEffect(() => {
    if (location && !pin) {
      setPin({ latitude: location.latitude, longitude: location.longitude });
    }
  }, [location, pin]);

  // Reverse-geocode the user's location once (for the route bar's "from" line)
  useEffect(() => {
    if (!location || userAddress) return;
    let cancelled = false;
    (async () => {
      try {
        const results = await Location.reverseGeocodeAsync(location);
        if (cancelled) return;
        const r = results?.[0];
        if (r) {
          const parts = [r.district ?? r.subregion, r.city].filter(Boolean);
          setUserAddress(parts.join(', ') || 'Your current location');
        } else {
          setUserAddress('Your current location');
        }
      } catch { setUserAddress('Your current location'); }
    })();
    return () => { cancelled = true; };
  }, [location, userAddress]);

  // Reverse-geocode the pin → hospital address (auto-fill)
  useEffect(() => {
    if (!pin) return;
    let cancelled = false;
    (async () => {
      setGeoLoading(true);
      try {
        const results = await Location.reverseGeocodeAsync(pin);
        if (cancelled) return;
        const r = results?.[0];
        if (r) {
          const parts = [r.street, r.district, r.city, r.region].filter(Boolean);
          if (parts.length > 0) setHospAddr(parts.join(', '));
        }
      } catch { /* address is non-critical */ }
      finally { if (!cancelled) setGeoLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [pin?.latitude, pin?.longitude]);

  // Live donor query — distance only (privacy). Jitter for display.
  useEffect(() => {
    if (!pin) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await apiNearbyDonors({
          lat: pin.latitude, lon: pin.longitude, radiusKm: 25, bloodGroup,
        });
        if (cancelled) return;
        const donorsRaw = (resp?.donors ?? []) as Array<{ id: string; distanceKm: number }>;
        const dots = donorsRaw.slice(0, 8).map((d, idx) => {
          const angle = (idx / Math.max(donorsRaw.length, 1)) * 2 * Math.PI;
          const km    = Math.max(0.3, Math.min(d.distanceKm, 12));
          const dLat  = (km / 111) * Math.sin(angle);
          const dLon  = (km / (111 * Math.cos((pin.latitude * Math.PI) / 180))) * Math.cos(angle);
          return { id: d.id, lat: pin.latitude + dLat, lon: pin.longitude + dLon, distanceKm: d.distanceKm };
        });
        setNearbyDonors(dots);
      } catch (e: any) {
        errorReporter.warn('Could not fetch nearby donors for map', { msg: e?.message });
      }
    })();
    return () => { cancelled = true; };
  }, [pin?.latitude, pin?.longitude, bloodGroup]);

  // Map interactions
  const onMapPress = useCallback((e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    Haptics.selectionAsync().catch(() => {});
    setPin({ latitude, longitude });
  }, []);
  const onRecentre = useCallback(async () => {
    await refreshLocation();
    if (location && mapRef.current) {
      mapRef.current.animateToRegion(
        { latitude: location.latitude, longitude: location.longitude,
          latitudeDelta: deltaFromKm(1), longitudeDelta: deltaFromKm(1) },
        Motion.duration.base,
      );
      setPin({ latitude: location.latitude, longitude: location.longitude });
    }
  }, [refreshLocation, location]);

  // Submit
  const submit = useCallback(async () => {
    if (!pin) {
      toast.error('Pin the hospital location', { description: 'Tap the map to set where you need blood.' });
      return;
    }
    if (!hospital.trim()) { toast.error('Hospital name is required'); return; }
    if (!hospAddr.trim()) { toast.error('Hospital address is required'); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setLoading(true);
    try {
      const req: any = await createRequest({
        blood_group: bloodGroup, urgency, units_needed: units,
        hospital_name: hospital.trim(), hospital_address: hospAddr.trim(),
        latitude: pin.latitude, longitude: pin.longitude,
        notes: notes.trim() || undefined,
      });
      toast.success('Request posted', { description: 'Notifying compatible donors near the hospital.' });
      setHospital(''); setHospAddr(''); setNotes(''); setUnits(1);
      if (req?.id) router.push(`/request/${req.id}` as any);
    } catch (e: any) {
      errorReporter.error(e, { screen: 'tabs/request' });
      toast.error("Couldn't post the request", { description: e?.message ?? 'Try again.' });
    } finally { setLoading(false); }
  }, [pin, hospital, hospAddr, bloodGroup, urgency, units, notes, createRequest, toast, router]);

  // Initial region
  const initialRegion: Region | undefined = pin
    ? { ...pin, latitudeDelta: deltaFromKm(2), longitudeDelta: deltaFromKm(2) }
    : location
      ? { latitude: location.latitude, longitude: location.longitude,
          latitudeDelta: deltaFromKm(2), longitudeDelta: deltaFromKm(2) }
      : undefined;

  const submitDisabled = !pin || !hospital.trim() || !hospAddr.trim() || loading;
  const ctaLabel = useMemo(() => {
    if (urgency === 'critical') return 'Post critical request';
    if (urgency === 'urgent')   return 'Post urgent request';
    return 'Post request';
  }, [urgency]);
  // Accent color for the CTA dock summary row mirrors the urgency tier so the
  // user catches "critical = red" / "urgent = amber" before committing.
  const ctaAccent =
    urgency === 'critical' ? theme.danger
    : urgency === 'urgent'  ? theme.warning
    :                          theme.success;

  // Map height ~55% of viewport (Uber's ~60% spec, leaves enough for verify)
  const mapHeight = Math.max(280, Math.round(height * 0.55));

  // Sheet entrance animation
  const sheetEntrance = useSheetEntrance();

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ───────────────────────── MAP (DECIDE) ─────────────────────────── */}
      <View style={[styles.mapWrap, { height: mapHeight }]}>
        {initialRegion && (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_DEFAULT}
            userInterfaceStyle={isDark ? 'dark' : 'light'}
            initialRegion={initialRegion}
            onPress={onMapPress}
            onLongPress={onMapPress}
            showsUserLocation
            showsMyLocationButton={false}
          >
            {/* Pulsing donor dots — proof of liveness */}
            {nearbyDonors.map(d => (
              <Marker
                key={d.id}
                coordinate={{ latitude: d.lat, longitude: d.lon }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
              >
                <PulseDot color={theme.primary} />
              </Marker>
            ))}
            {/* Oversized hospital pin (Uber: ambiguity = cancellations) */}
            {pin && (
              <Marker
                coordinate={pin}
                draggable
                anchor={{ x: 0.5, y: 1 }}
                onDragEnd={e => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  Haptics.selectionAsync().catch(() => {});
                  setPin({ latitude, longitude });
                }}
              >
                <View style={[styles.bigPin, { backgroundColor: theme.primary, borderColor: theme.surface }]}>
                  <Ionicons name="medical" size={18} color={theme.textOnPrimary} />
                </View>
              </Marker>
            )}
          </MapView>
        )}

        {/* Top-right recenter pill */}
        <View pointerEvents="box-none" style={[styles.mapTop, { top: insets.top + Spacing[3] }]}>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={onRecentre}
            style={({ pressed }) => [
              styles.recentreBtn,
              { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.92 : 1 },
              Elevation.md,
            ]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Recenter on my location"
          >
            <Ionicons name="locate" size={18} color={theme.textPrimary} />
          </Pressable>
        </View>

        {/* Live donor count badge (replaces Uber's ETA pill).
            bottom = Spacing[10] (40) so the pill clears the sheet's
            -Spacing[5] (-20) overlap with ~20px of clean breathing room
            above the sheet's rounded top edge. */}
        {pin && (
          <View
            pointerEvents="none"
            style={[
              styles.donorBadge,
              { backgroundColor: theme.surface, borderColor: theme.border, bottom: Spacing[10], left: Spacing[4] },
              Elevation.md,
            ]}
          >
            <View style={styles.liveDotWrap}>
              <View style={[styles.liveDotOuter, { backgroundColor: theme.success + '40' }]} />
              <View style={[styles.liveDot, { backgroundColor: theme.success }]} />
            </View>
            <View>
              <Text style={[styles.donorBadgeNumber, { color: theme.textPrimary }]}>
                {animatedDonorCount} {bloodGroup}
              </Text>
              <Text style={[styles.donorBadgeSub, { color: theme.textMuted }]}>
                {distanceWord(donorCount, avgDonorKm)}
              </Text>
            </View>
          </View>
        )}

        {/* Bottom-right hint pill — matches donor badge bottom offset so
            both pills align on the same visual baseline above the sheet. */}
        <View
          pointerEvents="none"
          style={[
            styles.mapHint,
            { backgroundColor: theme.surface, borderColor: theme.border, bottom: Spacing[10], right: Spacing[4] },
            Elevation.sm,
          ]}
        >
          <Ionicons name="hand-left-outline" size={14} color={theme.textMuted} />
          <Text style={[styles.mapHintText, { color: theme.textMuted }]} numberOfLines={1}>
            {pin ? 'Tap to move pin' : 'Tap to drop pin'}
          </Text>
        </View>
      </View>

      {/* ─────────────────────── BOTTOM SHEET (VERIFY) ───────────────────── */}
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
            marginTop: -Spacing[5],
          },
          Elevation.lg,
          sheetEntrance,
        ]}
      >
        {/* Brand accent strip + handle (peak-end on first appear) */}
        <View style={styles.sheetTop}>
          <View style={[styles.accentStrip, { backgroundColor: theme.primary }]} />
          <View style={[styles.handle, { backgroundColor: theme.borderStrong }]} />
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: Spacing[5],
            paddingBottom: insets.bottom + TAB_BAR_HEIGHT + Spacing[6],
            gap: Spacing[5],
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Route summary bar ─────────────────────────────────────── */}
          <View style={[styles.routeBar, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>
            <View style={styles.routeCol}>
              <View style={[styles.routeDot, { backgroundColor: theme.success, borderColor: theme.surface }]} />
              <View style={[styles.routeLine, { backgroundColor: theme.border }]} />
              <View style={[styles.routeDot, { backgroundColor: theme.primary, borderColor: theme.surface }]} />
            </View>
            <View style={{ flex: 1, gap: Spacing[3] }}>
              <View>
                <Text style={[styles.routeLabel, { color: theme.textMuted }]}>You</Text>
                <Text style={[styles.routeValue, { color: theme.textPrimary }]} numberOfLines={1}>
                  {userAddress ?? 'Locating you…'}
                </Text>
              </View>
              <View>
                <Text style={[styles.routeLabel, { color: theme.textMuted }]}>Hospital</Text>
                <Text style={[styles.routeValue, { color: theme.textPrimary }]} numberOfLines={1}>
                  {hospital.trim() || hospAddr || (geoLoading ? 'Reading from pin…' : 'Tap the map to pin')}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Urgency carousel ─────────────────────────────────────── */}
          <View>
            <SectionLabel theme={theme}>How urgent?</SectionLabel>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: Spacing[1], paddingRight: Spacing[3] }}
            >
              {URGENCY_LEVELS.map(u => (
                <UrgencyCard key={u} level={u} selected={urgency === u} onPress={() => setUrgency(u)} theme={theme} />
              ))}
            </ScrollView>
            <Text style={[styles.urgencySub, { color: theme.textMuted }]} numberOfLines={2}>
              {URGENCY_META[urgency].sub}
            </Text>
          </View>

          {/* ── Blood group as 4×2 grid (tap-friendly Fitts) ─────────── */}
          <View>
            <SectionLabel theme={theme}>Blood group needed</SectionLabel>
            <View style={styles.bloodGrid}>
              {BLOOD_GROUPS.map(g => {
                const selected = bloodGroup === g;
                return (
                  <Pressable
                    key={g}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setBloodGroup(g);
                    }}
                    style={[
                      styles.bloodCell,
                      {
                        borderColor: selected ? theme.primary : theme.border,
                        backgroundColor: selected ? theme.primary : theme.cardElevated,
                      },
                      selected && Elevation.sm,
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Blood group ${g}`}
                  >
                    <Text style={[
                      styles.bloodCellLabel,
                      { color: selected ? theme.textOnPrimary : theme.textPrimary },
                    ]}>{g}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── Units (compact, with dot-row) ────────────────────────── */}
          <View>
            <SectionLabel theme={theme}>Units needed</SectionLabel>
            <View style={[styles.unitsWrap, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setUnits(u => Math.max(1, u - 1));
                }}
                style={[styles.unitsBtn, { borderRightColor: theme.border }]}
                disabled={units <= 1}
                accessibilityRole="button"
                accessibilityLabel="Decrease units"
              >
                <Ionicons name="remove" size={20} color={units <= 1 ? theme.textTertiary : theme.textPrimary} />
              </Pressable>
              <View style={styles.unitsCenter}>
                <Text style={[styles.unitsValue, { color: theme.textPrimary }]}>{units}</Text>
                <View style={styles.unitsDots}>
                  {Array.from({ length: Math.min(units, 8) }).map((_, i) => (
                    <View key={i} style={[styles.unitsDot, { backgroundColor: theme.primary }]} />
                  ))}
                  {units > 8 && <Text style={[styles.unitsMore, { color: theme.textMuted }]}>+{units - 8}</Text>}
                </View>
                <Text style={[styles.unitsLabel, { color: theme.textMuted }]}>
                  {units === 1 ? '1 donor will be matched' : `${units} donors will be matched`}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setUnits(u => Math.min(20, u + 1));
                }}
                style={[styles.unitsBtn, { borderLeftColor: theme.border }]}
                disabled={units >= 20}
                accessibilityRole="button"
                accessibilityLabel="Increase units"
              >
                <Ionicons name="add" size={20} color={units >= 20 ? theme.textTertiary : theme.textPrimary} />
              </Pressable>
            </View>
          </View>

          {/* ── Hospital details ─────────────────────────────────────── */}
          <View style={{ gap: Spacing[3] }}>
            <SectionLabel theme={theme}>Confirm the hospital</SectionLabel>
            <Input
              label="Hospital name"
              placeholder="e.g. Services Hospital"
              value={hospital}
              onChangeText={setHospital}
              leftIcon={<Ionicons name="medical-outline" size={18} color={theme.textMuted} />}
            />
            <Input
              label="Address"
              placeholder={geoLoading ? 'Reading address from pin…' : 'Auto-filled from the pin'}
              value={hospAddr}
              onChangeText={setHospAddr}
              variant="area"
              multiline
            />
          </View>

          {/* ── Notes (low-priority, optional) ───────────────────────── */}
          <View>
            <SectionLabel theme={theme}>Anything else? (optional)</SectionLabel>
            <Input
              placeholder="Patient name, ward, contact — anything that helps a donor reach you faster"
              value={notes}
              onChangeText={setNotes}
              variant="area"
              multiline
            />
          </View>

          {/* ── Preview card (last verification before commit) ───────── */}
          <View>
            <SectionLabel theme={theme}>What donors will see</SectionLabel>
            <View style={[styles.previewCard, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>
              <View style={[styles.previewStripe, { backgroundColor: theme.primary }]} />
              <View style={styles.previewBody}>
                <View style={styles.previewTopRow}>
                  <BloodGroupBadge bloodGroup={bloodGroup} size="md" variant="solid" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.previewHospital, { color: theme.textPrimary }]} numberOfLines={1}>
                      {hospital.trim() || 'Hospital'}
                    </Text>
                    <Text style={[styles.previewAddr, { color: theme.textMuted }]} numberOfLines={1}>
                      {hospAddr || 'Address auto-fills'}
                    </Text>
                  </View>
                </View>
                <View style={styles.previewMeta}>
                  <PreviewChip
                    iconName={URGENCY_META[urgency].iconName}
                    label={URGENCY_META[urgency].label}
                    color={
                      urgency === 'critical' ? theme.danger
                      : urgency === 'urgent'  ? theme.warning
                      :                          theme.success
                    }
                    theme={theme}
                  />
                  <PreviewChip
                    iconName="people-outline"
                    label={`${units} donor${units === 1 ? '' : 's'}`}
                    color={theme.primary}
                    theme={theme}
                  />
                  {donorCount > 0 && (
                    <PreviewChip
                      iconName="pulse"
                      label={`${donorCount} ready`}
                      color={theme.success}
                      theme={theme}
                    />
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* ── In-form CTA (ACT) ──────────────────────────────────────
              Lives at the natural end of the form (commitment device): the
              user scrolls past every field, sees the preview, then commits.
              Summary row above the button mirrors the urgency tier so the
              decision is verified one last time before the tap. Breathes
              when urgency is critical (loss-aversion via motion). */}
          <View style={styles.ctaInline}>
            <View style={styles.ctaSummary}>
              <View style={[styles.ctaSummaryDot, { backgroundColor: ctaAccent }]} />
              <Text style={[styles.ctaSummaryText, { color: theme.textPrimary }]} numberOfLines={1}>
                <Text style={{ fontWeight: FontWeight.black, color: ctaAccent }}>
                  {URGENCY_META[urgency].label}
                </Text>
                <Text style={{ color: theme.textMuted }}>{'  ·  '}</Text>
                <Text>{bloodGroup}</Text>
                <Text style={{ color: theme.textMuted }}>{'  ·  '}</Text>
                <Text>{units} {units === 1 ? 'unit' : 'units'}</Text>
              </Text>
              {donorCount > 0 && (
                <View style={[styles.ctaSummaryPill, { backgroundColor: theme.success + '1F', borderColor: theme.success + '55' }]}>
                  <View style={[styles.ctaSummaryPillDot, { backgroundColor: theme.success }]} />
                  <Text style={[styles.ctaSummaryPillText, { color: theme.success }]}>
                    {donorCount} live
                  </Text>
                </View>
              )}
            </View>

            <BreathingWrapper enabled={urgency === 'critical' && !loading}>
              <Button
                label={ctaLabel}
                onPress={submit}
                disabled={submitDisabled}
                loading={loading}
                fullWidth
                size="xl"
                variant="primary"
                haptic={false}
                icon={<Ionicons name="paper-plane" size={18} color={theme.textOnPrimary} />}
                iconPosition="left"
              />
            </BreathingWrapper>

            <Text style={[styles.ctaFooterNote, { color: theme.textMuted }]}>
              By posting, you agree donor contact details are shared only
              after a donor accepts.
            </Text>
          </View>
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

function SectionLabel({ theme, children }: { theme: any; children: React.ReactNode }) {
  return (
    <Text style={{
      fontSize: FontSize.xs,
      fontWeight: FontWeight.black,
      letterSpacing: LetterSpacing.widest,
      textTransform: 'uppercase',
      color: theme.textMuted,
      marginLeft: Spacing[2],
      marginBottom: Spacing[2],
    }}>{children}</Text>
  );
}

function PreviewChip({
  iconName, label, color, theme,
}: { iconName: keyof typeof Ionicons.glyphMap; label: string; color: string; theme: any }) {
  return (
    <View style={[
      previewChipStyles.chip,
      { backgroundColor: color + '1F', borderColor: color + '55' },
    ]}>
      <Ionicons name={iconName} size={12} color={color} />
      <Text style={[previewChipStyles.label, { color }]}>{label}</Text>
    </View>
  );
}
const previewChipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing[2], paddingVertical: 3,
    borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: FontSize['2xs'], fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.snug, textTransform: 'uppercase',
  },
});

const styles = StyleSheet.create({
  root: { flex: 1 },

  // ── Map ────────────────────────────────────────────────────────────────
  mapWrap: { position: 'relative', backgroundColor: '#1a1a1a' },
  mapTop: {
    position: 'absolute', left: Spacing[4], right: Spacing[4],
    flexDirection: 'row', alignItems: 'center',
  },
  recentreBtn: {
    width: 40, height: 40, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  donorBadge: {
    position: 'absolute',
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[2],
    borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '60%',
  },
  liveDotWrap: {
    width: 12, height: 12, alignItems: 'center', justifyContent: 'center',
  },
  liveDotOuter: { position: 'absolute', width: 12, height: 12, borderRadius: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  donorBadgeNumber: {
    fontSize: FontSize.sm, fontWeight: FontWeight.black, letterSpacing: LetterSpacing.snug,
  },
  donorBadgeSub: { fontSize: FontSize['2xs'], fontWeight: FontWeight.semibold, marginTop: 1 },

  mapHint: {
    position: 'absolute',
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[1],
    borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth,
  },
  mapHintText: {
    fontSize: FontSize['2xs'], fontWeight: FontWeight.semibold, letterSpacing: LetterSpacing.snug,
  },
  bigPin: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, ...Elevation.sm,
  },

  // ── Sheet ──────────────────────────────────────────────────────────────
  sheet: {
    flex: 1,
    borderTopLeftRadius:  Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheetTop: { alignItems: 'center', paddingTop: Spacing[2], paddingBottom: Spacing[3] },
  accentStrip: {
    width: 36, height: 3, borderRadius: 2, marginBottom: Spacing[1],
    opacity: 0.9,
  },
  handle: { width: 44, height: 4, borderRadius: 2 },

  // ── Route summary bar ──────────────────────────────────────────────────
  routeBar: {
    flexDirection: 'row', gap: Spacing[3],
    padding: Spacing[4],
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  routeCol: { alignItems: 'center', paddingTop: 4 },
  routeDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  routeLine: { width: 2, flex: 1, marginVertical: 4 },
  routeLabel: {
    fontSize: FontSize['2xs'], fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.widest, textTransform: 'uppercase',
  },
  routeValue: {
    fontSize: FontSize.sm, fontWeight: FontWeight.bold,
    letterSpacing: LetterSpacing.snug, marginTop: 2,
  },

  urgencySub: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semibold,
    letterSpacing: LetterSpacing.snug,
    marginLeft: Spacing[2], marginTop: Spacing[2],
    lineHeight: FontSize.xs * 1.5,
  },

  // ── Blood group grid ─────────────────────────────────────────────────
  bloodGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: Spacing[2],
  },
  bloodCell: {
    width: '23%',
    paddingVertical: Spacing[4],
    alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.xl, borderWidth: 1.5,
  },
  bloodCellLabel: {
    fontSize: FontSize.lg, fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.tight,
  },

  // ── Units stepper ─────────────────────────────────────────────────────
  unitsWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: Radius.xl, borderWidth: 1.5,
    height: 80, overflow: 'hidden',
  },
  unitsBtn: {
    width: 60, height: '100%',
    alignItems: 'center', justifyContent: 'center',
  },
  unitsCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  unitsValue: {
    fontSize: FontSize['2xl'], fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.tighter,
  },
  unitsDots: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2, marginBottom: 1 },
  unitsDot: { width: 5, height: 5, borderRadius: 2.5 },
  unitsMore: { fontSize: FontSize['2xs'], fontWeight: FontWeight.semibold, marginLeft: 2 },
  unitsLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semibold,
    letterSpacing: LetterSpacing.snug,
  },

  // ── Preview card ──────────────────────────────────────────────────────
  previewCard: {
    flexDirection: 'row',
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  previewStripe: { width: 4 },
  previewBody: { flex: 1, padding: Spacing[4], gap: Spacing[3] },
  previewTopRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
  },
  previewHospital: {
    fontSize: FontSize.base, fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.snug,
  },
  previewAddr: { fontSize: FontSize.xs, marginTop: 2 },
  previewMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },

  // ── In-form CTA ────────────────────────────────────────────────────────
  ctaInline: {
    marginTop: Spacing[2],
    gap: Spacing[3],
  },
  ctaFooterNote: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    letterSpacing: LetterSpacing.snug,
    textAlign: 'center',
    paddingHorizontal: Spacing[4],
    lineHeight: FontSize.xs * 1.5,
  },
  ctaSummary: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[1],
  },
  ctaSummaryDot: {
    width: 8, height: 8, borderRadius: 4,
  },
  ctaSummaryText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    letterSpacing: LetterSpacing.snug,
  },
  ctaSummaryPill: {
    flexDirection: 'row', alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing[2], paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ctaSummaryPillDot: { width: 5, height: 5, borderRadius: 2.5 },
  ctaSummaryPillText: {
    fontSize: FontSize['2xs'],
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.snug,
    textTransform: 'uppercase',
  },
});
