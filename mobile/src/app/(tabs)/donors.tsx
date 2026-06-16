// Lever: discovery, no nudge. A donor browses requests they could answer near
// them, filtered by blood group. Tap through to the request detail to accept.
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/stores/themeStore';
import { useLocation } from '@/hooks/useLocation';
import { useRequests } from '@/queries/requests';
import { BLOOD_GROUPS } from '@/constants/BloodData';
import { Spacing, Radius } from '@/constants/Typography';
import { Text, RequestCard, EmptyState, type RequestCardData } from '@/ui';

export default function DonorsScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { location, loading, error, refreshLocation } = useLocation(true);
  const [group, setGroup] = useState<string | null>(null);

  const query = useMemo(
    () => (location ? { lat: location.latitude, lon: location.longitude, radiusKm: 50, bloodGroup: group ?? undefined } : {}),
    [location, group],
  );
  const { data, refetch, isRefetching } = useRequests(query, !!location);
  const requests = useMemo(() => ((data?.requests ?? []) as RequestCardData[]), [data]);

  const renderItem = useCallback(({ item }: { item: RequestCardData }) => (
    <RequestCard request={item} onPress={() => router.push({ pathname: '/request/[id]', params: { id: item.id } })} />
  ), [router]);

  if (error && !location) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background, justifyContent: 'center', paddingTop: insets.top }]}>
        <EmptyState
          icon="location-outline"
          title="Find requests near you"
          body="Share your location to see blood requests close by. We never reveal your exact position to anyone."
          actionLabel="Enable location"
          onAction={() => { void refreshLocation(); }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={{ paddingTop: insets.top + Spacing[4], paddingHorizontal: Spacing[5], paddingBottom: Spacing[3], gap: Spacing[3], backgroundColor: theme.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }}>
        <View style={{ gap: 2 }}>
          <Text variant="overline" tone="muted">Discovery . Within 50 km</Text>
          <Text variant="headline">Find requests</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing[2] }}>
          <FilterChip label="All" active={group === null} onPress={() => { void Haptics.selectionAsync(); setGroup(null); }} />
          {BLOOD_GROUPS.map((bg) => (
            <FilterChip key={bg} label={bg} active={group === bg} onPress={() => { void Haptics.selectionAsync(); setGroup(bg); }} />
          ))}
        </ScrollView>
      </View>

      <FlashList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: Spacing[3] }} />}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: Spacing[5], paddingTop: Spacing[5], paddingBottom: Spacing[8] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
        ListEmptyComponent={
          !location || loading ? null : (
            <EmptyState
              icon="search-outline"
              title={group ? `No ${group} requests nearby` : 'All quiet nearby'}
              body={group ? 'Widen the search by clearing the filter.' : 'We will ping you the moment a compatible request lands close by.'}
              actionLabel={group ? 'Clear filter' : undefined}
              onAction={group ? () => setGroup(null) : undefined}
            />
          )
        }
      />
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={{ paddingHorizontal: Spacing[4], paddingVertical: Spacing[2], borderRadius: Radius.pill, borderCurve: 'continuous', borderWidth: 1.5, backgroundColor: active ? theme.primary : theme.surface, borderColor: active ? theme.primary : theme.border }}
    >
      <Text variant="labelSm" style={{ color: active ? theme.textOnPrimary : theme.textPrimary }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
