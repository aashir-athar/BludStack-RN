// app/(tabs)/index.tsx
// Donor home. Lever: scent of urgency (Critical band pinned) + Fitts's Law
// on Accept + identity ("Your blood, near you, right now"). 120 fps target —
// every list cell is memoized, every callback is stable.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/hooks/useLocation';
import { useNearbyRequests } from '@/hooks/useRequests';
import { useNotifications } from '@/hooks/useNotifications';
import { supabase } from '@/utils/supabase';
import StatsBanner from '@/components/StatsBanner';
import RequestCard from '@/components/RequestCard';
import BloodGroupBadge from '@/components/BloodGroupBadge';
import {
  FontSize, FontWeight, Spacing, Radius, LetterSpacing,
  TAB_BAR_BOTTOM_INSET, Elevation,
} from '@/constants/Typography';
import { DONOR_FOR_RECIPIENT } from '@/constants/BloodData';
import { canDonateAgain } from '@/utils/helpers';
import type { BloodRequest } from '@/hooks/useRequests';

type Section =
  | { kind: 'critical-header'; key: string; count: number }
  | { kind: 'feed-header';     key: string; count: number }
  | { kind: 'feed-empty';      key: string }
  | { kind: 'request';         key: string; request: BloodRequest }
  | { kind: 'see-all';         key: string; total: number };

export default function HomeScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const { location, loading: locLoading, refreshLocation } = useLocation(true);
  const { requests, loading: reqLoading, refetch } = useNearbyRequests(
    location?.latitude ?? null,
    location?.longitude ?? null,
  );
  useNotifications();

  const { canDonate, daysLeft } = canDonateAgain(profile?.last_donation_date ?? null);

  // Active-commitment banner: if this donor has already accepted an active
  // request, surface a prominent pill on the home so they can return to it
  // quickly. Mirrors the server-side one-active-commitment rule enforced in
  // accept_blood_request.
  const [activeCommitment, setActiveCommitment] = useState<{
    requestId: string; hospital: string | null; bloodGroup: string | null;
  } | null>(null);

  useEffect(() => {
    if (!profile?.id) { setActiveCommitment(null); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('request_responses')
          .select('request_id, blood_requests!inner(id, status, hospital_name, blood_group)')
          .eq('donor_id', profile.id)
          .eq('status', 'accepted')
          .eq('blood_requests.status', 'active')
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (error) { console.warn('[activeCommitment]', error.message); setActiveCommitment(null); return; }
        if (!data) { setActiveCommitment(null); return; }
        const br: any = (data as any).blood_requests;
        setActiveCommitment({
          requestId: (data as any).request_id,
          hospital:  br?.hospital_name ?? null,
          bloodGroup: br?.blood_group ?? null,
        });
      } catch (e: any) {
        if (!cancelled) console.warn('[activeCommitment]', e?.message);
      }
    };
    load();

    const ch = supabase
      .channel(`home_my_resps_${profile.id}_${Date.now()}`)
      .on('postgres_changes', {
        event: '*', schema: 'public',
        table: 'request_responses',
        filter: `donor_id=eq.${profile.id}`,
      }, () => load())
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [profile?.id]);

  const compatible = useMemo(() => {
    if (!profile?.blood_group) return requests;
    return requests.filter(r =>
      (DONOR_FOR_RECIPIENT[r.blood_group as keyof typeof DONOR_FOR_RECIPIENT] ?? [])
        .includes(profile.blood_group as any),
    );
  }, [requests, profile?.blood_group]);

  const critical = useMemo(
    () => compatible.filter(r => r.urgency === 'critical'),
    [compatible],
  );
  const others = useMemo(
    () => compatible.filter(r => r.urgency !== 'critical').slice(0, 12),
    [compatible],
  );

  // Build a flat section list optimised for FlashList recycling.
  // When there are zero compatibles, we inject a `feed-empty` row right after
  // the feed-header so the user always sees a clear "nothing here yet" state
  // anchored under the section label (instead of just empty space).
  const data = useMemo<Section[]>(() => {
    const out: Section[] = [];
    if (critical.length > 0) {
      out.push({ kind: 'critical-header', key: 'crit-h', count: critical.length });
      critical.forEach(r => out.push({ kind: 'request', key: `c-${r.id}`, request: r }));
    }
    out.push({ kind: 'feed-header', key: 'feed-h', count: compatible.length });
    if (compatible.length === 0) {
      out.push({ kind: 'feed-empty', key: 'feed-empty' });
    } else {
      others.forEach(r => out.push({ kind: 'request', key: `r-${r.id}`, request: r }));
      if (compatible.length > others.length + critical.length) {
        out.push({ kind: 'see-all', key: 'see-all', total: compatible.length });
      }
    }
    return out;
  }, [critical, others, compatible]);

  const onRefresh = useCallback(async () => {
    await Promise.all([refreshLocation(), refetch()]);
  }, [refreshLocation, refetch]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 5 ? 'Still up?' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }, []);
  const firstName = profile?.full_name?.split(' ')[0] ?? '';
  const available = !!(profile?.is_available_to_donate && canDonate);

  const onRequestPress = useCallback((r: BloodRequest) => {
    Haptics.selectionAsync().catch(() => {});
    router.push(`/request/${r.id}` as any);
  }, [router]);

  const onSeeAll = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    router.push('/(tabs)/donors' as any);
  }, [router]);

  const goRequestTab = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    router.push('/(tabs)/request' as any);
  }, [router]);

  const goProfileTab = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    router.push('/(tabs)/profile' as any);
  }, [router]);

  const openCommitment = useCallback(() => {
    if (!activeCommitment) return;
    Haptics.selectionAsync().catch(() => {});
    router.push(`/request/${activeCommitment.requestId}` as any);
  }, [router, activeCommitment]);

  const renderItem = useCallback(({ item }: { item: Section }) => {
    if (item.kind === 'critical-header') {
      return (
        <View style={styles.sectionWrap}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
            Critical · {item.count} need{item.count !== 1 ? '' : 's'} you now
          </Text>
          <View style={[styles.criticalBadge, { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}>
            <Ionicons name="flash" size={14} color={theme.primary} />
            <Text style={[styles.criticalText, { color: theme.primary }]}>
              Tap a card to head over
            </Text>
          </View>
        </View>
      );
    }
    if (item.kind === 'feed-header') {
      return (
        <View style={[styles.sectionWrap, styles.feedHeader]}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted, flex: 1 }]}>
            Nearby requests
          </Text>
          {item.count > 0 && (
            <View style={[styles.countPill, { backgroundColor: theme.primarySoft }]}>
              <Text style={[styles.countText, { color: theme.primary }]}>{item.count}</Text>
            </View>
          )}
        </View>
      );
    }
    if (item.kind === 'request') {
      return (
        <View style={styles.cardWrap}>
          <RequestCard
            request={item.request}
            userLat={location?.latitude ?? null}
            userLon={location?.longitude ?? null}
            onPress={onRequestPress}
            showActions
            onAccept={onRequestPress}
          />
        </View>
      );
    }
    if (item.kind === 'feed-empty') {
      return (
        <View style={[styles.emptyCard, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>
          <View style={[styles.emptyIconWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="search" size={20} color={theme.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>All quiet near you</Text>
          <Text style={[styles.emptyBody, { color: theme.textMuted }]}>
            No compatible requests in your area right now. We'll ping you the moment one lands — stay ready.
          </Text>
        </View>
      );
    }
    return (
      <Pressable
        onPress={onSeeAll}
        style={({ pressed }) => [
          styles.seeAllBtn,
          {
            backgroundColor: theme.cardElevated,
            borderColor: theme.border,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="See all requests"
      >
        <Text style={[styles.seeAllText, { color: theme.textPrimary }]}>
          See all {item.total} requests
        </Text>
        <Ionicons name="chevron-forward" size={16} color={theme.textPrimary} />
      </Pressable>
    );
  }, [theme, location?.latitude, location?.longitude, onRequestPress, onSeeAll]);

  const keyExtractor = useCallback((it: Section) => it.key, []);

  const Header = useMemo(() => (
    <View style={[styles.headerWrap, { paddingTop: insets.top + Spacing[5] }]}>
      <View style={styles.greetingRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: theme.textMuted }]}>
            {greeting}{firstName ? `, ${firstName}` : ''}
          </Text>
          <Text style={[styles.hero, { color: theme.textPrimary }]} numberOfLines={2}>
            {activeCommitment
              ? "You're on the way — finish this donation"
              : critical.length > 0
                ? `${critical.length} critical request${critical.length === 1 ? '' : 's'} near you`
                : compatible.length > 0
                  ? `${compatible.length} compatible request${compatible.length === 1 ? '' : 's'} nearby`
                  : "All quiet. Stay ready."}
          </Text>
        </View>
        {profile?.blood_group && (
          <BloodGroupBadge bloodGroup={profile.blood_group} size="lg" variant="solid" />
        )}
      </View>

      {/* ── Active-commitment banner (Uber "ride in progress" pattern) ──── */}
      {activeCommitment && (
        <Pressable
          onPress={openCommitment}
          style={({ pressed }) => [
            styles.commitmentBanner,
            { backgroundColor: theme.primary, opacity: pressed ? 0.94 : 1 },
            Elevation.lg,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Open your active donation commitment"
        >
          <View style={styles.commitmentDotWrap}>
            <View style={[styles.commitmentDotOuter, { backgroundColor: theme.textOnPrimary + '40' }]} />
            <View style={[styles.commitmentDot,      { backgroundColor: theme.textOnPrimary }]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.commitmentLabel, { color: theme.textOnPrimary, opacity: 0.85 }]}>
              ACTIVE COMMITMENT
            </Text>
            <Text style={[styles.commitmentTitle, { color: theme.textOnPrimary }]} numberOfLines={1}>
              {activeCommitment.bloodGroup ? `${activeCommitment.bloodGroup} · ` : ''}
              {activeCommitment.hospital ?? 'Donation in progress'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.textOnPrimary} />
        </Pressable>
      )}

      <Pressable
        onPress={goProfileTab}
        style={({ pressed }) => [
          styles.availPill,
          {
            backgroundColor: theme.cardElevated,
            borderColor: theme.border,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Open profile"
      >
        <View style={[styles.availDot, { backgroundColor: available ? theme.success : theme.warning }]} />
        <Text style={[styles.availText, { color: theme.textPrimary }]} numberOfLines={1}>
          {available
            ? "You're available to donate"
            : daysLeft > 0
              ? `Eligible again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
              : 'Paused — tap to update'}
        </Text>
        <Text style={[styles.availCount, { color: theme.textMuted }]}>
          {profile?.total_donations ?? 0} donations
        </Text>
        <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
      </Pressable>

      <View style={styles.quickRow}>
        <Pressable
          onPress={goRequestTab}
          style={({ pressed }) => [
            styles.quickCard,
            { backgroundColor: theme.primary, opacity: pressed ? 0.92 : 1 },
            Elevation.sm,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Need blood — post a request"
        >
          <Ionicons name="add-circle" size={22} color={theme.textOnPrimary} />
          <Text style={[styles.quickTitle, { color: theme.textOnPrimary }]}>Need blood</Text>
          <Text style={[styles.quickSub, { color: theme.textOnPrimary, opacity: 0.85 }]}>
            Post a request
          </Text>
        </Pressable>
        <Pressable
          onPress={onSeeAll}
          style={({ pressed }) => [
            styles.quickCard,
            { backgroundColor: theme.cardElevated, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth, opacity: pressed ? 0.92 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Find requests near me"
        >
          <Ionicons name="search" size={22} color={theme.textPrimary} />
          <Text style={[styles.quickTitle, { color: theme.textPrimary }]}>Find</Text>
          <Text style={[styles.quickSub, { color: theme.textMuted }]}>
            Browse nearby
          </Text>
        </Pressable>
      </View>

      <StatsBanner />
    </View>
  ), [
    insets.top, theme, greeting, firstName, critical.length, compatible.length,
    profile?.blood_group, profile?.total_donations, available, daysLeft,
    goRequestTab, onSeeAll, goProfileTab,
    activeCommitment, openCommitment,
  ]);

  // No ListEmptyComponent: `data` always contains the feed-header (and a
  // feed-empty row when compatible is zero), so the FlashList is never
  // technically empty. The feed-empty Section kind renders the zero-state
  // card right under the section label.

  return (
    <FlashList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={Header}
      contentContainerStyle={{
        paddingHorizontal: Spacing[5],
        paddingBottom: TAB_BAR_BOTTOM_INSET + Spacing[4],
      }}
      getItemType={(it) =>
        it.kind === 'request'    ? 'card'
        : it.kind === 'see-all'  ? 'see-all'
        : it.kind === 'feed-empty' ? 'empty'
        : 'header'
      }
      refreshControl={
        // Truly silent pull-to-refresh.
        //
        // `refreshing` stays HARD-CODED to false — flipping it true while
        // data fetches makes Android allocate layout space for the
        // (invisible) indicator, causing the visible jitter the user
        // complained about. With refreshing perma-false:
        //   • The pull gesture still fires onRefresh → data is refetched.
        //   • No native spinner ever renders.
        //   • No layout space is ever reserved.
        //   • The FlashList re-renders in place when the new data lands.
        // Loading state is reflected by the data updating — no visible
        // refresh affordance at all, per project rule "no spinners".
        <RefreshControl
          refreshing={false}
          onRefresh={onRefresh}
          tintColor="transparent"
          colors={['transparent']}
          progressBackgroundColor="transparent"
          progressViewOffset={-1000}
        />
      }
      showsVerticalScrollIndicator={false}
      style={{ backgroundColor: theme.background }}
    />
  );
}

const styles = StyleSheet.create({
  headerWrap: { gap: Spacing[5], marginBottom: Spacing[5] },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing[3],
  },
  greeting: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing[1],
  },
  hero: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.tighter,
    lineHeight: FontSize['2xl'] * 1.1,
  },

  commitmentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[4],
    borderRadius: Radius.xl,
  },
  commitmentDotWrap: {
    width: 14, height: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  commitmentDotOuter: {
    position: 'absolute',
    width: 14, height: 14, borderRadius: 7,
  },
  commitmentDot: { width: 8, height: 8, borderRadius: 4 },
  commitmentLabel: {
    fontSize: FontSize['2xs'],
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
  },
  commitmentTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.snug,
    marginTop: 2,
  },

  availPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[4],
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  availDot:   { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  availText:  { flex: 1, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, letterSpacing: LetterSpacing.snug },
  availCount: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  quickRow: { flexDirection: 'row', gap: Spacing[3] },
  quickCard: {
    flex: 1,
    padding: Spacing[4],
    borderRadius: Radius.xl,
    gap: Spacing[1],
  },
  quickTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.snug,
    marginTop: Spacing[2],
  },
  quickSub: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginTop: 2 },

  sectionWrap:  { marginTop: Spacing[5], marginBottom: Spacing[2], gap: Spacing[2] },
  feedHeader:   { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
    marginLeft: Spacing[2],
  },
  countPill: {
    paddingHorizontal: Spacing[3],
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  countText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.snug,
  },

  criticalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[4],
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  criticalText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    letterSpacing: LetterSpacing.snug,
    flex: 1,
  },

  cardWrap: { marginTop: 0 },

  emptyCard: {
    alignItems: 'center',
    padding: Spacing[5],
    gap: Spacing[2],
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing[2],
  },
  emptyIconWrap: {
    width: 44, height: 44, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing[1],
  },
  emptyTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.snug,
  },
  emptyBody: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: FontSize.sm * 1.5,
    paddingHorizontal: Spacing[2],
  },

  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    paddingVertical: Spacing[4],
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing[2],
  },
  seeAllText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    letterSpacing: LetterSpacing.snug,
  },
});
