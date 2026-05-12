// app/(tabs)/my-requests.tsx
// Lever: control + closure. The recipient sees every request they've posted,
// filtered by status. Each card taps through to the full detail modal where
// they manage accepted donors / completions / cancellation.

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { useMyRequests, type BloodRequest } from '@/hooks/useRequests';
import RequestCard from '@/components/RequestCard';
import EmptyState from '@/components/EmptyState';
import {
  FontSize, FontWeight, Spacing, Radius, LetterSpacing,
  TAB_BAR_BOTTOM_INSET, Elevation,
} from '@/constants/Typography';

type Filter = 'all' | 'active' | 'fulfilled' | 'cancelled';

const FILTERS: ReadonlyArray<{ label: string; value: Filter }> = [
  { label: 'All',       value: 'all' },
  { label: 'Active',    value: 'active' },
  { label: 'Fulfilled', value: 'fulfilled' },
  { label: 'Cancelled', value: 'cancelled' },
] as const;

export default function MyRequestsScreen() {
  const { theme } = useTheme();
  const insets    = useSafeAreaInsets();
  const router    = useRouter();
  const { requests, loading, refetch } = useMyRequests();
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(
    () => filter === 'all' ? requests : requests.filter(r => r.status === filter),
    [requests, filter],
  );

  const onCardPress = useCallback((r: BloodRequest) => {
    Haptics.selectionAsync().catch(() => {});
    router.push(`/request/${r.id}` as any);
  }, [router]);

  const onFilter = useCallback((value: Filter) => {
    Haptics.selectionAsync().catch(() => {});
    setFilter(value);
  }, []);

  const renderItem = useCallback(({ item }: { item: BloodRequest }) => (
    <RequestCard request={item} onPress={onCardPress} />
  ), [onCardPress]);

  const keyExtractor = useCallback((item: BloodRequest) => item.id, []);

  const newRequest = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    router.push('/(tabs)/request' as any);
  }, [router]);

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
            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Control · Your posts</Text>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Your requests</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              {requests.length} {requests.length === 1 ? 'request' : 'requests'} total
            </Text>
          </View>
          <Pressable
            onPress={newRequest}
            style={({ pressed }) => [
              styles.newBtn,
              { backgroundColor: theme.primary, opacity: pressed ? 0.92 : 1 },
              Elevation.sm,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Post a new request"
          >
            <Ionicons name="add" size={16} color={theme.textOnPrimary} />
            <Text style={[styles.newBtnLabel, { color: theme.textOnPrimary }]}>New</Text>
          </Pressable>
        </View>

        {/* Filter pills */}
        <View style={styles.filterRow}>
          {FILTERS.map(f => {
            const active = filter === f.value;
            return (
              <Pressable
                key={f.value}
                onPress={() => onFilter(f.value)}
                style={({ pressed }) => [
                  styles.pill,
                  {
                    backgroundColor: active ? theme.textPrimary : theme.cardElevated,
                    borderColor:     active ? theme.textPrimary : theme.border,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={f.label}
              >
                <Text
                  style={[
                    styles.pillLabel,
                    { color: active ? theme.textInverse : theme.textPrimary },
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

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
            iconName={filter === 'all' ? 'document-text-outline' : 'filter-outline'}
            title={filter === 'all' ? 'No requests yet' : `No ${filter} requests`}
            description={
              filter === 'all'
                ? 'Post a request and matched donors near the hospital will be notified within seconds.'
                : 'Switch the filter above to see other requests.'
            }
            actionLabel={filter === 'all' ? 'Post your first request' : undefined}
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
  subtitle: { fontSize: FontSize.xs, marginTop: 2, fontWeight: FontWeight.semibold, letterSpacing: LetterSpacing.snug },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[1],
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[2],
    borderRadius: Radius.pill,
  },
  newBtnLabel: {
    fontSize: FontSize.sm, fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.snug,
  },
  filterRow: { flexDirection: 'row', gap: Spacing[2] },
  pill: {
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.bold,
    letterSpacing: LetterSpacing.snug,
  },
});
