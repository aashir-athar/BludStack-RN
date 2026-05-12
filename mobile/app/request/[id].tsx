// app/request/[id].tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, Linking, useWindowDimensions, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';
import { apiAcceptRequest, apiDeclineRequest, apiCompleteDonation } from '@/utils/api';
import { BloodRequest, RequestResponse } from '@/hooks/useRequests';
import { useLocation } from '@/hooks/useLocation';
import BloodGroupBadge from '@/components/BloodGroupBadge';
import ProfileCard from '@/components/ProfileCard';
import Card from '@/components/Card';
import Button from '@/components/Button';
import LoadingScreen from '@/components/LoadingScreen';
import { FontSize, FontWeight, Spacing, Radius, LetterSpacing, BorderRadius } from '@/constants/Typography';
import { URGENCY_CONFIG, DONOR_FOR_RECIPIENT } from '@/constants/BloodData';
import { formatDate, timeAgo } from '@/utils/helpers';
import { haversineDistance, formatDistance, estimateDriveMinutes, deltaFromKm } from '@/utils/geo';

const URGENCY_COLORS: Record<string, string> = {
  critical: '#E8002D',
  urgent:   '#F5A623',
  standard: '#00A651',
};

function uniqueChannelName(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme, isDark } = useTheme();
  const { user, profile } = useAuth();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { location } = useLocation(true);

  const [request, setRequest]         = useState<BloodRequest | null>(null);
  const [responses, setResponses]     = useState<RequestResponse[]>([]);
  const [myResponse, setMyResponse]   = useState<RequestResponse | null>(null);
  const [loading, setLoading]         = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Pulse animation for urgent requests
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (request?.urgency === 'critical') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [request?.urgency, pulseAnim]);

  const fetchRequest = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('blood_requests')
        .select(`
          *,
          recipient:profiles!recipient_id (
            id, full_name, email, avatar_url, blood_group,
            total_donations, is_verified, share_medical_history,
            medical_conditions, is_available_to_donate, last_donation_date
          )
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      setRequest(data as any);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to load request');
    }
  }, [id]);

  const fetchResponses = useCallback(async () => {
    if (!id || !user?.id) return;
    try {
      const { data, error } = await supabase
        .from('request_responses')
        .select(`
          *,
          donor:profiles!donor_id (
            id, full_name, email, blood_group, avatar_url,
            total_donations, is_verified, share_medical_history,
            medical_conditions, latitude, longitude,
            is_available_to_donate, last_donation_date
          )
        `)
        .eq('request_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const all  = (data as RequestResponse[]) ?? [];
      setResponses(all);
      const mine = all.find((r: any) => r.donor_id === user.id) ?? null;
      setMyResponse(mine);
    } catch (e: any) {
      console.warn('[fetchResponses]', e.message);
    }
  }, [id, user?.id]);

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchRequest(), fetchResponses()]).finally(() => setLoading(false));

    // Real-time responses subscription — unique channel to avoid collision
    const channelName = uniqueChannelName(`req_detail_${id}`);
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*', schema: 'public',
        table: 'request_responses',
        filter: `request_id=eq.${id}`,
      }, () => { fetchResponses(); })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: 'blood_requests',
        filter: `id=eq.${id}`,
      }, () => { fetchRequest(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]); // stable — fetchRequest/fetchResponses are stable via useCallback with no-dep pattern

  // ── ACCEPT: backend RPC validates cooldown + capacity atomically (flaw #8) ──
  const handleAccept = useCallback(async () => {
    if (!user?.id || !id) return;
    setActionLoading(true);
    try {
      await apiAcceptRequest(id);
      await fetchResponses();
      await fetchRequest();
      Alert.alert(
        '🩸 Request Accepted!',
        `You have committed to donating. The recipient will be notified. Please head to the hospital immediately.`,
        [{ text: 'Get Directions', onPress: openMaps }, { text: 'OK', style: 'cancel' }],
      );
    } catch (e: any) {
      Alert.alert('Failed to accept', e?.message ?? 'Please check your connection and try again.');
    } finally {
      setActionLoading(false);
    }
  }, [user?.id, id, fetchResponses, fetchRequest, openMaps]);

  const handleDecline = useCallback(async () => {
    if (!user?.id || !id) return;
    setActionLoading(true);
    try {
      await apiDeclineRequest(id);
      await fetchResponses();
    } catch (e: any) {
      console.warn('[handleDecline]', e?.message);
    } finally {
      setActionLoading(false);
    }
  }, [user?.id, id, fetchResponses]);

  const handleMarkComplete = useCallback(async () => {
    if (!id || !user?.id) return;
    const accepted = responses.find(r => r.status === 'accepted');
    if (!accepted?.donor_id) {
      Alert.alert('No donor yet', 'A donor must accept this request before you can mark it fulfilled.');
      return;
    }
    Alert.alert(
      'Mark as Fulfilled?',
      'This will close the request and record the donation.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Fulfilled',
          onPress: async () => {
            setActionLoading(true);
            try {
              // Backend RPC: atomic flip request→fulfilled + response→completed
              // + donor.total_donations++ + donor.last_donation_date=now. Idempotent.
              await apiCompleteDonation(id, accepted.donor_id);
              await fetchRequest();
              Alert.alert('🎉 Life Saved!', 'Donation recorded. Thank you for using BludStack.');
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Failed to mark fulfilled.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  }, [id, user?.id, responses, fetchRequest]);

  const openMaps = useCallback(() => {
    if (!request) return;
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${request.latitude},${request.longitude}&travelmode=driving`
    );
  }, [request]);

  const callContact = useCallback((contact: any) => {
    const phone = contact?.phone ?? contact?.email;
    if (phone) Linking.openURL(`tel:${phone}`);
  }, []);

  const messageContact = useCallback((contact: any) => {
    const email = contact?.email;
    if (email) Linking.openURL(`mailto:${email}`);
  }, []);

  if (loading) return <LoadingScreen message="Loading request…" />;
  if (!request) return null;

  const urgencyColor  = URGENCY_COLORS[request.urgency] ?? '#E8002D';
  const urgencyConfig = URGENCY_CONFIG[request.urgency];
  const isMyRequest   = request.recipient_id === user?.id;

  const distance = location
    ? haversineDistance(location.latitude, location.longitude, request.latitude, request.longitude)
    : null;

  const isCompatible = profile?.blood_group
    ? (DONOR_FOR_RECIPIENT[request.blood_group as keyof typeof DONOR_FOR_RECIPIENT] ?? [])
        .includes(profile.blood_group as any)
    : false;

  const acceptedResponses = responses.filter(r => r.status === 'accepted' || r.status === 'completed');
  const pendingCount      = responses.filter(r => r.status === 'pending').length;
  const isFulfilled       = request.status === 'fulfilled';
  const isCancelled       = request.status === 'cancelled';
  const isExpired         = request.status === 'expired';
  const isActive          = request.status === 'active';

  const statusColor = isFulfilled ? '#00A651' : isCancelled || isExpired ? theme.textMuted : urgencyColor;
  const statusLabel = isFulfilled ? 'Fulfilled ✓' : isCancelled ? 'Cancelled' : isExpired ? 'Expired' : `${urgencyConfig.label} · ${timeAgo(request.created_at)}`;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>

      {/* ── Top bar ── */}
      <View style={[styles.topBar, {
        paddingTop: insets.top + Spacing[2],
        backgroundColor: theme.surface,
        borderBottomColor: theme.border,
      }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} activeOpacity={0.7}>
          <Text style={[styles.closeIcon, { color: theme.textPrimary }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: theme.textPrimary }]}>Request Details</Text>
        {/* Urgency dot */}
        <View style={[styles.urgencyDot, { backgroundColor: urgencyColor }]} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing[10] }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Hero block ── */}
        <Animated.View style={[
          styles.heroCard,
          {
            backgroundColor: theme.card,
            borderColor: urgencyColor,
            transform: [{ scale: pulseAnim }],
          },
        ]}>
          {/* Status stripe */}
          <View style={[styles.statusStripe, { backgroundColor: urgencyColor }]} />

          <View style={styles.heroInner}>
            <View style={styles.heroTop}>
              <BloodGroupBadge bloodGroup={request.blood_group} size="xl" inverted />
              <View style={styles.heroMeta}>
                <View style={[styles.statusPill, { backgroundColor: `${statusColor}18`, borderColor: `${statusColor}40` }]}>
                  <View style={[styles.statusPillDot, { backgroundColor: statusColor }]} />
                  <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
                </View>
                <Text style={[styles.hospitalName, { color: theme.textPrimary }]} numberOfLines={2}>
                  {request.hospital_name}
                </Text>
                <Text style={[styles.hospitalAddr, { color: theme.textSecondary }]} numberOfLines={1}>
                  {request.hospital_address}
                </Text>
                <View style={styles.unitRow}>
                  <Text style={[styles.unitsBig, { color: urgencyColor }]}>
                    {request.units_needed}
                  </Text>
                  <Text style={[styles.unitsLabel, { color: theme.textSecondary }]}>
                    {request.units_needed === 1 ? 'unit' : 'units'} needed
                  </Text>
                </View>
              </View>
            </View>

            {/* Distance / ETA row */}
            {distance !== null && (
              <View style={[styles.etaRow, { borderTopColor: theme.border }]}>
                <EtaStat label="DISTANCE" value={formatDistance(distance)} color={theme.textPrimary} theme={theme} />
                <View style={[styles.etaDivider, { backgroundColor: theme.border }]} />
                <EtaStat label="EST. DRIVE" value={`${estimateDriveMinutes(distance)} min`} color={theme.textPrimary} theme={theme} />
                <View style={[styles.etaDivider, { backgroundColor: theme.border }]} />
                <TouchableOpacity onPress={openMaps} style={[styles.dirBtn, { backgroundColor: theme.primary }]} activeOpacity={0.8}>
                  <Text style={styles.dirBtnText}>Directions →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Notes */}
            {request.notes && (
              <View style={[styles.notesBox, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>
                <Text style={[styles.notesLabel, { color: theme.textMuted }]}>NOTES</Text>
                <Text style={[styles.notesText, { color: theme.textSecondary }]}>{request.notes}</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* ── Map preview ── */}
        <View style={[styles.mapCard, { overflow: 'hidden', borderColor: theme.border }]}>
          <MapView
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            userInterfaceStyle={isDark ? 'dark' : 'light'}
            region={{
              latitude: request.latitude,
              longitude: request.longitude,
              latitudeDelta: deltaFromKm(2),
              longitudeDelta: deltaFromKm(2),
            }}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            <Marker
              coordinate={{ latitude: request.latitude, longitude: request.longitude }}
              title={request.hospital_name}
              description={request.hospital_address}
            />
          </MapView>
          <TouchableOpacity
            onPress={openMaps}
            style={[styles.mapOverlay, { backgroundColor: theme.overlay }]}
            activeOpacity={0.85}
          >
            <Text style={styles.mapOverlayText}>Open in Maps →</Text>
          </TouchableOpacity>
        </View>

        {/* ── Recipient info (shown to accepted donor) ── */}
        {!isMyRequest && myResponse?.status === 'accepted' && request.recipient && (
          <Section title="🏥 RECIPIENT" theme={theme}>
            <ProfileCard
              profile={request.recipient as any}
              onCall={() => callContact(request.recipient)}
              onMessage={() => messageContact(request.recipient)}
            />
          </Section>
        )}

        {/* ── Accepted donors (shown to request owner) ── */}
        {isMyRequest && acceptedResponses.length > 0 && (
          <Section
            title={`🩸 ${acceptedResponses.length} DONOR${acceptedResponses.length !== 1 ? 'S' : ''} ACCEPTED`}
            theme={theme}
          >
            {acceptedResponses.map(resp => resp.donor && (
              <ProfileCard
                key={resp.id}
                profile={resp.donor as any}
                onCall={() => callContact(resp.donor)}
                onMessage={() => messageContact(resp.donor)}
              />
            ))}
          </Section>
        )}

        {/* ── Pending notification count ── */}
        {isMyRequest && isActive && pendingCount > 0 && (
          <View style={[styles.infoBanner, { backgroundColor: `${theme.warning}12`, borderColor: `${theme.warning}30` }]}>
            <Text style={styles.infoBannerIcon}>📡</Text>
            <Text style={[styles.infoBannerText, { color: theme.textSecondary }]}>
              {pendingCount} nearby donor{pendingCount !== 1 ? 's' : ''} notified — awaiting response
            </Text>
          </View>
        )}

        {/* ── Donor actions (not my request, active) ── */}
        {!isMyRequest && isActive && (
          <View style={styles.actionWrap}>
            {/* Incompatibility warning */}
            {!isCompatible && (
              <View style={[styles.warnBanner, { backgroundColor: `${theme.warning}12`, borderColor: `${theme.warning}30` }]}>
                <Text style={styles.infoBannerIcon}>⚠️</Text>
                <Text style={[styles.infoBannerText, { color: theme.textSecondary }]}>
                  Your blood group ({profile?.blood_group}) may not be compatible with {request.blood_group}.
                  Please verify with hospital staff before donating.
                </Text>
              </View>
            )}

            {myResponse?.status === 'accepted' ? (
              /* Already accepted — show confirmation state */
              <View style={[styles.acceptedState, { backgroundColor: '#00A65112', borderColor: '#00A65130' }]}>
                <Text style={styles.acceptedEmoji}>✅</Text>
                <Text style={[styles.acceptedTitle, { color: '#00A651' }]}>You're on the way</Text>
                <Text style={[styles.acceptedSub, { color: theme.textSecondary }]}>
                  Head to {request.hospital_name} as soon as possible.
                  The recipient is waiting.
                </Text>
                <Button
                  label="Open Directions"
                  variant="success"
                  onPress={openMaps}
                  fullWidth
                  size="md"
                />
              </View>
            ) : myResponse?.status === 'declined' ? (
              <View style={[styles.declinedState, { backgroundColor: theme.cardElevated }]}>
                <Text style={[styles.declinedText, { color: theme.textMuted }]}>
                  You declined this request.
                </Text>
                <Button
                  label="Change mind — Accept"
                  variant="outline"
                  onPress={handleAccept}
                  loading={actionLoading}
                  fullWidth
                />
              </View>
            ) : (
              /* Awaiting decision — primary CTA with psychology */
              <View style={styles.ctaBlock}>
                {/* Scarcity / urgency nudge */}
                <View style={[styles.scarcityRow, { backgroundColor: `${urgencyColor}10`, borderColor: `${urgencyColor}25` }]}>
                  <Text style={[styles.scarcityText, { color: urgencyColor }]}>
                    {urgencyConfig.icon} Your response can reach this hospital in{' '}
                    {distance !== null ? `${estimateDriveMinutes(distance)} min` : 'minutes'}.
                    {acceptedResponses.length === 0 ? ' No donors have accepted yet.' : ''}
                  </Text>
                </View>

                <Button
                  label="🩸  Accept & Donate"
                  variant="primary"
                  size="lg"
                  onPress={handleAccept}
                  loading={actionLoading}
                  fullWidth
                />
                <Button
                  label="Decline"
                  variant="ghost"
                  size="sm"
                  onPress={handleDecline}
                  fullWidth
                />
              </View>
            )}
          </View>
        )}

        {/* ── Recipient management actions ── */}
        {isMyRequest && isActive && (
          <View style={styles.actionWrap}>
            {acceptedResponses.length > 0 && (
              <Button
                label="✅  Mark as Fulfilled"
                variant="success"
                size="lg"
                onPress={handleMarkComplete}
                loading={actionLoading}
                fullWidth
              />
            )}
            <Button
              label="Cancel Request"
              variant="ghost"
              size="sm"
              onPress={() =>
                Alert.alert('Cancel Request', 'This cannot be undone.', [
                  { text: 'Keep', style: 'cancel' },
                  {
                    text: 'Cancel Request', style: 'destructive',
                    onPress: async () => {
                      await supabase
                        .from('blood_requests')
                        .update({ status: 'cancelled' })
                        .eq('id', id);
                      fetchRequest();
                    },
                  },
                ])
              }
              fullWidth
            />
          </View>
        )}

        {/* ── Closed state ── */}
        {(isFulfilled || isCancelled || isExpired) && (
          <View style={[styles.closedBanner, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>
            <Text style={[styles.closedText, { color: theme.textMuted }]}>
              {isFulfilled
                ? '🎉 This request has been fulfilled. Lives saved!'
                : isCancelled
                ? '❌ This request was cancelled by the recipient.'
                : '⏰ This request expired before being fulfilled.'}
            </Text>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

function Section({ title, children, theme }: { title: string; children: React.ReactNode; theme: any }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{title}</Text>
      {children}
    </View>
  );
}

function EtaStat({ label, value, color, theme }: { label: string; value: string; color: string; theme: any }) {
  return (
    <View style={styles.etaStat}>
      <Text style={[styles.etaValue, { color }]}>{value}</Text>
      <Text style={[styles.etaLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing[5], paddingBottom: Spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn:     { width: 40, height: 40, justifyContent: 'center' },
  closeIcon:    { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  topTitle:     { fontSize: FontSize.base, fontWeight: FontWeight.black, letterSpacing: LetterSpacing.snug },
  urgencyDot:   { width: 8, height: 8, borderRadius: 4 },

  scroll: { padding: Spacing[5], gap: Spacing[4] },

  heroCard:   { borderRadius: Radius.md, borderWidth: 2, overflow: 'hidden' },
  statusStripe: { height: 4 },
  heroInner:  { padding: Spacing[4], gap: Spacing[4] },
  heroTop:    { flexDirection: 'row', gap: Spacing[4], alignItems: 'flex-start' },
  heroMeta:   { flex: 1, gap: Spacing[2] },

  statusPill:    { flexDirection: 'row', alignItems: 'center', gap: Spacing[1], alignSelf: 'flex-start', paddingHorizontal: Spacing[2], paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1 },
  statusPillDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText:{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: LetterSpacing.wide },

  hospitalName: { fontSize: FontSize.base, fontWeight: FontWeight.black, letterSpacing: LetterSpacing.snug },
  hospitalAddr: { fontSize: FontSize.xs },
  unitRow:      { flexDirection: 'row', alignItems: 'baseline', gap: Spacing[1] },
  unitsBig:     { fontSize: FontSize.xl, fontWeight: FontWeight.black },
  unitsLabel:   { fontSize: FontSize.sm },

  etaRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing[3],
  },
  etaStat:    { flex: 1, alignItems: 'center' },
  etaValue:   { fontSize: FontSize.base, fontWeight: FontWeight.black },
  etaLabel:   { fontSize: FontSize['2xs'], fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.widest, textTransform: 'uppercase', marginTop: 2 },
  etaDivider: { width: StyleSheet.hairlineWidth, height: 28 },
  dirBtn:     { paddingHorizontal: Spacing[3], paddingVertical: Spacing[2], borderRadius: Radius.xs },
  dirBtnText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.black },

  notesBox:   { padding: Spacing[3], borderRadius: Radius.xs, borderWidth: StyleSheet.hairlineWidth },
  notesLabel: { fontSize: FontSize['2xs'], fontWeight: FontWeight.black, letterSpacing: LetterSpacing.widest, textTransform: 'uppercase', marginBottom: Spacing[1] },
  notesText:  { fontSize: FontSize.sm, lineHeight: 20 },

  mapCard:    { borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', height: 180 },
  map:        { ...StyleSheet.absoluteFillObject },
  mapOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingVertical: Spacing[2], alignItems: 'center',
  },
  mapOverlayText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  section:      { gap: Spacing[3] },
  sectionLabel: { fontSize: FontSize['2xs'], fontWeight: FontWeight.black, letterSpacing: LetterSpacing.widest, textTransform: 'uppercase' },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3],
    padding: Spacing[3], borderRadius: Radius.sm, borderWidth: 1,
  },
  infoBannerIcon: { fontSize: 18 },
  infoBannerText: { flex: 1, fontSize: FontSize.sm, lineHeight: 20 },

  warnBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3],
    padding: Spacing[3], borderRadius: Radius.sm, borderWidth: 1,
  },

  actionWrap: { gap: Spacing[3] },

  ctaBlock: { gap: Spacing[3] },
  scarcityRow: {
    padding: Spacing[3], borderRadius: Radius.sm, borderWidth: 1,
  },
  scarcityText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, lineHeight: 20 },

  acceptedState: {
    alignItems: 'center', gap: Spacing[3], padding: Spacing[5],
    borderRadius: Radius.md, borderWidth: 1,
  },
  acceptedEmoji: { fontSize: 40 },
  acceptedTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.black },
  acceptedSub:   { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },

  declinedState: { gap: Spacing[3], padding: Spacing[4], borderRadius: Radius.sm, alignItems: 'center' },
  declinedText:  { fontSize: FontSize.sm, fontStyle: 'italic' },

  closedBanner:  { padding: Spacing[4], borderRadius: Radius.sm, borderWidth: StyleSheet.hairlineWidth },
  closedText:    { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
});