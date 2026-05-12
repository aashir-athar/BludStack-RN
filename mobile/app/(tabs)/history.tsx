// app/(tabs)/history.tsx
// DONOR HISTORY — Full donation record, impact stats, timeline.
//
// Issue #6: History page shows the history of donations made by the user.
// Issue #9: Only shown to donors (role = 'donor' | 'both')
// Issue #16: SafeAreaView for iOS & Android

import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList,
    TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth, canDonateByAge } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';
import BloodGroupBadge from '@/components/BloodGroupBadge';
import EmptyState from '@/components/EmptyState';
import PressableScale from '@/components/PressableScale';
import {
    FontSize, FontWeight, Spacing, Radius,
    LetterSpacing, TAB_BAR_BOTTOM_INSET,
} from '@/constants/Typography';
import { timeAgo, formatDate, canDonateAgain } from '@/utils/helpers';

interface DonationRecord {
    id: string;
    status: 'accepted' | 'completed' | 'pending' | 'declined';
    created_at: string;
    blood_request: {
        id: string;
        blood_group: string;
        urgency: string;
        hospital_name: string;
        hospital_address: string;
        status: string;
        created_at: string;
    } | null;
}

const URGENCY_COLOR: Record<string, string> = {
    critical: '#E8002D',
    urgent: '#F5A623',
    standard: '#00A651',
};

const STATUS_CFG: Record<string, { label: string; color: string }> = {
    completed: { label: 'Donated ✓', color: '#00A651' },
    accepted: { label: 'En Route', color: '#2196F3' },
    pending: { label: 'Pending', color: '#F5A623' },
    declined: { label: 'Declined', color: '#9B9B9B' },
};

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
            console.warn('[history]', e.message);
        } finally {
            setLoading(false);
        }
    }, [profile?.id]);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    const completedCount = records.filter(r => r.status === 'completed').length;
    const livesHelped = completedCount * 3;

    const renderItem = useCallback(({ item }: { item: DonationRecord }) => {
        const req = item.blood_request;
        if (!req) return null;
        const st = STATUS_CFG[item.status] ?? { label: item.status, color: theme.textMuted };
        const uc = URGENCY_COLOR[req.urgency] ?? '#E8002D';
        return (
            <TouchableOpacity onPress={() => router.push(`/request/${req.id}`)} activeOpacity={0.75}>
                <View style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    {/* Left urgency stripe */}
                    <View style={[styles.stripe, { backgroundColor: uc }]} />
                    <View style={styles.rowBody}>
                        <View style={styles.rowTop}>
                            <BloodGroupBadge bloodGroup={req.blood_group} size="md" inverted />
                            <View style={styles.rowMeta}>
                                <Text style={[styles.hospital, { color: theme.textPrimary }]} numberOfLines={1}>
                                    {req.hospital_name}
                                </Text>
                                <Text style={[styles.addr, { color: theme.textSecondary }]} numberOfLines={1}>
                                    {req.hospital_address}
                                </Text>
                                <Text style={[styles.time, { color: theme.textMuted }]}>
                                    {timeAgo(item.created_at)}
                                </Text>
                            </View>
                            <View style={[styles.statusPill, { backgroundColor: `${st.color}18`, borderColor: `${st.color}40` }]}>
                                <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    }, [theme, router]);

    const keyExtractor = useCallback((item: DonationRecord) => item.id, []);

    const ListHeader = (
        <View style={styles.listHeader}>
            {/* Impact stats */}
            <View style={[styles.statsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <StatCell value={String(profile?.total_donations ?? 0)} label="DONATIONS" color={theme.primary} theme={theme} />
                <View style={[styles.statDiv, { backgroundColor: theme.border }]} />
                <StatCell value={String(livesHelped)} label="LIVES HELPED" color={theme.success} theme={theme} />
                <View style={[styles.statDiv, { backgroundColor: theme.border }]} />
                <StatCell
                    value={profile?.last_donation_date ? formatDate(profile.last_donation_date) : '—'}
                    label="LAST DONATED"
                    color={theme.textPrimary}
                    theme={theme}
                    small
                />
            </View>

            {/* Next eligibility */}
            <View style={[styles.eligibilityCard, {
                backgroundColor: canDonate && ageOk ? `${theme.success}10` : `${theme.warning}10`,
                borderColor: canDonate && ageOk ? `${theme.success}25` : `${theme.warning}25`,
            }]}>
                <Ionicons
                  name={canDonate && ageOk ? 'checkmark-circle' : 'time-outline'}
                  size={22}
                  color={canDonate && ageOk ? theme.success : theme.warning}
                />
                <View style={{ flex: 1 }}>
                    <Text style={[styles.eligTitle, { color: canDonate && ageOk ? theme.success : theme.warning }]}>
                        {!ageOk
                            ? 'Age requirement not met (18+)'
                            : canDonate
                                ? 'You are eligible to donate now'
                                : `Next donation in ${daysLeft} days`}
                    </Text>
                    <Text style={[styles.eligSub, { color: theme.textMuted }]}>
                        {!ageOk
                            ? 'Blood donors must be 18 or older'
                            : canDonate
                                ? 'Help someone who needs your blood today'
                                : `90-day waiting period after donation`}
                    </Text>
                </View>
            </View>

            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                Donation History
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <View>
                    <Text style={[styles.title, { color: theme.textPrimary }]}>My Donations</Text>
                    <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                        Your full donation record
                    </Text>
                </View>
            </View>

            <FlatList
                data={records}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                ListHeaderComponent={ListHeader}
                contentContainerStyle={[styles.list, { paddingBottom: TAB_BAR_BOTTOM_INSET + Spacing[4] }]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={loading}
                        onRefresh={fetchHistory}
                        tintColor={theme.textMuted}
                        colors={[theme.primary]}
                    />
                }
                ListEmptyComponent={
                    !loading ? (
                        <EmptyState
                            icon="🩸"
                            title="No donations yet"
                            description="When you accept and complete a blood donation request, it will appear here."
                            actionLabel="Find Requests"
                            onAction={() => router.push('/(tabs)/donors')}
                        />
                    ) : null
                }
            />
        </SafeAreaView>
    );
}

function StatCell({ value, label, color, theme, small }: {
    value: string; label: string; color: string; theme: any; small?: boolean;
}) {
    return (
        <View style={styles.statCell}>
            <Text style={[styles.statValue, { color, fontSize: small ? FontSize.sm : FontSize.xl }]}>{value}</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
        paddingHorizontal: Spacing[5], paddingTop: Spacing[4], paddingBottom: Spacing[3],
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    title: { fontSize: FontSize.xl, fontWeight: FontWeight.black, letterSpacing: LetterSpacing.snug },
    subtitle: { fontSize: FontSize.sm, marginTop: 2 },
    listHeader: { gap: Spacing[4], paddingTop: Spacing[4] },
    list: { paddingHorizontal: Spacing[5], gap: Spacing[3] },

    statsCard: {
        flexDirection: 'row', alignItems: 'center',
        borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth,
        paddingVertical: Spacing[4],
    },
    statCell: { flex: 1, alignItems: 'center', gap: 3 },
    statValue: { fontWeight: FontWeight.black, letterSpacing: LetterSpacing.tight },
    statLabel: { fontSize: FontSize['2xs'], fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.widest, textTransform: 'uppercase', textAlign: 'center' },
    statDiv: { width: StyleSheet.hairlineWidth, height: 32 },

    eligibilityCard: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
        padding: Spacing[4], borderRadius: Radius.md, borderWidth: 1,
    },
    eligTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
    eligSub: { fontSize: FontSize.xs, marginTop: 2 },

    sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.black, letterSpacing: LetterSpacing.snug },

    row: {
        flexDirection: 'row', borderRadius: Radius.md,
        borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden',
    },
    stripe: { width: 4, flexShrink: 0 },
    rowBody: { flex: 1, padding: Spacing[4] },
    rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3] },
    rowMeta: { flex: 1, gap: 3 },
    hospital: { fontSize: FontSize.sm, fontWeight: FontWeight.black, letterSpacing: LetterSpacing.snug },
    addr: { fontSize: FontSize.xs },
    time: { fontSize: FontSize.xs },
    statusPill: {
        paddingHorizontal: Spacing[2], paddingVertical: 3,
        borderRadius: Radius.full, borderWidth: 1, alignSelf: 'flex-start',
    },
    statusText: { fontSize: FontSize['2xs'], fontWeight: FontWeight.black, textTransform: 'uppercase', letterSpacing: LetterSpacing.wide },
});