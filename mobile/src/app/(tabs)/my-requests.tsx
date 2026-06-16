// Lever: control + closure. The recipient sees every request they posted,
// filtered by status; each taps through to the detail modal to manage donors.
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/stores/themeStore';
import { useMyRequests } from '@/queries/requests';
import { Spacing, Radius, FontWeight, Elevation } from '@/constants/Typography';
import { Text, RequestCard, EmptyState, type RequestCardData } from '@/ui';

type Filter = 'all' | 'active' | 'fulfilled' | 'cancelled';
const FILTERS: readonly { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Fulfilled', value: 'fulfilled' },
  { label: 'Cancelled', value: 'cancelled' },
];

export default function MyRequestsScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, refetch, isRefetching } = useMyRequests();
  const [filter, setFilter] = useState<Filter>('all');

  const requests = useMemo(() => (data ?? []) as RequestCardData[], [data]);
  const filtered = useMemo(
    () => (filter === 'all' ? requests : requests.filter((r) => r.status === filter)),
    [requests, filter],
  );

  const onFilter = useCallback((value: Filter) => { void Haptics.selectionAsync(); setFilter(value); }, []);
  const newRequest = useCallback(() => { void Haptics.selectionAsync(); router.push('/(tabs)/request'); }, [router]);

  const renderItem = useCallback(({ item }: { item: RequestCardData }) => (
    <RequestCard request={item} onPress={() => router.push({ pathname: '/request/[id]', params: { id: item.id } })} />
  ), [router]);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing[4], backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[3] }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="overline" tone="muted">Control . Your posts</Text>
            <Text variant="headline">Your requests</Text>
            <Text variant="caption" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
              {requests.length} {requests.length === 1 ? 'request' : 'requests'} total
            </Text>
          </View>
          <Pressable
            onPress={newRequest}
            accessibilityRole="button"
            accessibilityLabel="Post a new request"
            style={[{ flexDirection: 'row', alignItems: 'center', gap: Spacing[1], paddingHorizontal: Spacing[4], paddingVertical: Spacing[2], borderRadius: Radius.pill, borderCurve: 'continuous', backgroundColor: theme.primary }, Elevation.sm]}
          >
            <Ionicons name="add" size={16} color={theme.textOnPrimary} />
            <Text variant="label" style={{ color: theme.textOnPrimary, fontWeight: FontWeight.black }}>New</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: Spacing[2] }}>
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <Pressable
                key={f.value}
                onPress={() => onFilter(f.value)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={f.label}
                style={{ paddingHorizontal: Spacing[3], paddingVertical: Spacing[2], borderRadius: Radius.pill, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth, backgroundColor: active ? theme.textPrimary : theme.cardElevated, borderColor: active ? theme.textPrimary : theme.border }}
              >
                <Text variant="labelSm" style={{ color: active ? theme.textInverse : theme.textPrimary }}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlashList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: Spacing[5], paddingTop: Spacing[5], paddingBottom: Spacing[8] }}
        ItemSeparatorComponent={() => <View style={{ height: Spacing[3] }} />}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
        ListEmptyComponent={
          <EmptyState
            icon={filter === 'all' ? 'document-text-outline' : 'filter-outline'}
            title={filter === 'all' ? 'No requests yet' : `No ${filter} requests`}
            body={filter === 'all'
              ? 'Post one and matched donors near the hospital are notified in seconds.'
              : 'Switch the filter above to see your other requests.'}
            actionLabel={filter === 'all' ? 'Post a request' : undefined}
            onAction={filter === 'all' ? newRequest : undefined}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: Spacing[5], paddingBottom: Spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth, gap: Spacing[4],
  },
});
