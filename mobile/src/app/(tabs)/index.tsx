// Lever: scent of urgency (critical pinned first) + Fitts's Law on Accept +
// identity ("your blood, near you, now"). Every cell memoized, callbacks stable.
import React, { useCallback, useMemo } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/stores/themeStore';
import { useAuth } from '@/stores/authStore';
import { useToast } from '@/stores/toastStore';
import { useLocation } from '@/hooks/useLocation';
import { useRequests } from '@/queries/requests';
import { useAcceptRequest, useDeclineRequest } from '@/queries/donations';
import { useCommunityStats } from '@/queries/stats';
import { COMPATIBILITY_MAP, type BloodGroup } from '@/constants/BloodData';
import { Spacing } from '@/constants/Typography';
import { Text, StatsBanner, RequestCard, EmptyState, type RequestCardData } from '@/ui';

const URGENCY_RANK: Record<string, number> = { critical: 0, urgent: 1, standard: 2 };

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function HomeScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const toast = useToast();
  const { location } = useLocation(true);
  const stats = useCommunityStats();
  const acceptM = useAcceptRequest();
  const declineM = useDeclineRequest();

  const query = useMemo(
    () => (location ? { lat: location.latitude, lon: location.longitude, radiusKm: 50 } : {}),
    [location],
  );
  const { data, refetch, isRefetching } = useRequests(query, !!location);

  // Plain derivation; the React Compiler memoizes it (manual useMemo here could
  // not be preserved by the compiler).
  const canDonateTo = profile?.blood_group ? COMPATIBILITY_MAP[profile.blood_group as BloodGroup] ?? [] : [];
  const compatible = ((data?.requests ?? []) as RequestCardData[])
    .filter((r) => canDonateTo.includes(r.blood_group as BloodGroup))
    .toSorted((a, b) => (URGENCY_RANK[a.urgency] ?? 3) - (URGENCY_RANK[b.urgency] ?? 3));

  const onAccept = useCallback((id: string) => {
    acceptM.mutate(id, {
      onSuccess: () => toast.success("You're on the way", { description: 'Head to the hospital as soon as you can.' }),
      onError: (e) => toast.error("Couldn't accept", { description: e instanceof Error ? e.message : 'Check your connection and tap again.' }),
    });
  }, [acceptM, toast]);

  const onDecline = useCallback((id: string) => { declineM.mutate(id); }, [declineM]);

  const renderItem = useCallback(({ item }: { item: RequestCardData }) => (
    <RequestCard
      request={item}
      onPress={() => router.push({ pathname: '/request/[id]', params: { id: item.id } })}
      showActions
      onAccept={() => onAccept(item.id)}
      onDecline={() => onDecline(item.id)}
      accepting={acceptM.isPending && acceptM.variables === item.id}
    />
  ), [router, onAccept, onDecline, acceptM.isPending, acceptM.variables]);

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';
  const s = stats.data as { total_donations?: number; active_donors?: number; lives_helped?: number } | undefined;

  const Header = (
    <View style={{ gap: Spacing[5], marginBottom: Spacing[5] }}>
      <View style={{ gap: 2 }}>
        <Text variant="overline" tone="muted">{greeting()}</Text>
        <Text variant="headline">{firstName}</Text>
      </View>
      <StatsBanner
        donations={s?.total_donations ?? 0}
        donors={s?.active_donors ?? 0}
        livesHelped={s?.lives_helped ?? 0}
        loading={stats.isLoading}
      />
      {compatible.length > 0 ? (
        <Text variant="overline" tone="muted" style={{ marginLeft: Spacing[2] }}>Compatible requests near you</Text>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={{ paddingTop: insets.top + Spacing[4], paddingHorizontal: Spacing[5], paddingBottom: Spacing[2] }}>
        <Text variant="overline" tone="muted">Home</Text>
      </View>
      <FlashList
        data={compatible}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={Header}
        ItemSeparatorComponent={() => <View style={{ height: Spacing[3] }} />}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: Spacing[5], paddingTop: Spacing[4], paddingBottom: Spacing[8] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
        ListEmptyComponent={
          !location ? null : (
            <EmptyState
              brand
              title="All quiet for now"
              body="We will ping you the moment a compatible request lands near you. Keep your availability on."
              actionLabel="Update availability"
              onAction={() => router.push('/(tabs)/profile')}
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
