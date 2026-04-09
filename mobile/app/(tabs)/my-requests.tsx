// app/(tabs)/my-requests.tsx
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useMyRequests, BloodRequest } from '@/hooks/useRequests';
import RequestCard from '@/components/RequestCard';
import EmptyState from '@/components/EmptyState';
import ScreenHeader from '@/components/ScreenHeader';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/Typography';

type StatusFilter = 'all' | 'active' | 'fulfilled' | 'cancelled';

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: '🟢 Active', value: 'active' },
  { label: '✅ Fulfilled', value: 'fulfilled' },
  { label: '❌ Cancelled', value: 'cancelled' },
];

export default function MyRequestsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { requests, loading, refetch, cancelRequest } = useMyRequests();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filtered = statusFilter === 'all'
    ? requests
    : requests.filter((r) => r.status === statusFilter);

  const handleCancel = useCallback(async (req: BloodRequest) => {
    Alert.alert(
      'Cancel Request',
      'Are you sure you want to cancel this blood request?',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Request',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelRequest(req.id);
            } catch (e: any) {
              Alert.alert('Error', e.message ?? 'Failed to cancel');
            }
          },
        },
      ]
    );
  }, [cancelRequest]);

  const renderRequest = useCallback(({ item }: { item: BloodRequest }) => (
    <RequestCard
      request={item}
      onPress={(r) => router.push(`/request/${r.id}`)}
      showActions={false}
    />
  ), [router]);

  const keyExtractor = useCallback((item: BloodRequest) => item.id, []);

  const ListHeader = (
    <View>
      {/* Status filters */}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            onPress={() => setStatusFilter(f.value)}
            style={[
              styles.filterChip,
              {
                backgroundColor: statusFilter === f.value ? theme.primary : theme.muted,
                borderColor: statusFilter === f.value ? theme.primary : theme.border,
              },
            ]}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.filterLabel,
              { color: statusFilter === f.value ? '#fff' : theme.textSecondary },
            ]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.count, { color: theme.textMuted }]}>
        {filtered.length} request{filtered.length !== 1 ? 's' : ''}
      </Text>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="My Requests"
        subtitle="Track your blood requests"
        rightAction={
          <TouchableOpacity onPress={() => router.push('/(tabs)/request')} activeOpacity={0.8}>
            <Text style={[styles.newBtn, { color: theme.accent }]}>+ New</Text>
          </TouchableOpacity>
        }
      />

      <FlatList
        data={filtered}
        keyExtractor={keyExtractor}
        renderItem={renderRequest}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Spacing[10] }]}
        showsVerticalScrollIndicator={false}
        onRefresh={refetch}
        refreshing={loading}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <EmptyState
            icon="📋"
            title={statusFilter === 'all' ? "No requests yet" : `No ${statusFilter} requests`}
            description={statusFilter === 'all'
              ? "Post a blood request and we'll match you with compatible donors instantly."
              : "Try viewing a different status filter."}
            actionLabel={statusFilter === 'all' ? "Post First Request" : undefined}
            onAction={statusFilter === 'all' ? () => router.push('/(tabs)/request') : undefined}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1 },
  list:        { paddingHorizontal: Spacing[4], paddingTop: Spacing[2] },
  filterRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2], paddingVertical: Spacing[4] },
  filterChip: {
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[1.5],
    borderRadius: BorderRadius.full, borderWidth: 1,
  },
  filterLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  count:       { fontSize: FontSize.xs, marginBottom: Spacing[2] },
  newBtn:      { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});
