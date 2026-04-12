// app/(tabs)/my-requests.tsx
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useMyRequests, BloodRequest } from '@/hooks/useRequests';
import RequestCard from '@/components/RequestCard';
import EmptyState from '@/components/EmptyState';
import { FontSize, FontWeight, Spacing, Radius, LetterSpacing } from '@/constants/Typography';

type Filter = 'all' | 'active' | 'fulfilled' | 'cancelled';

const FILTERS: { label: string; value: Filter }[] = [
  { label: 'All',       value: 'all' },
  { label: 'Active',    value: 'active' },
  { label: 'Fulfilled', value: 'fulfilled' },
  { label: 'Cancelled', value: 'cancelled' },
];

export default function MyRequestsScreen() {
  const { theme } = useTheme();
  const insets    = useSafeAreaInsets();
  const router    = useRouter();
  const { requests, loading, refetch } = useMyRequests();
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = filter === 'all'
    ? requests
    : requests.filter(r => r.status === filter);

  const renderItem = useCallback(({ item }: { item: BloodRequest }) => (
    <RequestCard
      request={item}
      onPress={r => router.push(`/request/${r.id}`)}
    />
  ), [router]);

  const keyExtractor = useCallback((item: BloodRequest) => item.id, []);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing[5], borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: theme.textPrimary }]}>My Requests</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              {requests.length} total
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/request')}
            style={[styles.newBtn, { backgroundColor: theme.primary }]}
            activeOpacity={0.8}
          >
            <Text style={styles.newBtnLabel}>+ New</Text>
          </TouchableOpacity>
        </View>

        {/* Filter pills */}
        <View style={styles.filterRow}>
          {FILTERS.map(f => {
            const active = filter === f.value;
            return (
              <TouchableOpacity
                key={f.value}
                onPress={() => setFilter(f.value)}
                style={[styles.pill, {
                  backgroundColor: active ? theme.textPrimary : theme.card,
                  borderColor:     active ? theme.textPrimary : theme.border,
                }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillLabel, { color: active ? theme.textInverse : theme.textSecondary }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

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
            icon="📋"
            title={filter === 'all' ? 'No requests yet' : `No ${filter} requests`}
            description={filter === 'all'
              ? 'Post a blood request and we\'ll match you with compatible donors nearby.'
              : 'Try a different filter.'}
            actionLabel={filter === 'all' ? 'Post First Request' : undefined}
            onAction={filter === 'all' ? () => router.push('/(tabs)/request') : undefined}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1 },
  header:     { paddingHorizontal: Spacing[5], paddingBottom: Spacing[3], borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow:  { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing[4] },
  title:      { fontSize: FontSize.xl, fontWeight: FontWeight.black, letterSpacing: LetterSpacing.tight },
  subtitle:   { fontSize: FontSize.xs, marginTop: 2 },
  newBtn:     { paddingHorizontal: Spacing[4], paddingVertical: Spacing[2], borderRadius: Radius.xs },
  newBtnLabel:{ color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.black },
  filterRow:  { flexDirection: 'row', gap: Spacing[2] },
  pill:       { paddingHorizontal: Spacing[3], paddingVertical: Spacing[1], borderRadius: Radius.full, borderWidth: StyleSheet.hairlineWidth },
  pillLabel:  { fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.wide },
  list:       { padding: Spacing[5] },
});
