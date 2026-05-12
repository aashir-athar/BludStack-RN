// app/donor/[id].tsx
// Donor profile modal — shown when tapping a donor's card.
// Displays full profile, blood compatibility, donation history,
// active/past requests they've responded to, and contact actions.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, ScrollView, StyleSheet,
    TouchableOpacity, Alert, Linking, Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';
import { useLocation } from '@/hooks/useLocation';
import BloodGroupBadge from '@/components/BloodGroupBadge';
import Button from '@/components/Button';
import LoadingScreen from '@/components/LoadingScreen';
import { FontSize, FontWeight, Spacing, Radius, LetterSpacing } from '@/constants/Typography';
import { COMPATIBILITY_MAP, BloodGroup } from '@/constants/BloodData';
import { formatDate, canDonateAgain, timeAgo } from '@/utils/helpers';
import { haversineDistance, formatDistance, estimateDriveMinutes } from '@/utils/geo';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DonorProfile {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    blood_group: string;
    avatar_url: string | null;
    is_verified: boolean;
    is_available_to_donate: boolean;
    last_donation_date: string | null;
    total_donations: number;
    share_medical_history: boolean;
    medical_conditions: string[];
    latitude: number | null;
    longitude: number | null;
    address: string | null;
    created_at: string;
}

interface DonorResponse {
    id: string;
    status: 'pending' | 'accepted' | 'declined' | 'completed';
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const URGENCY_COLOR: Record<string, string> = {
    critical: '#E8002D',
    urgent: '#F5A623',
    standard: '#00A651',
};

const RESPONSE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pending', color: '#F5A623' },
    accepted: { label: 'Accepted', color: '#00A651' },
    declined: { label: 'Declined', color: '#9B9B9B' },
    completed: { label: 'Completed', color: '#00A651' },
};

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function DonorDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { theme, isDark } = useTheme();
    const { user, profile: myProfile } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { location } = useLocation(false);

    const [donor, setDonor] = useState<DonorProfile | null>(null);
    const [responses, setResponses] = useState<DonorResponse[]>([]);
    const [loading, setLoading] = useState(true);

    // Subtle entrance animation for the avatar
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(24)).current;

    useEffect(() => {
        if (!loading && donor) {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 340, useNativeDriver: true }),
                Animated.spring(slideAnim, { toValue: 0, speed: 14, bounciness: 4, useNativeDriver: true }),
            ]).start();
        }
    }, [loading, donor]);

    // ── Fetch donor profile ──────────────────────────────────────────────────
    const fetchDonor = useCallback(async () => {
        if (!id) return;
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', id)
                .single();
            if (error) throw error;
            setDonor(data as DonorProfile);
        } catch (e: any) {
            Alert.alert('Error', e.message ?? 'Failed to load donor profile.');
        }
    }, [id]);

    // ── Fetch donor's response history (only if viewing own profile or
    //    the donor has accepted a request where I am the recipient) ──────────
    const fetchResponses = useCallback(async () => {
        if (!id || !user?.id) return;
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
                .eq('donor_id', id)
                .in('status', ['accepted', 'completed'])
                .order('created_at', { ascending: false })
                .limit(10);
            if (error) throw error;
            setResponses((data as any[]) ?? []);
        } catch (e: any) {
            console.warn('[DonorDetail fetchResponses]', e.message);
        }
    }, [id, user?.id]);

    useEffect(() => {
        if (!id) return;
        Promise.all([fetchDonor(), fetchResponses()]).finally(() => setLoading(false));
    }, [id]);

    // ── Derived values ───────────────────────────────────────────────────────
    const isOwnProfile = user?.id === id;

    const { canDonate, daysLeft } = donor
        ? canDonateAgain(donor.last_donation_date)
        : { canDonate: false, daysLeft: 0 };

    const available = donor?.is_available_to_donate && canDonate;
    const statusColor = available ? '#00A651' : '#F5A623';

    const distance = location && donor?.latitude && donor?.longitude
        ? haversineDistance(location.latitude, location.longitude, donor.latitude, donor.longitude)
        : null;

    // Blood compatibility — can this donor donate to me?
    const myBloodGroup = myProfile?.blood_group as BloodGroup | undefined;
    const donorBloodGroup = donor?.blood_group as BloodGroup | undefined;
    const canDonateToMe = myBloodGroup && donorBloodGroup
        ? (COMPATIBILITY_MAP[donorBloodGroup] ?? []).includes(myBloodGroup)
        : null;

    const initials = donor?.full_name
        .split(' ')
        .slice(0, 2)
        .map(n => n[0]?.toUpperCase() ?? '')
        .join('') ?? '';

    // ── Contact actions ──────────────────────────────────────────────────────
    const handleCall = useCallback(() => {
        if (!donor) return;
        const target = donor.phone ?? donor.email;
        if (!target) return Alert.alert('No contact info', 'This donor has not shared contact details.');
        Linking.openURL(donor.phone ? `tel:${donor.phone}` : `mailto:${donor.email}`);
    }, [donor]);

    const handleMessage = useCallback(() => {
        if (!donor?.email) return;
        Linking.openURL(`mailto:${donor.email}`);
    }, [donor]);

    const handleOpenMap = useCallback(() => {
        if (!donor?.latitude || !donor?.longitude) return;
        Linking.openURL(
            `https://www.google.com/maps/dir/?api=1&destination=${donor.latitude},${donor.longitude}&travelmode=driving`
        );
    }, [donor]);

    // ─────────────────────────────────────────────────────────────────────────

    if (loading) return <LoadingScreen message="Loading profile…" />;
    if (!donor) return null;

    return (
        <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]}>

            {/* ── Top bar ── */}
            <View style={[styles.topBar, {
                paddingTop: insets.top + Spacing[2],
                backgroundColor: theme.surface,
                borderBottomColor: theme.border,
            }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} activeOpacity={0.7}>
                    <Text style={[styles.closeIcon, { color: theme.textPrimary }]}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.topTitle, { color: theme.textPrimary }]}>Donor Profile</Text>
                {/* Availability dot */}
                <View style={[styles.statusDotSmall, { backgroundColor: statusColor }]} />
            </View>

            <ScrollView
                contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing[10] }]}
                showsVerticalScrollIndicator={false}
            >

                {/* ── Hero card ── */}
                <Animated.View style={[
                    styles.heroCard,
                    { backgroundColor: theme.card, borderColor: theme.border },
                    { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
                ]}>
                    {/* Avatar */}
                    <View style={styles.avatarRow}>
                        <View style={[styles.avatarRing, { borderColor: statusColor }]}>
                            {donor.avatar_url ? (
                                <Image
                                    source={{ uri: donor.avatar_url }}
                                    style={styles.avatar}
                                    contentFit="cover"
                                />
                            ) : (
                                <View style={[styles.avatarFallback, { backgroundColor: theme.cardElevated }]}>
                                    <Text style={[styles.initials, { color: theme.textPrimary }]}>{initials}</Text>
                                </View>
                            )}
                        </View>
                        {/* Status dot on avatar */}
                        <View style={[styles.avatarStatusDot, { backgroundColor: statusColor, borderColor: theme.card }]} />
                    </View>

                    {/* Name + verified + blood group */}
                    <View style={styles.heroMeta}>
                        <View style={styles.nameRow}>
                            <Text style={[styles.heroName, { color: theme.textPrimary }]} numberOfLines={1}>
                                {donor.full_name}
                            </Text>
                            {donor.is_verified && (
                                <View style={[styles.verifiedBadge, { backgroundColor: '#00A65118' }]}>
                                    <Text style={[styles.verifiedText, { color: '#00A651' }]}>✓ Verified</Text>
                                </View>
                            )}
                        </View>

                        <Text style={[styles.availabilityText, { color: statusColor }]}>
                            {available
                                ? '● Available to donate'
                                : daysLeft > 0
                                    ? `● Eligible in ${daysLeft} days`
                                    : '● Currently unavailable'}
                        </Text>

                        {donor.address && (
                            <Text style={[styles.addressText, { color: theme.textMuted }]} numberOfLines={1}>
                                📍 {donor.address}
                            </Text>
                        )}
                    </View>

                    <BloodGroupBadge bloodGroup={donor.blood_group} size="xl" inverted style={styles.bloodBadge} />

                    {/* Stats row */}
                    <View style={[styles.statsRow, { borderTopColor: theme.border }]}>
                        <StatCell
                            value={String(donor.total_donations)}
                            label="DONATIONS"
                            color={theme.textPrimary}
                            theme={theme}
                        />
                        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                        <StatCell
                            value={donor.last_donation_date ? timeAgo(donor.last_donation_date) : 'Never'}
                            label="LAST DONATED"
                            color={theme.textPrimary}
                            theme={theme}
                        />
                        {distance !== null && (
                            <>
                                <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                                <StatCell
                                    value={formatDistance(distance)}
                                    label="AWAY"
                                    color={theme.textPrimary}
                                    theme={theme}
                                />
                            </>
                        )}
                    </View>
                </Animated.View>

                {/* ── Compatibility banner ── */}
                {!isOwnProfile && canDonateToMe !== null && (
                    <View style={[
                        styles.compatBanner,
                        {
                            backgroundColor: canDonateToMe ? '#00A65112' : '#E8002D0A',
                            borderColor: canDonateToMe ? '#00A65130' : '#E8002D25',
                        },
                    ]}>
                        <Text style={styles.compatIcon}>{canDonateToMe ? '✅' : '⚠️'}</Text>
                        <Text style={[styles.compatText, { color: theme.textSecondary }]}>
                            {canDonateToMe
                                ? `${donor.blood_group} is compatible with your blood group (${myBloodGroup}). This donor can donate to you.`
                                : `${donor.blood_group} may not be compatible with your blood group (${myBloodGroup}). Verify with hospital staff.`}
                        </Text>
                    </View>
                )}

                {/* ── Distance / ETA ── */}
                {distance !== null && (
                    <View style={[styles.etaCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <View style={styles.etaInner}>
                            <View style={styles.etaStat}>
                                <Text style={[styles.etaValue, { color: theme.textPrimary }]}>{formatDistance(distance)}</Text>
                                <Text style={[styles.etaLabel, { color: theme.textMuted }]}>DISTANCE</Text>
                            </View>
                            <View style={[styles.etaDivider, { backgroundColor: theme.border }]} />
                            <View style={styles.etaStat}>
                                <Text style={[styles.etaValue, { color: theme.textPrimary }]}>{estimateDriveMinutes(distance)} min</Text>
                                <Text style={[styles.etaLabel, { color: theme.textMuted }]}>EST. DRIVE</Text>
                            </View>
                            <TouchableOpacity
                                onPress={handleOpenMap}
                                style={[styles.dirBtn, { backgroundColor: theme.primary }]}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.dirBtnText}>Directions →</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* ── Medical history ── */}
                {donor.share_medical_history && (donor.medical_conditions?.length ?? 0) > 0 && (
                    <SectionCard title="🩺 DISCLOSED CONDITIONS" theme={theme}>
                        <View style={styles.tags}>
                            {donor.medical_conditions.map(c => (
                                <View key={c} style={[styles.tag, { backgroundColor: theme.cardElevated }]}>
                                    <Text style={[styles.tagText, { color: theme.textSecondary }]}>{c}</Text>
                                </View>
                            ))}
                        </View>
                    </SectionCard>
                )}

                {/* ── Donation history (accepted/completed responses) ── */}
                {responses.length > 0 && (
                    <SectionCard
                        title={`🩸 DONATION HISTORY  ·  ${responses.length} record${responses.length !== 1 ? 's' : ''}`}
                        theme={theme}
                    >
                        {responses.map(resp => {
                            const req = resp.blood_request;
                            if (!req) return null;
                            const statusCfg = RESPONSE_STATUS_CONFIG[resp.status] ?? { label: resp.status, color: theme.textMuted };
                            const urgencyColor = URGENCY_COLOR[req.urgency] ?? '#E8002D';
                            return (
                                <TouchableOpacity
                                    key={resp.id}
                                    onPress={() => router.push(`/request/${req.id}`)}
                                    activeOpacity={0.75}
                                >
                                    <View style={[styles.historyRow, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>
                                        <BloodGroupBadge bloodGroup={req.blood_group} size="sm" inverted />
                                        <View style={styles.historyMeta}>
                                            <Text style={[styles.historyHospital, { color: theme.textPrimary }]} numberOfLines={1}>
                                                {req.hospital_name}
                                            </Text>
                                            <Text style={[styles.historyAddr, { color: theme.textMuted }]} numberOfLines={1}>
                                                {req.hospital_address}
                                            </Text>
                                            <Text style={[styles.historyTime, { color: theme.textMuted }]}>
                                                {timeAgo(resp.created_at)}
                                            </Text>
                                        </View>
                                        <View style={styles.historyRight}>
                                            <View style={[styles.urgencyPip, { backgroundColor: urgencyColor }]} />
                                            <View style={[styles.statusPill, { backgroundColor: `${statusCfg.color}18`, borderColor: `${statusCfg.color}40` }]}>
                                                <Text style={[styles.statusPillText, { color: statusCfg.color }]}>
                                                    {statusCfg.label}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </SectionCard>
                )}

                {/* ── Member since ── */}
                <View style={[styles.memberRow, { borderColor: theme.border }]}>
                    <Text style={[styles.memberText, { color: theme.textMuted }]}>
                        Member since {formatDate(donor.created_at)}
                    </Text>
                </View>

                {/* ── Contact actions ── */}
                {!isOwnProfile && (
                    <View style={styles.actionWrap}>
                        <Button
                            label="📞  Call Donor"
                            variant="primary"
                            size="lg"
                            onPress={handleCall}
                            fullWidth
                        />
                        <Button
                            label="✉️  Send Message"
                            variant="outline"
                            size="md"
                            onPress={handleMessage}
                            fullWidth
                        />
                    </View>
                )}

            </ScrollView>
        </SafeAreaView>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, children, theme }: { title: string; children: React.ReactNode; theme: any }) {
    return (
        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{title}</Text>
            <View style={styles.sectionBody}>{children}</View>
        </View>
    );
}

function StatCell({ value, label, color, theme }: { value: string; label: string; color: string; theme: any }) {
    return (
        <View style={styles.statCell}>
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    root: { flex: 1 },

    // Top bar
    topBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing[5], paddingBottom: Spacing[3],
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    closeBtn: { width: 40, height: 40, justifyContent: 'center' },
    closeIcon: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
    topTitle: { fontSize: FontSize.base, fontWeight: FontWeight.black, letterSpacing: LetterSpacing.snug },
    statusDotSmall: { width: 8, height: 8, borderRadius: 4 },

    scroll: { padding: Spacing[5], gap: Spacing[4] },

    // Hero card
    heroCard: {
        borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden', padding: Spacing[5], gap: Spacing[4],
        alignItems: 'center',
    },
    avatarRow: { position: 'relative', alignSelf: 'center' },
    avatarRing: { borderRadius: 999, borderWidth: 2.5, padding: 3 },
    avatar: { width: 88, height: 88, borderRadius: 44 },
    avatarFallback: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
    initials: { fontSize: FontSize.xl, fontWeight: FontWeight.black, letterSpacing: -1 },
    avatarStatusDot: {
        position: 'absolute', bottom: 5, right: 5,
        width: 14, height: 14, borderRadius: 7, borderWidth: 2.5,
    },

    heroMeta: { alignItems: 'center', gap: Spacing[1] },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], flexWrap: 'wrap', justifyContent: 'center' },
    heroName: { fontSize: FontSize.lg, fontWeight: FontWeight.black, letterSpacing: LetterSpacing.tight },
    verifiedBadge: { paddingHorizontal: Spacing[2], paddingVertical: 2, borderRadius: Radius.xs },
    verifiedText: { fontSize: FontSize['2xs'], fontWeight: FontWeight.black, letterSpacing: LetterSpacing.wide },
    availabilityText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.snug },
    addressText: { fontSize: FontSize.xs },

    bloodBadge: { alignSelf: 'center' },

    statsRow: {
        flexDirection: 'row', alignItems: 'center',
        borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing[4],
        width: '100%',
    },
    statCell: { flex: 1, alignItems: 'center', gap: 3 },
    statValue: { fontSize: FontSize.base, fontWeight: FontWeight.black },
    statLabel: { fontSize: FontSize['2xs'], fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.widest, textTransform: 'uppercase' },
    statDivider: { width: StyleSheet.hairlineWidth, height: 28 },

    // Compatibility banner
    compatBanner: {
        flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3],
        padding: Spacing[3], borderRadius: Radius.sm, borderWidth: 1,
    },
    compatIcon: { fontSize: 18 },
    compatText: { flex: 1, fontSize: FontSize.sm, lineHeight: 20 },

    // ETA card
    etaCard: { borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
    etaInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], padding: Spacing[4] },
    etaStat: { flex: 1, alignItems: 'center', gap: 2 },
    etaValue: { fontSize: FontSize.base, fontWeight: FontWeight.black },
    etaLabel: { fontSize: FontSize['2xs'], fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.widest, textTransform: 'uppercase' },
    etaDivider: { width: StyleSheet.hairlineWidth, height: 28 },
    dirBtn: { paddingHorizontal: Spacing[3], paddingVertical: Spacing[2], borderRadius: Radius.xs },
    dirBtnText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.black },

    // Section card
    sectionCard: { borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', padding: Spacing[4] },
    sectionLabel: { fontSize: FontSize['2xs'], fontWeight: FontWeight.black, letterSpacing: LetterSpacing.widest, textTransform: 'uppercase', marginBottom: Spacing[3] },
    sectionBody: { gap: Spacing[2] },

    // Medical tags
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
    tag: { paddingHorizontal: Spacing[2], paddingVertical: Spacing[1], borderRadius: Radius.xs },
    tagText: { fontSize: FontSize.xs },

    // History rows
    historyRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
        padding: Spacing[3], borderRadius: Radius.sm, borderWidth: StyleSheet.hairlineWidth,
    },
    historyMeta: { flex: 1, gap: 2 },
    historyHospital: { fontSize: FontSize.sm, fontWeight: FontWeight.black },
    historyAddr: { fontSize: FontSize.xs },
    historyTime: { fontSize: FontSize.xs },
    historyRight: { alignItems: 'flex-end', gap: Spacing[1] },
    urgencyPip: { width: 6, height: 6, borderRadius: 3 },
    statusPill: {
        paddingHorizontal: Spacing[2], paddingVertical: 2,
        borderRadius: Radius.full, borderWidth: 1,
    },
    statusPillText: { fontSize: FontSize['2xs'], fontWeight: FontWeight.black, textTransform: 'uppercase', letterSpacing: LetterSpacing.wide },

    // Member since
    memberRow: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.xs, padding: Spacing[3], alignItems: 'center' },
    memberText: { fontSize: FontSize.xs },

    // Actions
    actionWrap: { gap: Spacing[3] },
});