// app/(tabs)/index.tsx
import React, { useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, useWindowDimensions, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/hooks/useLocation';
import { useNearbyRequests } from '@/hooks/useRequests';
import { useNotifications } from '@/hooks/useNotifications';
import StatsBanner from '@/components/StatsBanner';
import RequestCard from '@/components/RequestCard';
import BloodGroupBadge from '@/components/BloodGroupBadge';
import EmptyState from '@/components/EmptyState';
import {
  FontSize, FontWeight, Spacing, Radius,
  LetterSpacing, TAB_BAR_BOTTOM_INSET,
} from '@/constants/Typography';
import { DONOR_FOR_RECIPIENT } from '@/constants/BloodData';
import { canDonateAgain } from '@/utils/helpers';

export default function HomeScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const { location, loading: locLoading, refreshLocation } = useLocation(true);
  const { requests, loading: reqLoading, refetch } = useNearbyRequests(
    location?.latitude ?? null,
    location?.longitude ?? null,
  );
  useNotifications();

  const { canDonate, daysLeft } = canDonateAgain(profile?.last_donation_date ?? null);

  // Filter to blood-compatible requests
  const compatible = useMemo(() => {
    if (!profile?.blood_group) return requests;
    const map = DONOR_FOR_RECIPIENT;
    return requests.filter(r =>
      (map[r.blood_group as keyof typeof map] ?? [])
        .includes(profile.blood_group as any)
    );
  }, [requests, profile?.blood_group]);

  const criticalCount = compatible.filter(r => r.urgency === 'critical').length;

  const onRefresh = useCallback(async () => {
    await Promise.all([refreshLocation(), refetch()]);
  }, [refreshLocation, refetch]);

  const hour      = new Date().getHours();
  const greeting  = hour < 5 ? 'Still up?' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = profile?.full_name?.split(' ')[0] ?? '';

  const available      = profile?.is_available_to_donate && canDonate;
  const statusColor    = available ? '#00A651' : theme.warning;

  // Psychology: show different CTAs based on state
  const heroMessage = criticalCount > 0
    ? `${criticalCount} critical request${criticalCount === 1 ? '' : 's'} near you`
    : compatible.length > 0
    ? `${compatible.length} ${profile?.blood_group ?? ''} compatible request${compatible.length === 1 ? '' : 's'} nearby`
    : `You're all caught up`;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing[5], paddingBottom: TAB_BAR_BOTTOM_INSET + Spacing[4] },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={locLoading || reqLoading}
          onRefresh={onRefresh}
          tintColor={theme.textMuted}
          colors={[theme.primary]}
        />
      }
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: theme.textMuted }]}>
            {greeting}{firstName ? `, ${firstName}` : ''}
          </Text>
          {/* Hero message — urgency / social proof */}
          <Text style={[
            styles.heroMsg,
            {
              color: criticalCount > 0 ? theme.primary : theme.textPrimary,
              fontSize: criticalCount > 0 ? FontSize['2xl'] : FontSize.xl,
            },
          ]} numberOfLines={2}>
            {heroMessage}
          </Text>
        </View>
        {profile?.blood_group && (
          <BloodGroupBadge bloodGroup={profile.blood_group} size="xl" inverted />
        )}
      </View>

      {/* ── Availability strip ── */}
      {profile && (
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/profile')}
          style={[styles.availStrip, { backgroundColor: theme.card, borderColor: theme.border }]}
          activeOpacity={0.8}
        >
          <View style={[styles.availDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.availText, { color: theme.textPrimary }]} numberOfLines={1}>
            {available
              ? 'You are available to donate'
              : daysLeft > 0
              ? `Next eligible donation in ${daysLeft} days`
              : 'Donations paused — tap to update'}
          </Text>
          <Text style={[styles.availCount, { color: theme.textMuted }]}>
            {profile.total_donations} donations ›
          </Text>
        </TouchableOpacity>
      )}

      {/* ── Quick action cards ── */}
      <View style={styles.qaRow}>
        {/* PRIMARY — need blood (high contrast, full red) */}
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/request')}
          style={[styles.qaCard, styles.qaCardPrimary, { backgroundColor: theme.primary }]}
          activeOpacity={0.82}
        >
          <Text style={styles.qaEmoji}>🆘</Text>
          <Text style={styles.qaTitleWhite}>Need Blood</Text>
          <Text style={styles.qaSubWhite}>Post emergency request</Text>
          <View style={styles.qaArrow}>
            <Text style={styles.qaArrowText}>→</Text>
          </View>
        </TouchableOpacity>

        {/* SECONDARY — find & donate */}
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/donors')}
          style={[styles.qaCard, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth }]}
          activeOpacity={0.82}
        >
          <Text style={styles.qaEmoji}>🗺️</Text>
          <Text style={[styles.qaTitle, { color: theme.textPrimary }]}>Find & Donate</Text>
          <Text style={[styles.qaSub, { color: theme.textSecondary }]}>Browse requests nearby</Text>
          <View style={styles.qaArrow}>
            <Text style={[styles.qaArrowText, { color: theme.textMuted }]}>→</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Community stats (social proof) ── */}
      <StatsBanner />

      {/* ── Critical requests pinned at top (urgency + scarcity) ── */}
      {criticalCount > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.criticalBadge, { backgroundColor: `${theme.primary}15`, borderColor: `${theme.primary}30` }]}>
              <Text style={[styles.criticalBadgeText, { color: theme.primary }]}>
                🚨 CRITICAL — NEEDS IMMEDIATE RESPONSE
              </Text>
            </View>
          </View>
          {compatible
            .filter(r => r.urgency === 'critical')
            .map(req => (
              <RequestCard
                key={req.id}
                request={req}
                userLat={location?.latitude}
                userLon={location?.longitude}
                onPress={r => router.push(`/request/${r.id}`)}
                showActions
                onAccept={r => router.push(`/request/${r.id}`)}
              />
            ))}
        </View>
      )}

      {/* ── All compatible requests ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            Nearby Requests
          </Text>
          {compatible.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: theme.primaryMuted }]}>
              <Text style={[styles.countText, { color: theme.primary }]}>
                {compatible.length}
              </Text>
            </View>
          )}
        </View>

        {compatible.length === 0 ? (
          <EmptyState
            icon="📍"
            title="No compatible requests nearby"
            description="When someone nearby needs blood compatible with yours, you'll see it here in real time."
          />
        ) : (
          <>
            {compatible
              .filter(r => r.urgency !== 'critical') // critical already shown above
              .slice(0, 6)
              .map(req => (
                <RequestCard
                  key={req.id}
                  request={req}
                  userLat={location?.latitude}
                  userLon={location?.longitude}
                  onPress={r => router.push(`/request/${r.id}`)}
                  showActions
                  onAccept={r => router.push(`/request/${r.id}`)}
                />
              ))}

            {compatible.length > 6 && (
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/donors')}
                style={[styles.seeAllBtn, { borderColor: theme.border }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.seeAllText, { color: theme.textPrimary }]}>
                  See all {compatible.length} requests  →
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1 },
  content: { paddingHorizontal: Spacing[5], gap: Spacing[5] },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: Spacing[4],
  },
  greeting: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, marginBottom: Spacing[1] },
  heroMsg:  {
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.tight,
    lineHeight: FontSize['2xl'] * 1.1,
  },

  availStrip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[4], borderRadius: Radius.sm, borderWidth: StyleSheet.hairlineWidth,
  },
  availDot:   { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  availText:  { flex: 1, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  availCount: { fontSize: FontSize.xs, flexShrink: 0 },

  qaRow: { flexDirection: 'row', gap: Spacing[3] },
  qaCard: {
    flex: 1, borderRadius: Radius.md, padding: Spacing[4],
    gap: Spacing[1], position: 'relative',
  },
  qaCardPrimary: {},
  qaEmoji:       { fontSize: 26, marginBottom: Spacing[1] },
  qaTitleWhite:  { fontSize: FontSize.base, fontWeight: FontWeight.black, color: '#fff', letterSpacing: LetterSpacing.snug },
  qaTitle:       { fontSize: FontSize.base, fontWeight: FontWeight.black, letterSpacing: LetterSpacing.snug },
  qaSubWhite:    { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.72)', lineHeight: 18 },
  qaSub:         { fontSize: FontSize.xs, lineHeight: 18 },
  qaArrow: {
    position: 'absolute', top: Spacing[4], right: Spacing[4],
  },
  qaArrowText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: 'rgba(255,255,255,0.7)' },

  section:       { gap: Spacing[3] },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  sectionTitle:  { fontSize: FontSize.md, fontWeight: FontWeight.black, letterSpacing: LetterSpacing.snug, flex: 1 },
  countBadge:    { paddingHorizontal: Spacing[3], paddingVertical: 3, borderRadius: Radius.full },
  countText:     { fontSize: FontSize.xs, fontWeight: FontWeight.black },

  criticalBadge: {
    flex: 1, padding: Spacing[3], borderRadius: Radius.xs, borderWidth: 1,
    alignItems: 'center',
  },
  criticalBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.black, letterSpacing: LetterSpacing.wide, textTransform: 'uppercase' },

  seeAllBtn: {
    padding: Spacing[4], borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth, alignItems: 'center',
  },
  seeAllText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});