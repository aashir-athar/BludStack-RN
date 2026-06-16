// app/(tabs)/donors.tsx
// Lever: discovery, no nudge — exploration mode for donors. Pill filters,
// map / list toggle, theme-tokenised throughout. Self-posted requests are
// already excluded server-side AND client-side; this screen always shows
// requests other people have posted.

import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, useWindowDimensions, RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Map as MapLibreMap, Camera, Marker as MlMarker, UserLocation } from '@maplibre/maplibre-react-native';
import { getMapStyleJSON, zoomFromRadiusKm } from '@/utils/mapStyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { useLocation } from '@/hooks/useLocation';
import { useNearbyRequests, type BloodRequest } from '@/hooks/useRequests';
import RequestCard from '@/components/RequestCard';
import SelectSheet from '@/components/SelectSheet';
import EmptyState from '@/components/EmptyState';
import {
  FontSize, FontWeight, Spacing, Radius, LetterSpacing,
  TAB_BAR_BOTTOM_INSET, Elevation,
} from '@/constants/Typography';
import { BLOOD_GROUPS, type UrgencyLevel } from '@/constants/BloodData';

type ViewMode = 'list' | 'map';

const URGENCY_LABEL: Record<UrgencyLevel | 'All', string> = {
  All:      'All urgency',
  critical: 'Critical',
  urgent:   'Urgent',
  standard: 'Standard',
};

export default function DonorsScreen() {
  const { theme, isDark } = useTheme();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const { location, refreshLocation } = useLocation(true);
  const { requests, loading, refetch } = useNearbyRequests(
    location?.latitude ?? null,
    location?.longitude ?? null,
  );

  const [viewMode, setViewMode]             = useState<ViewMode>('list');
  const [filterBlood, setFilterBlood]       = useState<string>('All');
  const [filterUrgency, setFilterUrgency]   = useState<string>('All');
  const [bloodVisible, setBloodVisible]     = useState(false);
  const [urgencyVisible, setUrgencyVisible] = useState(false);

  const filtered = useMemo(() => requests.filter(r => {
    if (filterBlood   !== 'All' && r.blood_group !== filterBlood) return false;
    if (filterUrgency !== 'All' && r.urgency     !== filterUrgency) return false;
    return true;
  }), [requests, filterBlood, filterUrgency]);

  // MapLibre takes a centre + zoomLevel — no latitudeDelta. We frame the
  // 25 km discovery radius via zoomFromRadiusKm() at the Camera component.
  const mapCenter = useMemo(() => location ? {
    latitude:  location.latitude,
    longitude: location.longitude,
  } : undefined, [location]);

  const onCardPress = useCallback((r: BloodRequest) => {
    Haptics.selectionAsync().catch(() => {});
    router.push({ pathname: '/request/[id]', params: { id: r.id } });
  }, [router]);

  const onModeChange = useCallback((m: ViewMode) => {
    Haptics.selectionAsync().catch(() => {});
    setViewMode(m);
  }, []);

  const openBlood   = useCallback(() => { Haptics.selectionAsync().catch(() => {}); setBloodVisible(true); }, []);
  const openUrgency = useCallback(() => { Haptics.selectionAsync().catch(() => {}); setUrgencyVisible(true); }, []);

  const renderItem = useCallback(({ item }: { item: BloodRequest }) => (
    <RequestCard
      request={item}
      userLat={location?.latitude ?? null}
      userLon={location?.longitude ?? null}
      onPress={onCardPress}
    />
  ), [location?.latitude, location?.longitude, onCardPress]);

  const keyExtractor = useCallback((item: BloodRequest) => item.id, []);

  const clearFilters = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setFilterBlood('All');
    setFilterUrgency('All');
  }, []);

  const bloodOptions = useMemo(() => [
    { label: 'All groups', value: 'All' },
    ...BLOOD_GROUPS.map(bg => ({ label: bg, value: bg })),
  ], []);

  const urgencyOptions = useMemo(() => [
    { label: 'All urgency', value: 'All' },
    { label: 'Critical',    value: 'critical', description: 'Within 30 minutes' },
    { label: 'Urgent',      value: 'urgent',   description: 'Within 2 hours' },
    { label: 'Standard',    value: 'standard', description: 'Scheduled' },
  ], []);

  const hasFilters = filterBlood !== 'All' || filterUrgency !== 'All';

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + Spacing[4],
            backgroundColor: theme.surface,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Discover · Nearby</Text>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Find requests</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              {filtered.length} active near you
            </Text>
          </View>
          <View style={[styles.toggleWrap, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>
            {(['list', 'map'] as ViewMode[]).map(m => {
              const active = viewMode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => onModeChange(m)}
                  style={[
                    styles.toggleBtn,
                    active && { backgroundColor: theme.textPrimary },
                  ]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={m}
                >
                  <Ionicons
                    name={m === 'list' ? 'list' : 'map'}
                    size={14}
                    color={active ? theme.textInverse : theme.textMuted}
                  />
                  <Text style={[
                    styles.toggleLabel,
                    { color: active ? theme.textInverse : theme.textMuted },
                  ]}>
                    {m === 'list' ? 'List' : 'Map'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.filters}>
          <FilterChip
            iconName="water"
            label={filterBlood === 'All' ? 'Blood group' : filterBlood}
            active={filterBlood !== 'All'}
            onPress={openBlood}
            theme={theme}
          />
          <FilterChip
            iconName="flash-outline"
            label={URGENCY_LABEL[(filterUrgency as UrgencyLevel | 'All')]}
            active={filterUrgency !== 'All'}
            onPress={openUrgency}
            theme={theme}
          />
          {hasFilters && (
            <Pressable
              onPress={clearFilters}
              style={({ pressed }) => [
                styles.clearChip,
                { borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Clear filters"
            >
              <Ionicons name="close" size={14} color={theme.textMuted} />
              <Text style={[styles.clearLabel, { color: theme.textMuted }]}>Clear</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Map */}
      {viewMode === 'map' && location && mapCenter && (
        <View style={[styles.mapWrap, { height: height * 0.42 }]}>
          <MapLibreMap
            style={StyleSheet.absoluteFill}
            mapStyle={getMapStyleJSON(isDark)}
          >
            <Camera
              initialViewState={{
                center: [mapCenter.longitude, mapCenter.latitude],
                zoom:   zoomFromRadiusKm(25),
              }}
            />
            {/* Native location dot. */}
            <UserLocation animated />

            {/* Request pins — MapLibre uses [longitude, latitude] tuples. */}
            {filtered.map(req => (
              <MlMarker
                key={req.id}
                lngLat={[req.longitude, req.latitude]}
                anchor="center"
              >
                <Pressable onPress={() => onCardPress(req)} hitSlop={8}>
                  <View style={[styles.mapPin, { backgroundColor: theme.primary }]}>
                    <Text style={[styles.mapPinText, { color: theme.textOnPrimary }]}>
                      {req.blood_group}
                    </Text>
                  </View>
                </Pressable>
              </MlMarker>
            ))}
          </MapLibreMap>
        </View>
      )}

      {/* List */}
      <FlashList
        data={filtered}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemType={() => 'request'}
        contentContainerStyle={{
          paddingHorizontal: Spacing[5],
          paddingTop: Spacing[5],
          paddingBottom: TAB_BAR_BOTTOM_INSET + Spacing[4],
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refetch}
            tintColor="transparent"
            colors={['transparent']}
            progressBackgroundColor="transparent"
            progressViewOffset={-1000}
          />
        }
        ListEmptyComponent={
          <EmptyState
            iconName={hasFilters ? 'filter-outline' : 'search'}
            title={hasFilters ? 'No requests match those filters' : 'No requests near you'}
            description={
              hasFilters
                ? 'Widen the search or clear the filters to see more.'
                : "We'll ping you the moment a compatible request lands."
            }
            actionLabel={hasFilters ? 'Reset filters' : undefined}
            onAction={hasFilters ? clearFilters : undefined}
          />
        }
      />

      <SelectSheet
        visible={bloodVisible}
        title="Filter by blood group"
        options={bloodOptions}
        value={filterBlood}
        onSelect={(v: string) => setFilterBlood(v)}
        onClose={() => setBloodVisible(false)}
      />
      <SelectSheet
        visible={urgencyVisible}
        title="Filter by urgency"
        options={urgencyOptions}
        value={filterUrgency}
        onSelect={(v: string) => setFilterUrgency(v)}
        onClose={() => setUrgencyVisible(false)}
      />
    </View>
  );
}

const FilterChip = React.memo(function FilterChip({
  iconName, label, active, onPress, theme,
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  label: string; active: boolean; onPress: () => void; theme: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? theme.textPrimary : theme.cardElevated,
          borderColor:     active ? theme.textPrimary : theme.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons
        name={iconName}
        size={14}
        color={active ? theme.textInverse : theme.textPrimary}
      />
      <Text style={[
        styles.chipLabel,
        { color: active ? theme.textInverse : theme.textPrimary },
      ]}>{label}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: Spacing[5],
    paddingBottom: Spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing[4],
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
    marginBottom: Spacing[1],
  },
  title: {
    fontSize: FontSize['2xl'], fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.tighter,
  },
  subtitle: { fontSize: FontSize.xs, marginTop: 2, fontWeight: FontWeight.semibold },

  toggleWrap: {
    flexDirection: 'row',
    borderRadius: Radius.pill,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
  },
  toggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[1],
    borderRadius: Radius.pill,
  },
  toggleLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.snug },

  filters: { flexDirection: 'row', gap: Spacing[2], flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[2],
    borderRadius: Radius.pill, borderWidth: 1.5,
  },
  chipLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.snug },
  clearChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[2],
    borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth,
  },
  clearLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  mapWrap: {
    marginHorizontal: Spacing[4],
    marginTop: Spacing[4],
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  mapPin: {
    paddingHorizontal: Spacing[2], paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  mapPinText: {
    fontSize: FontSize.xs, fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.snug,
  },
});
