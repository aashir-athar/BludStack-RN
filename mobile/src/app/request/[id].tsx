// Lever: loss aversion (the donor who can reach this hospital in minutes) +
// relief and control (the recipient watching their request fill). Role decides
// which half of the screen carries the weight.
import React, { useCallback } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View as RNView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Map as MapLibreMap, Camera, Marker as MlMarker } from '@maplibre/maplibre-react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getMapStyleJSON, zoomFromRadiusKm } from '@/utils/mapStyles';
import { useAppTheme, useIsDark } from '@/stores/themeStore';
import { useAuth } from '@/stores/authStore';
import { useToast } from '@/stores/toastStore';
import { useRequest, useCancelRequest } from '@/queries/requests';
import { useRequestRealtime } from '@/queries/realtime';
import { useAcceptRequest, useDeclineRequest, useCompleteDonation } from '@/queries/donations';
import { DONOR_FOR_RECIPIENT, type BloodGroup } from '@/constants/BloodData';
import { Spacing, Radius, FontWeight, LetterSpacing, Elevation } from '@/constants/Typography';
import type { ThemeColors } from '@/constants/Colors';
import {
  Text, Card, Button, Skeleton, ScreenHeader, BloodGroupBadge, ProfileCard, EmptyState,
  type ProfileCardData,
} from '@/ui';

// ── Domain shapes (the detail endpoint returns request + recipient + responses) ──
type Urgency = 'critical' | 'urgent' | 'standard';
type RequestStatus = 'active' | 'fulfilled' | 'cancelled' | 'expired';
type ResponseStatus = 'pending' | 'accepted' | 'declined' | 'completed';

interface DonorProfile extends ProfileCardData {
  phone?: string | null;
  whatsapp_available?: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

interface RequestResponse {
  id: string;
  donor_id: string;
  status: ResponseStatus;
  created_at: string;
  donor: DonorProfile | null;
}

interface RequestDetail {
  id: string;
  recipient_id: string;
  blood_group: string;
  urgency: Urgency;
  units_needed: number;
  hospital_name: string;
  hospital_address?: string | null;
  latitude: number;
  longitude: number;
  notes?: string | null;
  status: RequestStatus;
  created_at: string;
  recipient?: (DonorProfile & { phone?: string | null; whatsapp_available?: boolean }) | null;
  responses?: RequestResponse[];
}

const URGENCY: Record<Urgency, { label: string; tone: (t: ThemeColors) => string; icon: keyof typeof Ionicons.glyphMap }> = {
  critical: { label: 'Critical', tone: (t) => t.danger, icon: 'flash' },
  urgent: { label: 'Urgent', tone: (t) => t.warning, icon: 'time' },
  standard: { label: 'Standard', tone: (t) => t.success, icon: 'calendar-outline' },
};

// Date.now() / new Date() must live in module-level helpers (React Compiler purity).
function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function firstName(name?: string | null): string {
  return name?.trim().split(/\s+/)[0] ?? 'them';
}

function directionsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
}

function whatsappUrl(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}`;
}

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useAppTheme();
  const isDark = useIsDark();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const toast = useToast();

  // Realtime keeps the detail query fresh while this modal is open.
  useRequestRealtime(id);

  const { data, isLoading } = useRequest(id);
  const request = data as RequestDetail | undefined;

  const acceptM = useAcceptRequest();
  const declineM = useDeclineRequest();
  const completeM = useCompleteDonation();
  const cancelM = useCancelRequest();

  // ── Contact intents (parent-controlled number disclosure) ──
  const openChat = useCallback((contact: DonorProfile | null | undefined) => {
    if (!contact?.id || !id) return;
    void Haptics.selectionAsync();
    router.push({
      pathname: '/chat',
      params: { requestId: String(id), receiverId: contact.id, receiverName: contact.full_name ?? 'User' },
    });
  }, [id, router]);

  const callContact = useCallback((contact: DonorProfile | null | undefined) => {
    if (!contact?.phone) {
      toast.info('No number shared', { description: `Use Message to reach ${firstName(contact?.full_name)}.` });
      return;
    }
    void Haptics.selectionAsync();
    void Linking.openURL(`tel:${contact.phone}`);
  }, [toast]);

  const whatsAppContact = useCallback((contact: DonorProfile | null | undefined) => {
    if (!contact?.phone) {
      toast.info('No number shared', { description: `Use Message to reach ${firstName(contact?.full_name)}.` });
      return;
    }
    void Haptics.selectionAsync();
    void Linking.openURL(whatsappUrl(contact.phone));
  }, [toast]);

  const openDirections = useCallback(() => {
    if (!request) return;
    void Haptics.selectionAsync();
    void Linking.openURL(directionsUrl(request.latitude, request.longitude));
  }, [request]);

  // ── Mutations (toast on every result) ──
  const onAccept = useCallback(() => {
    if (!id) return;
    acceptM.mutate(id, {
      onSuccess: () => toast.success("You're on the way", { description: 'The recipient knows you are coming. Head to the hospital as soon as you can.' }),
      onError: (e) => toast.error("Couldn't accept", { description: e instanceof Error ? e.message : 'Check your connection and tap again.' }),
    });
  }, [id, acceptM, toast]);

  const onDecline = useCallback(() => {
    if (!id) return;
    declineM.mutate(id, {
      onSuccess: () => toast.info('Marked as not this time', { description: 'We will keep you posted on other requests near you.' }),
      onError: (e) => toast.error("Couldn't update", { description: e instanceof Error ? e.message : 'Please try again.' }),
    });
  }, [id, declineM, toast]);

  const onComplete = useCallback((donorId: string, donorName?: string | null) => {
    if (!id) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    completeM.mutate({ requestId: String(id), donorId }, {
      onSuccess: () => toast.success('Donation recorded', { description: `A life was saved because ${firstName(donorName)} showed up.` }),
      onError: (e) => toast.error("Couldn't mark fulfilled", { description: e instanceof Error ? e.message : 'Please try again.' }),
    });
  }, [id, completeM, toast]);

  const onCancel = useCallback(() => {
    if (!id) return;
    void Haptics.selectionAsync();
    // Genuine destructive confirmation - the only Alert this screen uses.
    Alert.alert(
      'Cancel this request?',
      'Donors who were notified will be told. You can post a new request anytime.',
      [
        { text: 'Keep it active', style: 'cancel' },
        {
          text: 'Cancel request',
          style: 'destructive',
          onPress: () => cancelM.mutate(String(id), {
            onSuccess: () => toast.info('Request cancelled'),
            onError: (e) => toast.error("Couldn't cancel", { description: e instanceof Error ? e.message : 'Please try again.' }),
          }),
        },
      ],
    );
  }, [id, cancelM, toast]);

  // ── Loading ──
  if (isLoading || !request) {
    return (
      <RNView style={[styles.root, { backgroundColor: theme.background }]}>
        <ScreenHeader title="Request" onBack={router.back} />
        {isLoading ? (
          <RNView style={styles.scrollPad}>
            <Skeleton height={150} radius={Radius.lg} />
            <Skeleton height={170} radius={Radius.lg} />
            <Skeleton height={64} radius={Radius.lg} />
            <Skeleton height={52} radius={Radius.pill} />
          </RNView>
        ) : (
          <RNView style={[styles.scrollPad, { flex: 1, justifyContent: 'center' }]}>
            <EmptyState
              icon="alert-circle-outline"
              title="We couldn't load this request"
              body="It may have been removed, or your connection dropped. Head back and try again."
              actionLabel="Go back"
              onAction={router.back}
            />
          </RNView>
        )}
      </RNView>
    );
  }

  // ── Derivations (plain, compiler-memoized) ──
  const u = URGENCY[request.urgency] ?? URGENCY.standard;
  const accent = u.tone(theme);
  // Defensive: until user.id hydrates, assume owner so the accept CTA never flashes.
  const isOwner = !user?.id ? true : request.recipient_id === user.id;
  const responses = request.responses ?? [];
  const accepted = responses.filter((r) => r.status === 'accepted' || r.status === 'completed');
  const pendingCount = responses.filter((r) => r.status === 'pending').length;
  const myResponse = user?.id ? responses.find((r) => r.donor_id === user.id) ?? null : null;

  const status = request.status;
  const isActive = status === 'active';
  const isClosed = !isActive;

  const isCompatible = profile?.blood_group
    ? (DONOR_FOR_RECIPIENT[request.blood_group as BloodGroup] ?? []).includes(profile.blood_group as BloodGroup)
    : false;

  // Donor pins on the preview only exist for the owner (RLS masks lat/long otherwise).
  const donorPins = isOwner
    ? accepted.filter((r) => r.donor?.latitude != null && r.donor?.longitude != null)
    : [];

  return (
    <RNView style={[styles.root, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Request" onBack={router.back} />

      <ScrollView
        contentContainerStyle={[styles.scrollPad, { paddingBottom: insets.bottom + Spacing[10] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <Card variant="elevated" pad="none" style={{ overflow: 'hidden', flexDirection: 'row' }}>
          <RNView style={{ width: 4, backgroundColor: accent }} />
          <RNView style={{ flex: 1, padding: Spacing[4], gap: Spacing[3] }}>
            <RNView style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3] }}>
              <BloodGroupBadge group={request.blood_group} size="lg" />
              <RNView style={{ flex: 1, gap: 2 }}>
                <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[1] }}>
                  <Ionicons name={u.icon} size={14} color={accent} />
                  <Text variant="overline" style={{ color: accent }}>{u.label}</Text>
                  <Text variant="caption" tone="tertiary" style={{ fontVariant: ['tabular-nums'] }}>. {timeAgo(request.created_at)}</Text>
                </RNView>
                <Text variant="titleSm" numberOfLines={2}>{request.hospital_name}</Text>
                {request.hospital_address ? (
                  <Text variant="caption" tone="muted" numberOfLines={2}>{request.hospital_address}</Text>
                ) : null}
              </RNView>
            </RNView>

            <RNView style={{ flexDirection: 'row', alignItems: 'baseline', gap: Spacing[1] }}>
              <Text variant="title" style={{ color: accent, fontVariant: ['tabular-nums'] }}>{request.units_needed}</Text>
              <Text variant="bodySm" tone="muted">{request.units_needed === 1 ? 'donor' : 'donors'} needed</Text>
            </RNView>

            {request.notes ? (
              <RNView style={{ backgroundColor: theme.cardElevated, borderRadius: Radius.base, borderCurve: 'continuous', padding: Spacing[3], gap: Spacing[1] }}>
                <Text variant="overline" tone="tertiary">Notes</Text>
                <Text variant="bodySm" tone="secondary">{request.notes}</Text>
              </RNView>
            ) : null}
          </RNView>
        </Card>

        {/* ── Map preview ── */}
        <RNView style={[styles.mapCard, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}>
          <MapLibreMap
            style={StyleSheet.absoluteFill}
            mapStyle={getMapStyleJSON(isDark)}
            dragPan={false}
            touchZoom={false}
            touchRotate={false}
            touchPitch={false}
            doubleTapZoom={false}
          >
            <Camera
              initialViewState={{ center: [request.longitude, request.latitude], zoom: zoomFromRadiusKm(2) }}
            />
            <MlMarker lngLat={[request.longitude, request.latitude]} anchor="bottom">
              <RNView style={[styles.hospitalPin, { backgroundColor: theme.primary, borderColor: theme.surface }]}>
                <Ionicons name="medical" size={15} color={theme.textOnPrimary} />
              </RNView>
            </MlMarker>
            {donorPins.map((r) => (
              <MlMarker key={r.id} lngLat={[r.donor!.longitude as number, r.donor!.latitude as number]} anchor="center">
                <RNView style={[styles.donorPin, { backgroundColor: theme.success, borderColor: theme.surface }]}>
                  <Ionicons name="water" size={13} color={theme.textOnPrimary} />
                </RNView>
              </MlMarker>
            ))}
          </MapLibreMap>
          <Button
            label="Open directions"
            icon="navigate-outline"
            variant="secondary"
            size="sm"
            onPress={openDirections}
            style={styles.mapBtn}
            accessibilityLabel="Open directions to the hospital in Maps"
          />
        </RNView>

        {/* ── Closed-state banner (status != active) ── */}
        {isClosed ? (
          <ClosedBanner status={status} theme={theme} />
        ) : null}

        {/* ── OWNER (recipient) view ── */}
        {isOwner ? (
          <RNView style={{ gap: Spacing[4] }}>
            {isActive && pendingCount > 0 ? (
              <RNView style={[styles.pill, { backgroundColor: theme.warningSoft, borderColor: theme.warning }]}>
                <Ionicons name="radio-outline" size={18} color={theme.warning} />
                <Text variant="bodySm" tone="secondary" style={{ flex: 1 }}>
                  {pendingCount} nearby {pendingCount === 1 ? 'donor was' : 'donors were'} notified. Awaiting their reply.
                </Text>
              </RNView>
            ) : null}

            {accepted.length > 0 ? (
              <RNView style={{ gap: Spacing[3] }}>
                <Text variant="overline" tone="muted">
                  {accepted.length} {accepted.length === 1 ? 'donor accepted' : 'donors accepted'}
                </Text>
                {accepted.map((r) => r.donor ? (
                  <RNView key={r.id} style={{ gap: Spacing[2] }}>
                    <ProfileCard
                      profile={r.donor}
                      onPress={() => router.push({ pathname: '/donor/[id]', params: { id: r.donor!.id, requestId: String(id) } })}
                      contact={isActive ? {
                        onCall: () => callContact(r.donor),
                        onWhatsApp: r.donor.whatsapp_available ? () => whatsAppContact(r.donor) : undefined,
                        onChat: () => openChat(r.donor),
                      } : undefined}
                    />
                    {isActive && r.status !== 'completed' ? (
                      <Button
                        label={`Mark ${firstName(r.donor.full_name)} fulfilled`}
                        variant="success"
                        size="md"
                        icon="checkmark-circle-outline"
                        fullWidth
                        loading={completeM.isPending && completeM.variables?.donorId === r.donor.id}
                        loadingLabel="Recording"
                        onPress={() => onComplete(r.donor!.id, r.donor!.full_name)}
                        accessibilityLabel={`Mark donation from ${r.donor.full_name} as fulfilled`}
                      />
                    ) : null}
                  </RNView>
                ) : null)}
              </RNView>
            ) : isActive ? (
              <RNView style={[styles.pill, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>
                <Ionicons name="time-outline" size={18} color={theme.textMuted} />
                <Text variant="bodySm" tone="muted" style={{ flex: 1 }}>
                  No donor has accepted yet. The moment one does, you can reach them right here.
                </Text>
              </RNView>
            ) : null}

            {isActive ? (
              <Button
                label="Cancel this request"
                variant="ghost"
                size="md"
                fullWidth
                loading={cancelM.isPending}
                loadingLabel="Cancelling"
                haptic={false}
                onPress={onCancel}
              />
            ) : null}
          </RNView>
        ) : null}

        {/* ── DONOR view ── */}
        {!isOwner ? (
          <RNView style={{ gap: Spacing[4] }}>
            {myResponse?.status === 'accepted' ? (
              <RNView style={{ gap: Spacing[3] }}>
                <RNView style={[styles.acceptedCard, { backgroundColor: theme.successSoft, borderColor: theme.success }]}>
                  <RNView style={[styles.successBadge, { backgroundColor: theme.success }]}>
                    <Ionicons name="checkmark" size={22} color={theme.textOnPrimary} />
                  </RNView>
                  <Text variant="title" style={{ color: theme.success, textAlign: 'center' }}>You're on the way</Text>
                  <Text variant="bodySm" tone="secondary" style={{ textAlign: 'center' }}>
                    Head to {request.hospital_name} as soon as you can. The recipient knows you are coming.
                  </Text>
                </RNView>
                <Button label="Open directions" icon="navigate-outline" variant="success" size="lg" fullWidth onPress={openDirections} />
                {isActive ? (
                  <Button
                    label="Share my live location"
                    icon="locate-outline"
                    variant="outline"
                    size="md"
                    fullWidth
                    onPress={() => router.push({ pathname: '/map/live', params: { requestId: String(id), role: 'donor' } })}
                    accessibilityLabel="Open the live map and share your location with the recipient"
                  />
                ) : null}
              </RNView>
            ) : isActive ? (
              <RNView style={{ gap: Spacing[3] }}>
                {!isCompatible && profile?.blood_group ? (
                  <RNView style={[styles.pill, { backgroundColor: theme.warningSoft, borderColor: theme.warning }]}>
                    <Ionicons name="warning-outline" size={18} color={theme.warning} />
                    <Text variant="bodySm" tone="secondary" style={{ flex: 1 }}>
                      Your group ({profile.blood_group}) may not match {request.blood_group}. Confirm with hospital staff before you donate.
                    </Text>
                  </RNView>
                ) : (
                  <RNView style={[styles.pill, { backgroundColor: theme.primaryGhost, borderColor: theme.primarySoft }]}>
                    <Ionicons name="alert-circle-outline" size={18} color={accent} />
                    <Text variant="bodySm" style={{ flex: 1, color: accent, fontWeight: FontWeight.semibold }}>
                      {accepted.length === 0
                        ? 'No donor has accepted yet. You could be the one who gets there in time.'
                        : `${accepted.length} ${accepted.length === 1 ? 'donor is' : 'donors are'} on the way. More units are still needed.`}
                    </Text>
                  </RNView>
                )}
                <Button
                  label="Accept and donate"
                  variant="primary"
                  size="xl"
                  fullWidth
                  loading={acceptM.isPending}
                  loadingLabel="Joining"
                  onPress={onAccept}
                />
                <Button
                  label="Not this time"
                  variant="ghost"
                  size="md"
                  fullWidth
                  haptic={false}
                  loading={declineM.isPending}
                  loadingLabel="Updating"
                  onPress={onDecline}
                />
              </RNView>
            ) : null}
          </RNView>
        ) : null}
      </ScrollView>
    </RNView>
  );
}

function ClosedBanner({ status, theme }: { status: RequestStatus; theme: ThemeColors }) {
  const fulfilled = status === 'fulfilled';
  const cancelled = status === 'cancelled';
  const tone = fulfilled ? theme.success : theme.textMuted;
  const soft = fulfilled ? theme.successSoft : theme.cardElevated;
  const icon: keyof typeof Ionicons.glyphMap = fulfilled ? 'heart' : cancelled ? 'close-circle' : 'time-outline';
  const label = fulfilled ? 'Fulfilled . life saved' : cancelled ? 'Cancelled' : 'Expired';
  const headline = fulfilled ? 'Thank you for showing up' : cancelled ? 'This request was cancelled' : 'This request timed out';
  const body = fulfilled
    ? 'The donation is recorded. A life was saved because someone answered.'
    : cancelled
      ? 'The recipient closed this request. Nothing more is needed here.'
      : 'No donor accepted in time. The recipient can post a fresh request whenever the need returns.';

  return (
    <Card variant="elevated" pad="none" style={{ overflow: 'hidden', flexDirection: 'row' }}>
      <RNView style={{ width: 4, backgroundColor: tone }} />
      <RNView style={{ flex: 1, padding: Spacing[4], gap: Spacing[2] }}>
        <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[2] }}>
          <RNView style={{ width: 32, height: 32, borderRadius: Radius.pill, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: soft, borderWidth: StyleSheet.hairlineWidth, borderColor: tone }}>
            <Ionicons name={icon} size={17} color={tone} />
          </RNView>
          <Text variant="overline" style={{ color: tone, letterSpacing: LetterSpacing.widest }}>{label}</Text>
        </RNView>
        <Text variant="titleSm">{headline}</Text>
        <Text variant="bodySm" tone="muted">{body}</Text>
      </RNView>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollPad: { paddingHorizontal: Spacing[5], paddingTop: Spacing[2], gap: Spacing[4] },
  mapCard: {
    height: 180,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  mapBtn: { position: 'absolute', right: Spacing[3], bottom: Spacing[3] },
  hospitalPin: {
    width: 34, height: 34, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2,
    ...Elevation.sm,
  },
  donorPin: {
    width: 28, height: 28, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2,
  },
  pill: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3],
    padding: Spacing[3], borderRadius: Radius.lg, borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  acceptedCard: {
    alignItems: 'center', gap: Spacing[2], padding: Spacing[5],
    borderRadius: Radius.lg, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth,
  },
  successBadge: {
    width: 48, height: 48, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing[1],
  },
});
