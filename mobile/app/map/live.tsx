// app/map/live.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';
import { apiUpdateLocation } from '@/utils/api';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/Typography';
import { haversineDistance, formatDistance, estimateDriveMinutes, deltaFromKm } from '@/utils/geo';

interface DonorLocation {
  id: string;
  latitude: number;
  longitude: number;
  full_name: string;
  blood_group: string;
}

export default function LiveMapScreen() {
  const { requestId, role } = useLocalSearchParams<{ requestId: string; role: 'donor' | 'recipient' }>();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const mapRef = useRef<MapView>(null);

  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [donors, setDonors] = useState<DonorLocation[]>([]);
  const [requestLocation, setRequestLocation] = useState<{ latitude: number; longitude: number; hospital: string } | null>(null);
  const [watching, setWatching] = useState(false);
  const watchSub = useRef<Location.LocationSubscription | null>(null);

  // Start watching location
  const startWatching = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location required', 'Enable location to use live tracking.');
      return;
    }

    watchSub.current = await Location.watchPositionAsync(
      // Throttle: 15s + 50m minimum movement. Backend handles persistence.
      { accuracy: Location.Accuracy.High, timeInterval: 15_000, distanceInterval: 50 },
      async (pos) => {
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setMyLocation(coords);
        setWatching(true);
        if (user?.id) {
          try { await apiUpdateLocation(coords.latitude, coords.longitude); }
          catch { /* keep last-known on error — live tracking is best-effort */ }
        }
      }
    );
  }, [user]);

  // Load request details
  const loadRequest = useCallback(async () => {
    if (!requestId) return;
    const { data } = await supabase
      .from('blood_requests')
      .select('latitude, longitude, hospital_name')
      .eq('id', requestId)
      .single();
    if (data) {
      setRequestLocation({ latitude: data.latitude, longitude: data.longitude, hospital: data.hospital_name });
    }
  }, [requestId]);

  // Load accepted donors' live locations from request_responses.
  // Source of truth = request_responses.donor_lat/donor_lon, pushed via
  // /donations/heartbeat. Falls back to profile-level lat/lon only if the
  // donor hasn't started heartbeating yet (rare).
  const loadDonors = useCallback(async () => {
    if (!requestId || role !== 'recipient') return;
    const { data } = await supabase
      .from('request_responses')
      .select(`
        donor_id, donor_lat, donor_lon, donor_location_updated_at,
        donor:profiles!donor_id ( id, full_name, blood_group )
      `)
      .eq('request_id', requestId)
      .eq('status', 'accepted');

    const donorData: DonorLocation[] = (data ?? [])
      .map((r: any) => {
        const d = r.donor;
        if (!d) return null;
        const lat = r.donor_lat;
        const lon = r.donor_lon;
        if (lat == null || lon == null) return null;
        return {
          id:          d.id,
          latitude:    lat,
          longitude:   lon,
          full_name:   d.full_name,
          blood_group: d.blood_group,
        };
      })
      .filter(Boolean) as DonorLocation[];
    setDonors(donorData);
  }, [requestId, role]);

  useEffect(() => {
    startWatching();
    loadRequest();
    loadDonors();

    // Realtime: subscribe to UPDATEs on request_responses for this request.
    // RLS allows the recipient to see donor responses on their own requests.
    const sub = supabase
      .channel(`live_${requestId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'request_responses',
        filter: `request_id=eq.${requestId}`,
      }, loadDonors)
      .subscribe();

    return () => {
      watchSub.current?.remove();
      sub.unsubscribe();
    };
  }, [startWatching, loadRequest, loadDonors]);

  const fitToMarkers = useCallback(() => {
    if (!mapRef.current) return;
    const coords = [myLocation, requestLocation, ...donors.map((d) => ({ latitude: d.latitude, longitude: d.longitude }))]
      .filter(Boolean) as any[];
    if (coords.length < 2) return;
    mapRef.current.fitToCoordinates(coords, { edgePadding: { top: 80, right: 40, bottom: 80, left: 40 }, animated: true });
  }, [myLocation, requestLocation, donors]);

  const openGoogleMaps = useCallback(() => {
    if (!requestLocation) return;
    Haptics.selectionAsync().catch(() => {});
    const url = `https://www.google.com/maps/dir/?api=1&destination=${requestLocation.latitude},${requestLocation.longitude}&travelmode=driving`;
    Linking.openURL(url);
  }, [requestLocation]);

  const closeMap = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    router.back();
  }, [router]);

  const onFit = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    fitToMarkers();
  }, [fitToMarkers]);

  const distance = myLocation && requestLocation
    ? haversineDistance(myLocation.latitude, myLocation.longitude, requestLocation.latitude, requestLocation.longitude)
    : null;

  const center = myLocation ?? requestLocation ?? { latitude: 31.5204, longitude: 74.3587 }; // Default: Lahore

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* Top overlay */}
      <View style={[styles.topOverlay, { paddingTop: insets.top + Spacing[2] }]}>
        <View style={[styles.topCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TouchableOpacity onPress={closeMap} style={styles.closeBtn} activeOpacity={0.8} accessibilityLabel="Close live map">
            <Ionicons name="close" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.primary }} />
              <Text style={[styles.liveLabel, { color: theme.primary }]}>LIVE TRACKING</Text>
            </View>
            <Text style={[styles.hospitalText, { color: theme.textPrimary }]} numberOfLines={1}>
              {requestLocation?.hospital ?? 'Loading…'}
            </Text>
          </View>
          <TouchableOpacity onPress={onFit} style={[styles.fitBtn, { backgroundColor: theme.cardElevated, borderColor: theme.border }]} accessibilityLabel="Fit map to markers">
            <Ionicons name="scan" size={18} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        userInterfaceStyle={isDark ? 'dark' : 'light'}
        showsUserLocation
        showsMyLocationButton={false}
        region={{
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: deltaFromKm(10),
          longitudeDelta: deltaFromKm(10),
        }}
      >
        {/* Hospital / Request marker */}
        {requestLocation && (
          <Marker
            coordinate={{ latitude: requestLocation.latitude, longitude: requestLocation.longitude }}
            title={requestLocation.hospital}
            description="Destination"
          >
            <View style={[styles.hospitalMarker, { backgroundColor: theme.primary }]}>
              <Ionicons name="medical" size={18} color={theme.textOnPrimary} />
            </View>
          </Marker>
        )}

        {/* Donor markers (for recipient view) */}
        {donors.map((donor) => (
          <Marker
            key={donor.id}
            coordinate={{ latitude: donor.latitude, longitude: donor.longitude }}
            title={donor.full_name}
            description={`${donor.blood_group} · Moving to hospital`}
          >
            <View style={[styles.donorMarker, { backgroundColor: theme.primary }]}>
              <Ionicons name="water" size={16} color={theme.textOnPrimary} />
            </View>
          </Marker>
        ))}

        {/* Route line (donor to hospital) */}
        {role === 'donor' && myLocation && requestLocation && (
          <Polyline
            coordinates={[myLocation, requestLocation]}
            strokeColor={theme.primary}
            strokeWidth={2.5}
            lineDashPattern={[6, 4]}
          />
        )}
      </MapView>

      {/* Bottom panel */}
      <View style={[styles.bottomPanel, { backgroundColor: theme.surface, borderTopColor: theme.border, paddingBottom: insets.bottom + Spacing[4] }]}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.primary }]}>
              {distance !== null ? formatDistance(distance) : '—'}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Distance</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.primary }]}>
              {distance !== null ? `${estimateDriveMinutes(distance)} min` : '—'}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Est. Drive</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: watching ? theme.success : theme.textMuted }]}>
              {watching ? '● Live' : '○ Off'}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Tracking</Text>
          </View>
        </View>

        {/* Donors en route (recipient view) */}
        {role === 'recipient' && donors.length > 0 && (
          <View style={[styles.donorsRow, { borderTopColor: theme.border }]}>
            <Text style={[styles.donorsLabel, { color: theme.textSecondary }]}>
              {donors.length} donor{donors.length !== 1 ? 's' : ''} en route
            </Text>
          </View>
        )}

        {/* CTA */}
        {role === 'donor' && (
          <Button
            label="Open in Google Maps"
            icon={<Ionicons name="navigate" size={16} color={theme.textOnPrimary ?? '#fff'} />}
            variant="primary"
            size="lg"
            onPress={openGoogleMaps}
            fullWidth
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1 },
  map:   { flex: 1 },
  topOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    zIndex: 10, paddingHorizontal: Spacing[4],
  },
  topCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[3], borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  closeBtn:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  liveLabel:   { fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 1 },
  hospitalText:{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  fitBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  hospitalMarker: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  donorMarker: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  markerEmoji: { fontSize: 20 },
  bottomPanel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing[4], paddingHorizontal: Spacing[4], gap: Spacing[4],
  },
  statsRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  statItem:    { alignItems: 'center', flex: 1, gap: 2 },
  statValue:   { fontSize: FontSize.xl, fontWeight: FontWeight.black },
  statLabel:   { fontSize: FontSize.xs },
  statDivider: { width: 1, height: 32 },
  donorsRow:   { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing[3] },
  donorsLabel: { fontSize: FontSize.sm },
});
