// app/request/[id].tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, Linking, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Map as MapLibreMap, Camera, Marker as MlMarker } from '@maplibre/maplibre-react-native';
import { getMapStyleJSON, zoomFromRadiusKm } from '@/utils/mapStyles';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';
import { apiAcceptRequest, apiDeclineRequest, apiCompleteDonation, apiCancelRequest } from '@/utils/api';
import { useToast } from '@/contexts/ToastContext';
import { useDonorHeartbeat } from '@/hooks/useDonorHeartbeat';
import { BloodRequest, RequestResponse } from '@/hooks/useRequests';
import { useLocation } from '@/hooks/useLocation';
import BloodGroupBadge from '@/components/BloodGroupBadge';
import ProfileCard from '@/components/ProfileCard';
import Button from '@/components/Button';
import LoadingScreen from '@/components/LoadingScreen';
import { FontSize, FontWeight, Spacing, Radius, LetterSpacing, Elevation } from '@/constants/Typography';
import { URGENCY_CONFIG, DONOR_FOR_RECIPIENT } from '@/constants/BloodData';
import { timeAgo } from '@/utils/helpers';
import { haversineDistance, formatDistance, estimateDriveMinutes } from '@/utils/geo';

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
  const toast    = useToast();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { location } = useLocation(true);

  const [request, setRequest]         = useState<BloodRequest | null>(null);
  const [responses, setResponses]     = useState<RequestResponse[]>([]);
  const [myResponse, setMyResponse]   = useState<RequestResponse | null>(null);
  const [loading, setLoading]         = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  // One-active-commitment guard: the OTHER request_id this donor is already
  // committed to (accepted + parent request still active). When set, the
  // Accept CTA on this screen is replaced by a warning pill explaining why.
  const [otherCommitmentId, setOtherCommitmentId] = useState<string | null>(null);

  // Push donor's live GPS to backend while accepted + request still active.
  // The recipient watches this via realtime UPDATEs on request_responses and
  // renders the moving pin on /map/live.
  useDonorHeartbeat(
    id,
    myResponse?.status === 'accepted' && request?.status === 'active',
  );

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

  // Look up whether this donor is already committed to ANOTHER active request.
  // The accept_blood_request RPC also enforces this server-side; we mirror it
  // client-side so the UI shows a clear "you can't accept this yet" pill
  // instead of letting the user tap Accept and read a server error.
  const fetchOtherCommitment = useCallback(async () => {
    if (!id || !user?.id) { setOtherCommitmentId(null); return; }
    try {
      const { data, error } = await supabase
        .from('request_responses')
        .select('request_id, blood_requests!inner(status)')
        .eq('donor_id', user.id)
        .eq('status', 'accepted')
        .neq('request_id', id)
        .eq('blood_requests.status', 'active')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      setOtherCommitmentId((data as any)?.request_id ?? null);
    } catch (e: any) {
      console.warn('[fetchOtherCommitment]', e.message);
    }
  }, [id, user?.id]);

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchRequest(), fetchResponses(), fetchOtherCommitment()]).finally(() => setLoading(false));

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
      }, () => { fetchRequest(); fetchOtherCommitment(); })
      .subscribe();

    // Also watch ALL of this user's responses globally so the other-commitment
    // guard updates the moment a prior commitment is completed/cancelled.
    let myResponsesChannel: ReturnType<typeof supabase.channel> | null = null;
    if (user?.id) {
      myResponsesChannel = supabase
        .channel(uniqueChannelName(`my_resps_${user.id}`))
        .on('postgres_changes', {
          event: '*', schema: 'public',
          table: 'request_responses',
          filter: `donor_id=eq.${user.id}`,
        }, () => { fetchOtherCommitment(); })
        .subscribe();
    }

    return () => {
      supabase.removeChannel(channel);
      if (myResponsesChannel) supabase.removeChannel(myResponsesChannel);
    };
  }, [id, user?.id]); // stable — fetchRequest/fetchResponses/fetchOtherCommitment via useCallback

  const openMaps = useCallback(() => {
    if (!request) return;
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${request.latitude},${request.longitude}&travelmode=driving`
    );
  }, [request]);

  // ── ACCEPT: backend RPC validates cooldown + capacity atomically (flaw #8) ──
  const handleAccept = useCallback(async () => {
    if (!user?.id || !id) return;
    setActionLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      await apiAcceptRequest(id);
      await fetchResponses();
      await fetchRequest();
      Alert.alert(
        "You're on the way",
        `You committed to donating. The recipient is being notified. Head to ${request?.hospital_name ?? 'the hospital'} as soon as you can.`,
        [{ text: 'Open directions', onPress: openMaps }, { text: 'Later', style: 'cancel' }],
      );
    } catch (e: any) {
      Alert.alert('Failed to accept', e?.message ?? 'Please check your connection and try again.');
    } finally {
      setActionLoading(false);
    }
  }, [user?.id, id, fetchResponses, fetchRequest, openMaps, request?.hospital_name]);

  const handleDecline = useCallback(async () => {
    if (!user?.id || !id) return;
    setActionLoading(true);
    Haptics.selectionAsync().catch(() => {});
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
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            try {
              // Backend RPC: atomic flip request→fulfilled + response→completed
              // + donor.total_donations++ + donor.last_donation_date=now. Idempotent.
              await apiCompleteDonation(id, accepted.donor_id);
              await fetchRequest();
              Alert.alert('Life saved', 'Donation recorded. Thank you for showing up.');
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

  // Call ONLY uses the phone column. No email fallback — email is never an
  // in-app contact channel; users coordinate via Phone, WhatsApp (when the
  // other party has whatsapp_available toggled on), or in-app Chat.
  const callContact = useCallback((contact: any) => {
    if (!contact?.phone) {
      toast.info('No phone shared', { description: 'Use chat to reach them — they haven\'t added a phone number.' });
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    Linking.openURL(`tel:${contact.phone}`);
  }, [toast]);

  // In-app chat scoped to this request — NEVER email. The mutual-commitment
  // RLS guarantees both parties can resolve each other's profile, so the
  // ProfileCard's Chat pill flows here without round-tripping a discovery query.
  const messageContact = useCallback((contact: any) => {
    if (!contact?.id || !id) return;
    Haptics.selectionAsync().catch(() => {});
    router.push({
      pathname: '/chat',
      params: {
        requestId:    String(id),
        receiverId:   contact.id,
        receiverName: encodeURIComponent(contact.full_name ?? 'User'),
      },
    });
  }, [id, router]);

  if (loading) return <LoadingScreen message="Loading request…" />;
  if (!request) return null;

  const urgencyColor  = URGENCY_COLORS[request.urgency] ?? '#E8002D';
  const urgencyConfig = URGENCY_CONFIG[request.urgency];
  // Defensive: if user.id hasn't hydrated yet (rare cold-start race), treat
  // it as the recipient's request so we don't briefly render the accept CTA.
  const isMyRequest   = !user?.id ? true : request.recipient_id === user.id;

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
        paddingTop: Spacing[2],
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
          <MapLibreMap
            style={styles.map}
            mapStyle={getMapStyleJSON(isDark)}
            dragPan={false}
            touchZoom={false}
            touchRotate={false}
            touchPitch={false}
            doubleTapZoom={false}
          >
            <Camera
              initialViewState={{
                center: [request.longitude, request.latitude],
                zoom:   zoomFromRadiusKm(2),
              }}
            />
            <MlMarker
              lngLat={[request.longitude, request.latitude]}
              anchor="bottom"
            >
              <View style={[styles.mapMarker, { backgroundColor: theme.primary, borderColor: theme.surface }]}>
                <Ionicons name="medical" size={14} color={theme.textOnPrimary} />
              </View>
            </MlMarker>
          </MapLibreMap>
          <TouchableOpacity
            onPress={openMaps}
            style={[styles.mapOverlay, { backgroundColor: theme.overlay }]}
            activeOpacity={0.85}
          >
            <Text style={styles.mapOverlayText}>Open in Maps →</Text>
          </TouchableOpacity>
        </View>

        {/* ── Recipient info (shown to accepted donor) ──
            ProfileCard already exposes Call / WhatsApp / Chat pills — no
            duplicate "Message recipient" button beneath it. Single chat
            affordance per profile. */}
        {!isMyRequest && myResponse?.status === 'accepted' && request.recipient && (
          <Section title="Recipient" theme={theme}>
            <ProfileCard
              profile={request.recipient as any}
              onCall={() => callContact(request.recipient)}
              onMessage={() => messageContact(request.recipient)}
              interactive={isActive}
            />
            <Button
              label="View full profile"
              variant="outline"
              size="lg"
              fullWidth
              icon={<Ionicons name="person-circle-outline" size={18} color={theme.textPrimary} />}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                const rid: string = (request.recipient as any)?.id ?? request.recipient_id;
                router.push({
                  pathname: '/donor/[id]',
                  params:   { id: rid, requestId: String(id) },
                });
              }}
              style={{ marginTop: Spacing[3] }}
              accessibilityHint="Open the recipient's full profile"
            />
          </Section>
        )}

        {/* ── Accepted donors (shown to request owner) ── */}
        {isMyRequest && acceptedResponses.length > 0 && (
          <Section
            title={`${acceptedResponses.length} donor${acceptedResponses.length !== 1 ? 's' : ''} accepted`}
            theme={theme}
          >
            {acceptedResponses.map(resp => resp.donor && (
              <View key={resp.id} style={{ gap: Spacing[3], marginBottom: Spacing[4] }}>
                <ProfileCard
                  profile={resp.donor as any}
                  onCall={() => callContact(resp.donor)}
                  onMessage={() => messageContact(resp.donor)}
                  interactive={isActive}
                />

                {/* Per-donor heartbeat status pill (recipient view).
                    Only renders while the request is still active — once
                    fulfilled / cancelled / expired the live channel closes
                    along with chat + call + WhatsApp. */}
                {isActive && ((resp as any).donor_lat != null ? (
                  <View style={[styles.liveWaitPill, { backgroundColor: theme.successSoft, borderColor: theme.success }]}>
                    <View style={[styles.liveWaitDot, { backgroundColor: theme.success }]} />
                    <Text style={[styles.liveWaitText, { color: theme.success }]} numberOfLines={1}>
                      Live · sharing GPS right now
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.liveWaitPill, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>
                    <View style={[styles.liveWaitDot, { backgroundColor: theme.warning }]} />
                    <Text style={[styles.liveWaitText, { color: theme.textMuted }]} numberOfLines={1}>
                      Waiting for {(resp.donor as any).full_name?.split(' ')[0] ?? 'donor'} to share GPS
                    </Text>
                  </View>
                ))}

                {/* No duplicate Message button — the ProfileCard's Chat pill
                    already opens this thread via messageContact(). One chat
                    affordance per profile. */}
                <Button
                  label={`View ${(resp.donor as any).full_name?.split(' ')[0] ?? 'donor'}'s full profile`}
                  variant="outline"
                  size="md"
                  fullWidth
                  icon={<Ionicons name="person-circle-outline" size={16} color={theme.textPrimary} />}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    router.push({
                      pathname: '/donor/[id]',
                      params:   { id: (resp.donor as any).id, requestId: String(id) },
                    });
                  }}
                  accessibilityHint="Open the donor's full profile including donation history"
                />
              </View>
            ))}

            {/* Live tracking — only while the request is active. Closes
                with chat / call / WhatsApp once the request seals.
                When a heartbeat exists, the button is primary; until then
                we show a soft "waiting for GPS" pill so the recipient knows
                tracking is wired and pending, not missing. */}
            {isActive && (() => {
              const hasHeartbeat = acceptedResponses.some(r => (r as any).donor_lat != null);
              return hasHeartbeat ? (
                <Button
                  label="Track donor live"
                  variant="primary"
                  size="lg"
                  fullWidth
                  icon={<Ionicons name="navigate" size={18} color={theme.textOnPrimary} />}
                  onPress={() => router.push({
                    pathname: '/map/live',
                    params: { requestId: String(id), role: 'recipient' },
                  })}
                  style={{ marginTop: Spacing[2] }}
                  accessibilityHint="Open the live map showing donor locations"
                />
              ) : (
                <View style={[styles.liveWaitPill, { backgroundColor: theme.cardElevated, borderColor: theme.border, marginTop: Spacing[2] }]}>
                  <View style={[styles.liveWaitDot, { backgroundColor: theme.warning }]} />
                  <Text style={[styles.liveWaitText, { color: theme.textMuted }]} numberOfLines={1}>
                    Waiting for donor's GPS · Live tracking starts when they share their location
                  </Text>
                </View>
              );
            })()}
          </Section>
        )}

        {/* ── Pending notification count ── */}
        {isMyRequest && isActive && pendingCount > 0 && (
          <View style={[styles.infoBanner, { backgroundColor: theme.warningSoft, borderColor: theme.warning }]}>
            <Ionicons name="radio" size={18} color={theme.warning} />
            <Text style={[styles.infoBannerText, { color: theme.textSecondary, marginLeft: Spacing[2] }]}>
              {pendingCount} nearby donor{pendingCount !== 1 ? 's' : ''} notified — awaiting response
            </Text>
          </View>
        )}

        {/* ── Donor actions (not my request, active) ── */}
        {!isMyRequest && isActive && (
          <View style={styles.actionWrap}>
            {/* Incompatibility warning */}
            {!isCompatible && (
              <View style={[styles.warnBanner, { backgroundColor: theme.warningSoft, borderColor: theme.warning }]}>
                <Ionicons name="warning" size={18} color={theme.warning} />
                <Text style={[styles.infoBannerText, { color: theme.textSecondary, marginLeft: Spacing[2] }]}>
                  Your blood group ({profile?.blood_group}) may not be compatible with {request.blood_group}.
                  Please verify with hospital staff before donating.
                </Text>
              </View>
            )}

            {myResponse?.status === 'accepted' ? (
              /* Already accepted — confirmation state (peak-end). Contact
                 affordances live ONCE in the Recipient section below; this
                 block stays focused on the immediate physical action. */
              <View style={[styles.acceptedState, { backgroundColor: theme.successSoft, borderColor: theme.success }]}>
                <View style={[styles.successBadge, { backgroundColor: theme.success }]}>
                  <Ionicons name="checkmark" size={22} color={theme.textOnPrimary} />
                </View>
                <Text style={[styles.acceptedTitle, { color: theme.success }]}>You're on the way</Text>
                <Text style={[styles.acceptedSub, { color: theme.textSecondary }]}>
                  Head to {request.hospital_name} as soon as you can. The recipient knows you're coming.
                </Text>
                <Button
                  label="Open directions"
                  variant="success"
                  onPress={openMaps}
                  fullWidth
                  size="lg"
                  icon={<Ionicons name="navigate-outline" size={18} color={theme.textOnPrimary} />}
                />
              </View>
            ) : myResponse?.status === 'declined' ? (
              <View style={[styles.declinedState, { backgroundColor: theme.cardElevated }]}>
                <Text style={[styles.declinedText, { color: theme.textMuted }]}>
                  You declined this request.
                </Text>
                <Button
                  label="Change mind — accept"
                  variant="outline"
                  onPress={handleAccept}
                  loading={actionLoading}
                  fullWidth
                />
              </View>
            ) : otherCommitmentId ? (
              /* One-active-commitment block: donor is already committed to
                 a different active request and must complete or release that
                 one before accepting another. Server enforces the same rule
                 in accept_blood_request; this is the kinder UX path. */
              <View style={styles.ctaBlock}>
                <View style={[styles.warnBanner, { backgroundColor: theme.warningSoft, borderColor: theme.warning }]}>
                  <Ionicons name="alert-circle" size={18} color={theme.warning} />
                  <Text style={[styles.infoBannerText, { color: theme.textSecondary, marginLeft: Spacing[2] }]}>
                    You're already on the way to another donation. Finish that one — or release it — before accepting a new request.
                  </Text>
                </View>
                <Button
                  label="Open my active commitment"
                  variant="primary"
                  size="xl"
                  fullWidth
                  icon={<Ionicons name="navigate" size={18} color={theme.textOnPrimary} />}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    router.push({ pathname: '/request/[id]', params: { id: otherCommitmentId } });
                  }}
                />
                <Button
                  label="Not this time"
                  variant="ghost"
                  size="md"
                  onPress={handleDecline}
                  fullWidth
                />
              </View>
            ) : (
              /* Awaiting decision — primary CTA with scarcity nudge (loss aversion) */
              <View style={styles.ctaBlock}>
                <View style={[styles.scarcityRow, { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}>
                  <Ionicons name="time-outline" size={16} color={urgencyColor} />
                  <Text style={[styles.scarcityText, { color: urgencyColor, marginLeft: Spacing[2] }]}>
                    You can reach the hospital in{' '}
                    {distance !== null ? `${estimateDriveMinutes(distance)} min` : 'minutes'}.
                    {acceptedResponses.length === 0 ? ' No donors have accepted yet.' : ''}
                  </Text>
                </View>

                <Button
                  label="Accept and donate"
                  variant="primary"
                  size="xl"
                  onPress={handleAccept}
                  loading={actionLoading}
                  fullWidth
                />
                <Button
                  label="Not this time"
                  variant="ghost"
                  size="md"
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
                label="Mark as fulfilled"
                variant="success"
                size="xl"
                onPress={handleMarkComplete}
                loading={actionLoading}
                fullWidth
                icon={<Ionicons name="checkmark-circle" size={18} color={theme.textOnPrimary} />}
              />
            )}
            <Button
              label="Cancel this request"
              variant="ghost"
              size="md"
              onPress={() =>
                Alert.alert(
                  'Cancel this request?',
                  'Notified donors will be told. You can post a new request anytime.',
                  [
                    { text: 'Keep it active', style: 'cancel' },
                    {
                      text: 'Cancel request', style: 'destructive',
                      onPress: async () => {
                        try {
                          await apiCancelRequest(String(id));
                          toast.info('Request cancelled');
                          fetchRequest();
                        } catch (e: any) {
                          toast.error("Couldn't cancel", { description: e?.message });
                        }
                      },
                    },
                  ],
                )
              }
              fullWidth
            />
          </View>
        )}

        {/* ── Closed state — peak-end framing for fulfilled, neutral for the
            rest. Same card language as RequestCard: vertical stripe on the
            left, icon pill + uppercase tone label up top, headline + body
            below, optional next-step hint footer. ── */}
        {(isFulfilled || isCancelled || isExpired) && (() => {
          const toneColor = isFulfilled ? theme.success : theme.textMuted;
          const toneSoft  = isFulfilled ? theme.successSoft : theme.cardElevated;
          const iconName: keyof typeof Ionicons.glyphMap =
            isFulfilled ? 'heart'
            : isCancelled ? 'close-circle'
            : 'time-outline';
          const toneLabel =
            isFulfilled ? 'Fulfilled · life saved'
            : isCancelled ? 'Cancelled'
            : 'Expired';
          const headline =
            isFulfilled ? 'Thank you for showing up'
            : isCancelled ? 'This request was cancelled'
            : 'This request timed out';
          const body =
            isFulfilled
              ? 'The donation is recorded. A life was saved because of you — this is the moment everything was built for.'
              : isCancelled
                ? "The recipient closed this request. No further action is needed — you can keep an eye on new requests near you."
                : "No donor accepted in time. If the need still exists, the recipient can post a new request anytime.";

          return (
            <View style={[
              styles.closedCard,
              { backgroundColor: theme.card, borderColor: theme.border },
              Elevation.xs,
            ]}>
              <View style={[styles.closedStripe, { backgroundColor: toneColor }]} />
              <View style={styles.closedBody}>
                <View style={styles.closedHeader}>
                  <View style={[styles.closedIconPill, { backgroundColor: toneSoft, borderColor: toneColor }]}>
                    <Ionicons name={iconName} size={18} color={toneColor} />
                  </View>
                  <Text style={[styles.closedLabel, { color: toneColor }]} numberOfLines={1}>
                    {toneLabel}
                  </Text>
                </View>
                <Text style={[styles.closedHeadline, { color: theme.textPrimary }]}>
                  {headline}
                </Text>
                <Text style={[styles.closedBodyText, { color: theme.textMuted }]}>
                  {body}
                </Text>
                <View style={[styles.closedFooterNote, { borderTopColor: theme.divider }]}>
                  <Ionicons name="chatbubbles-outline" size={14} color={theme.textTertiary} />
                  <Text style={[styles.closedFooterText, { color: theme.textTertiary }]}>
                    Chat is closed for this request. You can still view past messages.
                  </Text>
                </View>
              </View>
            </View>
          );
        })()}

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

  heroCard:   { borderRadius: Radius.xl, borderWidth: 2, overflow: 'hidden' },
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
  dirBtn:     { paddingHorizontal: Spacing[3], paddingVertical: Spacing[2], borderRadius: Radius.pill },
  dirBtnText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.black },

  notesBox:   { padding: Spacing[3], borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth },
  notesLabel: { fontSize: FontSize['2xs'], fontWeight: FontWeight.black, letterSpacing: LetterSpacing.widest, textTransform: 'uppercase', marginBottom: Spacing[1] },
  notesText:  { fontSize: FontSize.sm, lineHeight: 20 },

  mapCard:    { borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', height: 180 },
  map:        { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  mapMarker: {
    width: 32, height: 32, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  mapOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingVertical: Spacing[2], alignItems: 'center',
  },
  mapOverlayText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  section:      { gap: Spacing[3] },
  sectionLabel: { fontSize: FontSize['2xs'], fontWeight: FontWeight.black, letterSpacing: LetterSpacing.widest, textTransform: 'uppercase' },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3],
    padding: Spacing[3], borderRadius: Radius.xl, borderWidth: 1,
  },
  liveWaitPill: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[2],
    borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth,
  },
  liveWaitDot: { width: 8, height: 8, borderRadius: 4 },
  liveWaitText: { flex: 1, fontSize: FontSize.xs, fontWeight: FontWeight.semibold, letterSpacing: LetterSpacing.snug },
  infoBannerIcon: { fontSize: 18 },
  infoBannerText: { flex: 1, fontSize: FontSize.sm, lineHeight: 20 },

  warnBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3],
    padding: Spacing[3], borderRadius: Radius.xl, borderWidth: 1,
  },

  actionWrap: { gap: Spacing[3] },

  ctaBlock: { gap: Spacing[3] },
  scarcityRow: {
    padding: Spacing[3], borderRadius: Radius.xl, borderWidth: 1,
  },
  scarcityText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, lineHeight: 20 },

  acceptedState: {
    alignItems: 'center', gap: Spacing[3], padding: Spacing[5],
    borderRadius: Radius.xl, borderWidth: 1,
  },
  acceptedEmoji: { fontSize: 40 },
  successBadge:  {
    width: 48, height: 48, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing[2],
  },
  acceptedTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.black },
  acceptedSub:   { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },

  declinedState: { gap: Spacing[3], padding: Spacing[4], borderRadius: Radius.xl, alignItems: 'center' },
  declinedText:  { fontSize: FontSize.sm, fontStyle: 'italic' },

  // ── Closed-state card (fulfilled / cancelled / expired) ──
  closedCard: {
    flexDirection: 'row',
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  closedStripe: { width: 4 },
  closedBody:   { flex: 1, padding: Spacing[4], gap: Spacing[2] },
  closedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  closedIconPill: {
    width: 32, height: 32, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  closedLabel: {
    flex: 1,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
  },
  closedHeadline: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.tight,
    marginTop: Spacing[1],
  },
  closedBodyText: {
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.5,
  },
  closedFooterNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingTop: Spacing[3],
    marginTop: Spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  closedFooterText: {
    flex: 1,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    letterSpacing: LetterSpacing.snug,
  },
});