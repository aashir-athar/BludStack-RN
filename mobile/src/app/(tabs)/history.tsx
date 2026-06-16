// Lever: identity reinforcement + peak-end. "You saved N lives" framed from the
// donor's own track record. One donation = one unit = one life (no inflation).
import React, { useCallback, useMemo } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/stores/themeStore';
import { useAuth } from '@/stores/authStore';
import { useDonationHistory } from '@/queries/donations';
import { computeAge, DONOR_MIN_AGE, DONOR_MAX_AGE } from '@/utils/age';
import { MIN_DONATION_GAP_DAYS } from '@/constants/BloodData';
import { Spacing } from '@/constants/Typography';
import { Text, Card, BloodGroupBadge, EmptyState, PressableScale } from '@/ui';

interface HistoryItem {
  id: string;
  status: 'accepted' | 'completed' | 'declined' | string;
  created_at: string;
  request: { id: string; blood_group: string; hospital_name: string; urgency: string } | null;
}

function eligibility(dob: string | null | undefined, lastDonation: string | null | undefined) {
  const age = computeAge(dob);
  if (age === null || age < DONOR_MIN_AGE || age > DONOR_MAX_AGE) return { label: 'Resting', tone: 'tertiary' as const };
  if (lastDonation) {
    const days = (Date.now() - new Date(lastDonation).getTime()) / 86_400_000;
    if (days < MIN_DONATION_GAP_DAYS) return { label: `${Math.ceil(MIN_DONATION_GAP_DAYS - days)}d left`, tone: 'warning' as const };
  }
  return { label: 'Available', tone: 'success' as const };
}

const STATUS_TONE: Record<string, 'success' | 'brand' | 'muted'> = {
  completed: 'success',
  accepted: 'brand',
  declined: 'muted',
};

export default function HistoryScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const { data, refetch, isRefetching } = useDonationHistory();

  const items = useMemo(() => (data ?? []) as HistoryItem[], [data]);
  const donations = profile?.total_donations ?? 0;
  const elig = eligibility(profile?.date_of_birth, profile?.last_donation_date);

  const renderItem = useCallback(({ item }: { item: HistoryItem }) => {
    if (!item.request) return null;
    const req = item.request;
    const tone = STATUS_TONE[item.status] ?? 'muted';
    return (
      <PressableScale
        onPress={() => router.push({ pathname: '/request/[id]', params: { id: req.id } })}
        accessibilityRole="button"
        accessibilityLabel={`${item.status} donation at ${req.hospital_name}`}
      >
        <Card variant="surface" style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[3] }}>
          <BloodGroupBadge group={req.blood_group} size="md" variant="soft" />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label" numberOfLines={1}>{req.hospital_name}</Text>
            <Text variant="caption" tone="muted">{new Date(item.created_at).toLocaleDateString()}</Text>
          </View>
          <Text variant="labelSm" tone={tone} style={{ textTransform: 'capitalize' }}>{item.status}</Text>
        </Card>
      </PressableScale>
    );
  }, [router]);

  const Hero = (
    <Card variant="elevated" style={{ marginBottom: Spacing[5], flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
        <Text variant="display" style={{ fontVariant: ['tabular-nums'] }}>{donations}</Text>
        <Text variant="overline" tone="muted">Donations</Text>
      </View>
      <View style={{ width: 1, height: 40, backgroundColor: theme.divider }} />
      <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
        <Text variant="display" style={{ fontVariant: ['tabular-nums'], color: theme.primary }}>{donations}</Text>
        <Text variant="overline" tone="muted">Lives helped</Text>
      </View>
      <View style={{ width: 1, height: 40, backgroundColor: theme.divider }} />
      <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[1] }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: elig.tone === 'success' ? theme.success : elig.tone === 'warning' ? theme.warning : theme.textTertiary }} />
          <Text variant="label" tone={elig.tone}>{elig.label}</Text>
        </View>
        <Text variant="overline" tone="muted">Status</Text>
      </View>
    </Card>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={{ paddingTop: insets.top + Spacing[4], paddingHorizontal: Spacing[5], paddingBottom: Spacing[2], gap: 2 }}>
        <Text variant="overline" tone="muted">Your impact</Text>
        <Text variant="headline">Your donations</Text>
      </View>
      <FlashList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={Hero}
        ItemSeparatorComponent={() => <View style={{ height: Spacing[2] }} />}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: Spacing[5], paddingTop: Spacing[4], paddingBottom: Spacing[8] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
        ListEmptyComponent={
          <EmptyState
            icon="heart-outline"
            title="No donations yet"
            body="The first one matters most. Find a request near you and step up."
            actionLabel="Find requests"
            onAction={() => router.push('/(tabs)/donors')}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
