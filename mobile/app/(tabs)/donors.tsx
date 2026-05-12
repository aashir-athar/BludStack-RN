// app/(tabs)/donors.tsx
import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, useWindowDimensions,
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/hooks/useLocation';
import { useNearbyRequests, BloodRequest } from '@/hooks/useRequests';
import RequestCard from '@/components/RequestCard';
import BloodGroupBadge from '@/components/BloodGroupBadge';
import SelectSheet from '@/components/SelectSheet';
import EmptyState from '@/components/EmptyState';
import { FontSize, FontWeight, Spacing, Radius, LetterSpacing } from '@/constants/Typography';
import { BLOOD_GROUPS, URGENCY_CONFIG, UrgencyLevel } from '@/constants/BloodData';
import { getBloodGroupColor } from '@/utils/helpers';
import { deltaFromKm } from '@/utils/geo';

type ViewMode = 'list' | 'map';

export default function DonorsScreen() {
  const { theme, isDark } = useTheme();
  const { profile } = useAuth();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const { location, refreshLocation } = useLocation(true);
  const { requests, loading, refetch } = useNearbyRequests(
    location?.latitude ?? null,
    location?.longitude ?? null,
  );

  const [viewMode, setViewMode]             = useState<ViewMode>('list');
  const [filterBlood, setFilterBlood]       = useState('All');
  const [filterUrgency, setFilterUrgency]   = useState('All');
  const [bloodVisible, setBloodVisible]     = useState(false);
  const [urgencyVisible, setUrgencyVisible] = useState(false);

  const filtered = useMemo(() => requests.filter(r => {
    if (filterBlood   !== 'All' && r.blood_group !== filterBlood) return false;
    if (filterUrgency !== 'All' && r.urgency     !== filterUrgency) return false;
    return true;
  }), [requests, filterBlood, filterUrgency]);

  const mapRegion = useMemo(() => location ? {
    latitude: location.latitude, longitude: location.longitude,
    latitudeDelta: deltaFromKm(25), longitudeDelta: deltaFromKm(25),
  } : undefined, [location]);

  const renderItem = useCallback(({ item }: { item: BloodRequest }) => (
    <RequestCard
      request={item}
      userLat={location?.latitude}
      userLon={location?.longitude}
      onPress={r => router.push(`/request/${r.id}`)}
    />
  ), [location, router]);

  const keyExtractor = useCallback((item: BloodRequest) => item.id, []);

  const bloodOptions = [
    { label: 'All Groups', value: 'All' },
    ...BLOOD_GROUPS.map(bg => ({ label: bg, value: bg })),
  ];
  const urgencyOptions = [
    { label: 'All Urgency', value: 'All' },
    { label: 'Critical', value: 'critical', description: 'Needed within 30 min' },
    { label: 'Urgent',   value: 'urgent',   description: 'Needed within 2 hours' },
    { label: 'Standard', value: 'standard', description: 'Scheduled donation' },
  ];

  const hasFilters = filterBlood !== 'All' || filterUrgency !== 'All';

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>

      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing[4], backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={styles.topRow}>
          <View>
            <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>Find Requests</Text>
            <Text style={[styles.pageSubtitle, { color: theme.textMuted }]}>
              {filtered.length} active near you
            </Text>
          </View>
          {/* Map / List toggle */}
          <View style={[styles.toggleWrap, { backgroundColor: theme.cardElevated }]}>
            {(['list', 'map'] as ViewMode[]).map(m => (
              <TouchableOpacity
                key={m}
                onPress={() => setViewMode(m)}
                style={[styles.toggleBtn, viewMode === m && { backgroundColor: theme.textPrimary }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.toggleLabel, { color: viewMode === m ? theme.textInverse : theme.textMuted }]}>
                  {m === 'list' ? '≡ List' : '◎ Map'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Filter chips */}
        <View style={styles.filters}>
          <FilterChip
            label={filterBlood === 'All' ? 'Blood Group' : filterBlood}
            active={filterBlood !== 'All'}
            onPress={() => setBloodVisible(true)}
            theme={theme}
          />
          <FilterChip
            label={filterUrgency === 'All' ? 'Urgency' : URGENCY_CONFIG[filterUrgency as UrgencyLevel].label}
            active={filterUrgency !== 'All'}
            onPress={() => setUrgencyVisible(true)}
            theme={theme}
          />
          {hasFilters && (
            <TouchableOpacity
              onPress={() => { setFilterBlood('All'); setFilterUrgency('All'); }}
              style={[styles.clearChip, { borderColor: theme.border }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.clearLabel, { color: theme.textMuted }]}>✕ Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Map view ── */}
      {viewMode === 'map' && location && (
        <View style={{ height: height * 0.45 }}>
          <MapView
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_DEFAULT}
            region={mapRegion}
            userInterfaceStyle={isDark ? 'dark' : 'light'}
            showsUserLocation
            showsMyLocationButton={false}
          >
            {[1, 5, 15, 30].map(km => (
              <Circle
                key={km}
                center={{ latitude: location.latitude, longitude: location.longitude }}
                radius={km * 1000}
                strokeColor={`${theme.textSecondary}30`}
                fillColor="transparent"
                strokeWidth={1}
              />
            ))}
            {filtered.map(req => (
              <Marker
                key={req.id}
                coordinate={{ latitude: req.latitude, longitude: req.longitude }}
                onPress={() => router.push(`/request/${req.id}`)}
              >
                <View style={[styles.mapMarker, { backgroundColor: getBloodGroupColor(req.blood_group) }]}>
                  <Text style={styles.mapMarkerText}>{req.blood_group}</Text>
                </View>
              </Marker>
            ))}
          </MapView>
        </View>
      )}

      {/* ── List ── */}
      <FlatList
        data={filtered}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Spacing[12] }]}
        showsVerticalScrollIndicator={false}
        onRefresh={refetch}
        refreshing={loading}
        ListEmptyComponent={
          <EmptyState
            icon="🔍"
            title="No requests match"
            description="Try different filters or check back soon."
            actionLabel={hasFilters ? 'Clear filters' : undefined}
            onAction={hasFilters ? () => { setFilterBlood('All'); setFilterUrgency('All'); } : undefined}
          />
        }
      />

      <SelectSheet
        visible={bloodVisible}
        title="Filter by Blood Group"
        options={bloodOptions}
        selected={filterBlood}
        onSelect={setFilterBlood}
        onClose={() => setBloodVisible(false)}
      />
      <SelectSheet
        visible={urgencyVisible}
        title="Filter by Urgency"
        options={urgencyOptions}
        selected={filterUrgency}
        onSelect={setFilterUrgency}
        onClose={() => setUrgencyVisible(false)}
      />
    </View>
  );
}

function FilterChip({ label, active, onPress, theme }: {
  label: string; active: boolean; onPress: () => void; theme: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.chip, {
        backgroundColor: active ? theme.textPrimary : theme.card,
        borderColor:     active ? theme.textPrimary : theme.border,
      }]}
    >
      <Text style={[styles.chipLabel, { color: active ? theme.textInverse : theme.textSecondary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1 },
  topBar:       { paddingHorizontal: Spacing[5], paddingBottom: Spacing[3], borderBottomWidth: StyleSheet.hairlineWidth },
  topRow:       { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing[3] },
  pageTitle:    { fontSize: FontSize.xl, fontWeight: FontWeight.black, letterSpacing: LetterSpacing.tight },
  pageSubtitle: { fontSize: FontSize.xs, marginTop: 2 },
  toggleWrap:   { flexDirection: 'row', borderRadius: Radius.xs, overflow: 'hidden', padding: 2 },
  toggleBtn:    { paddingHorizontal: Spacing[3], paddingVertical: Spacing[1], borderRadius: Radius.xs - 2 },
  toggleLabel:  { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  filters:      { flexDirection: 'row', gap: Spacing[2], flexWrap: 'wrap' },
  chip:         { paddingHorizontal: Spacing[3], paddingVertical: Spacing[1], borderRadius: Radius.full, borderWidth: StyleSheet.hairlineWidth },
  chipLabel:    { fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.wide },
  clearChip:    { paddingHorizontal: Spacing[3], paddingVertical: Spacing[1], borderRadius: Radius.full, borderWidth: StyleSheet.hairlineWidth },
  clearLabel:   { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  list:         { padding: Spacing[5] },
  mapMarker:    { paddingHorizontal: Spacing[2], paddingVertical: 3, borderRadius: Radius.xs },
  mapMarkerText:{ color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.black },
});
