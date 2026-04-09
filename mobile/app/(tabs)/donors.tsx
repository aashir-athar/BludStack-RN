// app/(tabs)/donors.tsx
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/hooks/useLocation';
import { useNearbyRequests, BloodRequest } from '@/hooks/useRequests';
import RequestCard from '@/components/RequestCard';
import BloodGroupBadge from '@/components/BloodGroupBadge';
import SelectSheet from '@/components/SelectSheet';
import EmptyState from '@/components/EmptyState';
import ScreenHeader from '@/components/ScreenHeader';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/Typography';
import { BLOOD_GROUPS, URGENCY_CONFIG, UrgencyLevel } from '@/constants/BloodData';
import { filterDonorsByRadius, deltaFromKm } from '@/utils/geo';
import { getBloodGroupColor } from '@/utils/helpers';

type ViewMode = 'map' | 'list';

export default function DonorsScreen() {
  const { theme, isDark } = useTheme();
  const { profile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();

  const { location, refreshLocation } = useLocation(true);
  const { requests, loading, refetch } = useNearbyRequests(
    location?.latitude ?? null,
    location?.longitude ?? null
  );

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filterBlood, setFilterBlood] = useState<string>('All');
  const [filterUrgency, setFilterUrgency] = useState<string>('All');
  const [bloodSheetVisible, setBloodSheetVisible] = useState(false);
  const [urgencySheetVisible, setUrgencySheetVisible] = useState(false);

  const bloodOptions = [{ label: 'All Blood Groups', value: 'All' }, ...BLOOD_GROUPS.map((bg) => ({ label: bg, value: bg }))];
  const urgencyOptions = [
    { label: 'All Urgency', value: 'All' },
    { label: '🚨 Critical', value: 'critical' },
    { label: '⚠️ Urgent', value: 'urgent' },
    { label: '✅ Standard', value: 'standard' },
  ];

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (filterBlood !== 'All' && r.blood_group !== filterBlood) return false;
      if (filterUrgency !== 'All' && r.urgency !== filterUrgency) return false;
      return true;
    });
  }, [requests, filterBlood, filterUrgency]);

  const mapRegion = useMemo(() => {
    if (!location) return undefined;
    return {
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: deltaFromKm(30),
      longitudeDelta: deltaFromKm(30),
    };
  }, [location]);

  const renderRequest = useCallback(({ item }: { item: BloodRequest }) => (
    <RequestCard
      request={item}
      userLat={location?.latitude}
      userLon={location?.longitude}
      onPress={(r) => router.push(`/request/${r.id}`)}
    />
  ), [location, router]);

  const keyExtractor = useCallback((item: BloodRequest) => item.id, []);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Find Requests"
        subtitle={`${filtered.length} active near you`}
        rightAction={
          <TouchableOpacity
            onPress={() => setViewMode((v) => v === 'map' ? 'list' : 'map')}
            style={[styles.viewToggle, { backgroundColor: theme.muted, borderColor: theme.border }]}
          >
            <Text style={{ color: theme.accent }}>{viewMode === 'map' ? '📋' : '🗺️'}</Text>
          </TouchableOpacity>
        }
      />

      {/* Filters */}
      <View style={[styles.filters, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => setBloodSheetVisible(true)}
          style={[styles.filterBtn, { borderColor: filterBlood !== 'All' ? theme.primary : theme.border, backgroundColor: filterBlood !== 'All' ? `${theme.primary}18` : theme.muted }]}
          activeOpacity={0.8}
        >
          {filterBlood !== 'All'
            ? <BloodGroupBadge bloodGroup={filterBlood} size="sm" />
            : <Text style={{ fontSize: 14 }}>🩸</Text>
          }
          <Text style={[styles.filterLabel, { color: filterBlood !== 'All' ? theme.primary : theme.textSecondary }]}>
            {filterBlood === 'All' ? 'Blood Group' : filterBlood}
          </Text>
          <Text style={[styles.filterCaret, { color: theme.textMuted }]}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setUrgencySheetVisible(true)}
          style={[styles.filterBtn, { borderColor: filterUrgency !== 'All' ? theme.warning : theme.border, backgroundColor: filterUrgency !== 'All' ? `${theme.warning}18` : theme.muted }]}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: 14 }}>
            {filterUrgency !== 'All' ? URGENCY_CONFIG[filterUrgency as UrgencyLevel].icon : '⚠️'}
          </Text>
          <Text style={[styles.filterLabel, { color: filterUrgency !== 'All' ? theme.warning : theme.textSecondary }]}>
            {filterUrgency === 'All' ? 'Urgency' : URGENCY_CONFIG[filterUrgency as UrgencyLevel].label}
          </Text>
          <Text style={[styles.filterCaret, { color: theme.textMuted }]}>›</Text>
        </TouchableOpacity>

        {(filterBlood !== 'All' || filterUrgency !== 'All') && (
          <TouchableOpacity
            onPress={() => { setFilterBlood('All'); setFilterUrgency('All'); }}
            style={[styles.clearBtn, { borderColor: theme.border }]}
          >
            <Text style={[styles.filterLabel, { color: theme.textMuted }]}>✕ Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Map view */}
      {viewMode === 'map' && location && (
        <MapView
          style={[styles.map, { height: height * 0.55 }]}
          provider={PROVIDER_DEFAULT}
          region={mapRegion}
          showsUserLocation
          showsMyLocationButton
          userInterfaceStyle={isDark ? 'dark' : 'light'}
        >
          {/* Geo-fence rings */}
          {[1, 5, 15].map((km) => (
            <Circle
              key={km}
              center={{ latitude: location.latitude, longitude: location.longitude }}
              radius={km * 1000}
              strokeColor={`${theme.accent}44`}
              fillColor={`${theme.accent}06`}
              strokeWidth={1}
            />
          ))}

          {/* Request markers */}
          {filtered.map((req) => (
            <Marker
              key={req.id}
              coordinate={{ latitude: req.latitude, longitude: req.longitude }}
              onPress={() => router.push(`/request/${req.id}`)}
              title={`${req.blood_group} • ${URGENCY_CONFIG[req.urgency].label}`}
              description={req.hospital_name}
            >
              <View style={[styles.marker, { backgroundColor: getBloodGroupColor(req.blood_group) }]}>
                <Text style={styles.markerText}>{req.blood_group}</Text>
              </View>
            </Marker>
          ))}
        </MapView>
      )}

      {/* List view */}
      {viewMode === 'list' ? (
        <FlatList
          data={filtered}
          keyExtractor={keyExtractor}
          renderItem={renderRequest}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Spacing[10] }]}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={loading}
          ListEmptyComponent={
            <EmptyState
              icon="🔍"
              title="No requests match your filters"
              description="Try adjusting filters or expanding your search radius."
              actionLabel="Clear filters"
              onAction={() => { setFilterBlood('All'); setFilterUrgency('All'); }}
            />
          }
        />
      ) : (
        // Below-map list in map mode
        <FlatList
          data={filtered.slice(0, 3)}
          keyExtractor={keyExtractor}
          renderItem={renderRequest}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Spacing[10] }]}
          showsVerticalScrollIndicator={false}
        />
      )}

      <SelectSheet
        visible={bloodSheetVisible}
        title="Filter by Blood Group"
        options={bloodOptions}
        selected={filterBlood}
        onSelect={setFilterBlood}
        onClose={() => setBloodSheetVisible(false)}
      />
      <SelectSheet
        visible={urgencySheetVisible}
        title="Filter by Urgency"
        options={urgencyOptions}
        selected={filterUrgency}
        onSelect={setFilterUrgency}
        onClose={() => setUrgencySheetVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1 },
  viewToggle:   { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  filters: {
    flexDirection: 'row', gap: Spacing[2],
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth, flexWrap: 'wrap',
  },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[1.5],
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[2],
    borderRadius: BorderRadius.full, borderWidth: 1,
  },
  filterLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  filterCaret: { fontSize: FontSize.xs },
  clearBtn: {
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[2],
    borderRadius: BorderRadius.full, borderWidth: 1,
  },
  map:          { width: '100%' },
  list:         { paddingHorizontal: Spacing[4], paddingTop: Spacing[3] },
  marker: {
    paddingHorizontal: Spacing[2], paddingVertical: Spacing[1],
    borderRadius: BorderRadius.base, minWidth: 36, alignItems: 'center',
  },
  markerText:   { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.black },
});
