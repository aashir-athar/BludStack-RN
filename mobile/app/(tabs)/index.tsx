// app/(tabs)/index.tsx
import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  RefreshControl,
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
import UrgencyBanner from '@/components/UrgencyBanner';
import EmptyState from '@/components/EmptyState';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/Typography';
import { APP_NAME, DONOR_FOR_RECIPIENT } from '@/constants/BloodData';
import { canDonateAgain } from '@/utils/helpers';

export default function HomeScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const { location, loading: locLoading, refreshLocation } = useLocation(true);
  const { requests, loading: reqLoading, refetch } = useNearbyRequests(
    location?.latitude ?? null,
    location?.longitude ?? null
  );
  useNotifications();

  const { canDonate, daysLeft } = canDonateAgain(profile?.last_donation_date ?? null);

  // Filter requests compatible with user's blood group (for donors)
  const compatibleRequests = React.useMemo(() => {
    if (!profile?.blood_group) return requests;
    const donorCompatible = DONOR_FOR_RECIPIENT;
    return requests.filter((r) => {
      const needed = r.blood_group as keyof typeof donorCompatible;
      return donorCompatible[needed]?.includes(profile.blood_group as any);
    });
  }, [requests, profile?.blood_group]);

  const isRefreshing = locLoading || reqLoading;

  const onRefresh = useCallback(async () => {
    await Promise.all([refreshLocation(), refetch()]);
  }, [refreshLocation, refetch]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing[4], paddingBottom: insets.bottom + Spacing[10] }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
          colors={[theme.primary]}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.greeting, { color: theme.textSecondary }]}>{greeting()},</Text>
          <Text style={[styles.name, { color: theme.textPrimary }]}>{firstName} 👋</Text>
        </View>
        {profile?.blood_group && (
          <BloodGroupBadge bloodGroup={profile.blood_group} size="lg" showGlow />
        )}
      </View>

      {/* Donation availability card */}
      {profile && (
        <Card style={[styles.availCard, { borderColor: canDonate && profile.is_available_to_donate ? `${theme.success}55` : theme.border }]}>
          <View style={styles.availRow}>
            <View style={styles.availInfo}>
              <Text style={[styles.availTitle, { color: theme.textPrimary }]}>
                {canDonate && profile.is_available_to_donate
                  ? '✅ You are available to donate'
                  : daysLeft > 0
                  ? `⏳ Next donation in ${daysLeft} days`
                  : '⏸️ Donation paused by you'}
              </Text>
              <Text style={[styles.availSub, { color: theme.textSecondary }]}>
                {profile.total_donations} lifetime donation{profile.total_donations !== 1 ? 's' : ''}
                {profile.is_verified ? ' · ✓ Verified' : ''}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/profile')}
              style={[styles.editBtn, { borderColor: theme.border }]}
            >
              <Text style={[styles.editLabel, { color: theme.accent }]}>Edit</Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}

      {/* Stats */}
      <StatsBanner />

      {/* Quick action buttons */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/request')}
          style={[styles.qaBtn, { backgroundColor: theme.primary }]}
          activeOpacity={0.82}
        >
          <Text style={styles.qaIcon}>🆘</Text>
          <Text style={[styles.qaLabel, { color: '#fff' }]}>Need Blood</Text>
          <Text style={[styles.qaSub, { color: 'rgba(255,255,255,0.75)' }]}>Post a request</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/donors')}
          style={[styles.qaBtn, { backgroundColor: theme.accent }]}
          activeOpacity={0.82}
        >
          <Text style={styles.qaIcon}>🗺️</Text>
          <Text style={[styles.qaLabel, { color: '#fff' }]}>Donate</Text>
          <Text style={[styles.qaSub, { color: 'rgba(255,255,255,0.75)' }]}>Find requests</Text>
        </TouchableOpacity>
      </View>

      {/* Nearby requests for donor */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            🩸 Nearby Requests
          </Text>
          <Text style={[styles.sectionCount, { color: theme.textMuted }]}>
            {compatibleRequests.length} compatible
          </Text>
        </View>

        {compatibleRequests.length > 0 && compatibleRequests.length <= 3 && (
          <UrgencyBanner
            donorCount={compatibleRequests.length}
            radiusKm={50}
            bloodGroup={profile?.blood_group ?? '?'}
          />
        )}

        {compatibleRequests.length === 0 ? (
          <EmptyState
            icon="🌍"
            title="No nearby requests right now"
            description="When someone in your area needs blood compatible with yours, it will appear here."
          />
        ) : (
          <>
            {compatibleRequests.slice(0, 5).map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                userLat={location?.latitude}
                userLon={location?.longitude}
                onPress={(r) => router.push(`/request/${r.id}`)}
                showActions
                onAccept={(r) => router.push(`/request/${r.id}`)}
                onDecline={() => {}} // handled in detail screen
              />
            ))}
            {compatibleRequests.length > 5 && (
              <Button
                label={`See all ${compatibleRequests.length} requests`}
                variant="outline"
                onPress={() => router.push('/(tabs)/donors')}
                fullWidth
              />
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1 },
  content: { paddingHorizontal: Spacing[4], gap: Spacing[5] },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { gap: 2 },
  greeting:   { fontSize: FontSize.sm },
  name:       { fontSize: FontSize['2xl'], fontWeight: FontWeight.black, letterSpacing: -0.5 },
  availCard:  { borderWidth: 1.5 },
  availRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  availInfo:  { flex: 1, gap: 2 },
  availTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  availSub:   { fontSize: FontSize.xs },
  editBtn:    { paddingHorizontal: Spacing[3], paddingVertical: Spacing[1.5], borderRadius: BorderRadius.full, borderWidth: 1 },
  editLabel:  { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  quickActions: { flexDirection: 'row', gap: Spacing[3] },
  qaBtn: {
    flex: 1, borderRadius: BorderRadius.xl, padding: Spacing[4],
    gap: Spacing[1], alignItems: 'center',
  },
  qaIcon:  { fontSize: 28 },
  qaLabel: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
  qaSub:   { fontSize: FontSize.xs, textAlign: 'center' },
  section:       { gap: Spacing[3] },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle:  { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  sectionCount:  { fontSize: FontSize.xs },
});
