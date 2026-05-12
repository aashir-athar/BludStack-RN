// app/(tabs)/history.tsx
// Lever: identity reinforcement + peak-end. The donor sees their full record
// of saved lives in a clean timeline; the hero card affirms identity ("X
// donations · X lives helped") and the eligibility pill tells them when they
// can give again.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth, canDonateByAge } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';
import BloodGroupBadge from '@/components/BloodGroupBadge';
import EmptyState from '@/components/EmptyState';
import {
  FontSize, FontWeight, Spacing, Radius, LetterSpacing,
  TAB_BAR_BOTTOM_INSET, Elevation,
} from '@/constants/Typography';
import { timeAgo, formatDate, canDonateAgain } from '@/utils/helpers';

interface DonationRecord {
  id: string;
  status: 'accepted' | 'completed' | 'pending' | 'declined';
  created_at: string;
  blood_request: {
    id: string;
    blood_group: string;
    urgency: 'critical' | 'urgent' | 'standard';
    hospital_name: string;
    hospital_address: string;
    status: string;
    created_at: string;
  } | null;
}

export default function HistoryScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const router = useRouter();

  const [records, setRecords] = useState<DonationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const { canDonate, daysLeft } = canDonateAgain(profile?.last_donation_date ?? null);
  const ageOk = canDonateByAge(profile?.date_of_birth ?? null);

  const fetchHistory = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('request_responses')
        .select(`
          id, status, created_at,
          blood_request:blood_requests!request_id (
            id, blood_group, urgency,
            hospital_name, hospital_address,
            status, created_at
          )
        `)
        .eq('donor_id', profile.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRecords((data as any[]) ?? []);
    } catch (e: any) {
      console.warn('[history]', e?.message);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const completedCount = useMemo(
    () => records.filter(r => r.status === 'completed').length,
    [records],
  );
  // 1 donor = 1 unit = 1 life.
  const livesHelped = completedCount;

  const onRowPress = useCallback((id: string) => {
    Haptics.selectionAsync().catch(() => {});
    router.push({ pathname: '/request/[id]', params: { id } });
  }, [router]);

  const goFindRequests = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    router.push('/(tabs)/donors');
  }, [router]);

  const renderItem = useCallback(({ item }: { item: DonationRecord }) => {
    const req = item.blood_request;
    if (!req) return null;

    const statusMeta = (() => {
      switch (item.status) {
        case 'completed': return { label: 'Donated',  iconName: 'checkmark-circle' as const, tone: theme.success };
        case 'accepted':  return { label: 'En route', iconName: 'navigate'         as const, tone: theme.primary };
        case 'pending':   return { label: 'Pending',  iconName: 'time-outline'     as const, tone: theme.warning };
        case 'declined':  return { label: 'Declined', iconName: 'close-circle'     as const, tone: theme.textMuted };
        default: return { label: item.status, iconName: 'ellipsis-horizontal' as const, tone: theme.textMuted };
      }
    })();

    const urgencyTone =
      req.urgency === 'critical' ? theme.danger
      : req.urgency === 'urgent'   ? theme.warning
      :                              theme.success;

    return (
      <Pressable
        onPress={() => onRowPress(req.id)}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
            opacity: pressed ? 0.96 : 1,
          },
          Elevation.xs,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${statusMeta.label} at ${req.hospital_name}`}
      >
        <View style={[styles.stripe, { backgroundColor: urgencyTone }]} />
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <BloodGroupBadge bloodGroup={req.blood_group} size="md" variant="soft" />
            <View style={styles.rowMeta}>
              <Text style={[styles.hospital, { color: theme.textPrimary }]} numberOfLines={1}>
                {req.hospital_name}
              </Text>
              <Text style={[styles.addr, { color: theme.textMuted }]} numberOfLines={1}>
                {req.hospital_address}
              </Text>
              <Text style={[styles.time, { color: theme.textTertiary }]}>{timeAgo(item.created_at)}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: statusMeta.tone + '1F', borderColor: statusMeta.tone }]}>
              <Ionicons name={statusMeta.iconName} size={12} color={statusMeta.tone} />
              <Text style={[styles.statusText, { color: statusMeta.tone }]}>{statusMeta.label}</Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  }, [theme, onRowPress]);

  const keyExtractor = useCallback((item: DonationRecord) => item.id, []);

  const Header = useMemo(() => (
    <View style={{ gap: Spacing[4], paddingTop: Spacing[4] }}>
      {/* Hero stats */}
      <View style={[styles.statsCard, { backgroundColor: theme.card, borderColor: theme.border }, Elevation.xs]}>
        <StatCell value={String(profile?.total_donations ?? 0)} label="Donations"   color={theme.primary}   theme={theme} />
        <View style={[styles.statDiv, { backgroundColor: theme.divider }]} />
        <StatCell value={String(livesHelped)}                    label="Lives helped" color={theme.success}   theme={theme} />
        <View style={[styles.statDiv, { backgroundColor: theme.divider }]} />
        <StatCell
          value={profile?.last_donation_date ? formatDate(profile.last_donation_date) : '—'}
          label="Last donated"
          color={theme.textPrimary}
          theme={theme}
          small
        />
      </View>

      {/* Eligibility */}
      <View
        style={[
          styles.eligibilityCard,
          {
            backgroundColor: canDonate && ageOk ? theme.successSoft : theme.warningSoft,
            borderColor:     canDonate && ageOk ? theme.success     : theme.warning,
          },
        ]}
      >
        <View
          style={[
            styles.eligIconWrap,
            { backgroundColor: canDonate && ageOk ? theme.success : theme.warning },
          ]}
        >
          <Ionicons
            name={canDonate && ageOk ? 'checkmark' : 'time'}
            size={18}
            color={theme.textOnPrimary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eligTitle, { color: canDonate && ageOk ? theme.success : theme.warning }]}>
            {!ageOk
              ? 'Donors must be 18 or older'
              : canDonate
                ? "You're eligible to donate now"
                : `Eligible again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
          </Text>
          <Text style={[styles.eligSub, { color: theme.textMuted }]}>
            {!ageOk
              ? 'Update your date of birth in profile if this is wrong.'
              : canDonate
                ? 'Browse nearby requests to help someone today.'
                : '90-day cooldown protects your health.'}
          </Text>
        </View>
      </View>

      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Timeline · Your donations</Text>
    </View>
  ), [theme, profile?.total_donations, profile?.last_donation_date, livesHelped, canDonate, ageOk, daysLeft]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Impact · Lives helped</Text>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Your impact</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>Every donation, every life helped.</Text>
      </View>

      <FlashList
        data={records}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={Header}
        getItemType={() => 'history'}
        contentContainerStyle={{
          paddingHorizontal: Spacing[5],
          paddingBottom: TAB_BAR_BOTTOM_INSET + Spacing[4],
        }}
        ItemSeparatorComponent={() => <View style={{ height: Spacing[3] }} />}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={fetchHistory}
            tintColor="transparent"
            colors={['transparent']}
            progressBackgroundColor="transparent"
            progressViewOffset={-1000}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              iconName="heart-outline"
              title="No donations yet"
              description="The first one matters most. Browse compatible requests near you and accept one."
              actionLabel="Find requests near you"
              onAction={goFindRequests}
            />
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const StatCell = React.memo(function StatCell({
  value, label, color, theme, small,
}: { value: string; label: string; color: string; theme: any; small?: boolean }) {
  return (
    <View style={styles.statCell}>
      <Text
        style={[
          styles.statValue,
          { color, fontSize: small ? FontSize.sm : FontSize.xl },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[4],
    paddingBottom: Spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
    marginBottom: Spacing[1],
  },
  title:    { fontSize: FontSize['2xl'], fontWeight: FontWeight.black, letterSpacing: LetterSpacing.tighter },
  subtitle: { fontSize: FontSize.sm, marginTop: 2, fontWeight: FontWeight.semibold },

  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing[4],
  },
  statCell:  { flex: 1, alignItems: 'center', gap: 3, paddingHorizontal: Spacing[2] },
  statValue: {
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.tight,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: FontSize['2xs'],
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  statDiv: { width: StyleSheet.hairlineWidth, height: 36 },

  eligibilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    padding: Spacing[4],
    borderRadius: Radius.xl,
    borderWidth: 1.5,
  },
  eligIconWrap: {
    width: 36, height: 36, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  eligTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.snug },
  eligSub:   { fontSize: FontSize.xs, marginTop: 2, lineHeight: FontSize.xs * 1.5 },

  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.tight,
    marginTop: Spacing[2],
  },

  row: {
    flexDirection: 'row',
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  stripe: { width: 4, flexShrink: 0 },
  rowBody: { flex: 1, padding: Spacing[4] },
  rowTop:  { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3] },
  rowMeta: { flex: 1, gap: 3 },
  hospital:{ fontSize: FontSize.sm, fontWeight: FontWeight.black, letterSpacing: LetterSpacing.snug },
  addr:    { fontSize: FontSize.xs },
  time:    { fontSize: FontSize.xs },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing[2], paddingVertical: 4,
    borderRadius: Radius.pill, borderWidth: 1, alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: FontSize['2xs'], fontWeight: FontWeight.black,
    textTransform: 'uppercase', letterSpacing: LetterSpacing.widest,
  },
});
