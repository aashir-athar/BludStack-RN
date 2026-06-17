// Lever: trust signals + reciprocity. Verified tick, donation count, and a clear
// "can donate to me" verdict earn trust; "they showed up before" invites you to
// show up too. Contact opens only through a real match, never cold.
import React from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/stores/themeStore';
import { useAuth } from '@/stores/authStore';
import { useToast } from '@/stores/toastStore';
import { useProfileById } from '@/queries/profiles';
import { DONOR_FOR_RECIPIENT, type BloodGroup } from '@/constants/BloodData';
import { Spacing, Radius } from '@/constants/Typography';
import { canDonateAgain, formatDate, timeAgo } from '@/utils/helpers';
import {
  Text,
  Card,
  Button,
  Skeleton,
  BloodGroupBadge,
  EmptyState,
  ScreenHeader,
} from '@/ui';

// Public-safe shape from GET /profiles/:id. The endpoint masks phone, address
// and exact location, so phone/whatsapp_available are optional: they only carry
// a value when the caller hands us a matched-thread profile.
interface DonorProfile {
  id: string;
  full_name: string;
  blood_group: string;
  gender?: string | null;
  avatar_url?: string | null;
  is_verified?: boolean;
  is_available_to_donate?: boolean;
  last_donation_date?: string | null;
  total_donations?: number;
  share_medical_history?: boolean;
  medical_conditions?: string[];
  created_at?: string;
  phone?: string | null;
  whatsapp_available?: boolean;
}

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

// Reciprocity-tinted micro-copy: lead with what the donor has given.
function donationLine(count: number): string {
  if (count <= 0) return 'No donations recorded yet';
  if (count === 1) return 'Gave blood once before';
  return `Gave blood ${count} times before`;
}

export default function DonorProfileScreen() {
  const { id, requestId } = useLocalSearchParams<{ id: string; requestId?: string }>();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user, profile: myProfile, isRecipient } = useAuth();

  const { data, isLoading } = useProfileById(id);
  const donor = (data as DonorProfile | undefined) ?? null;

  const goBack = () => {
    void Haptics.selectionAsync();
    router.back();
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <ScreenHeader title="Donor" onBack={goBack} />
        <View style={{ padding: Spacing[5], gap: Spacing[4] }}>
          <Card variant="elevated" style={{ alignItems: 'center', gap: Spacing[4] }}>
            <Skeleton width={96} height={96} radius={Radius.pill} />
            <Skeleton width={180} height={22} radius={Radius.sm} />
            <Skeleton width={120} height={14} radius={Radius.sm} />
            <Skeleton width="100%" height={56} radius={Radius.lg} />
          </Card>
          <Skeleton width="100%" height={84} radius={Radius.lg} />
          <Skeleton width="100%" height={120} radius={Radius.lg} />
        </View>
      </View>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!donor) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <ScreenHeader title="Donor" onBack={goBack} />
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="person-remove-outline"
            title="We couldn't find this donor"
            body="The profile may have been removed, or the link is out of date. Head back and try another donor."
            actionLabel="Go back"
            onAction={goBack}
          />
        </View>
      </View>
    );
  }

  // ── Derived (plain derivations, the compiler memoizes) ──────────────────────
  const isOwnProfile = user?.id === donor.id;
  const totalDonations = donor.total_donations ?? 0;
  const { canDonate, daysLeft } = canDonateAgain(donor.last_donation_date ?? null);
  const available = (donor.is_available_to_donate ?? false) && canDonate;

  const statusLabel = available
    ? 'Available to donate'
    : daysLeft > 0
      ? `Eligible again in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`
      : 'Resting right now';
  const statusTone: 'success' | 'warning' = available ? 'success' : 'warning';
  const statusColor = available ? theme.success : theme.warning;

  // Reciprocity verdict: can THIS donor give to ME? Uses my recipient group.
  const myGroup = myProfile?.blood_group as BloodGroup | undefined;
  const theirGroup = donor.blood_group as BloodGroup | undefined;
  const compatible =
    myGroup && theirGroup
      ? (DONOR_FOR_RECIPIENT[myGroup] ?? []).includes(theirGroup)
      : null;

  const conditions = donor.share_medical_history ? donor.medical_conditions ?? [] : [];

  // Contact gate: only a recipient, never your own profile, and only once the
  // donor row actually carries a phone (the public endpoint masks it, so this
  // stays true only inside a matched-thread context). Falls back to an honest
  // note when no channel is open yet.
  const phone = donor.phone?.trim() || null;
  const showContact = isRecipient && !isOwnProfile;
  const canCall = !!phone;

  const onCall = () => {
    if (!phone) return;
    void Haptics.selectionAsync();
    void Linking.openURL(`tel:${phone}`).catch(() =>
      toast.error("Couldn't open the dialer", { description: 'Try calling from your phone app.' }),
    );
  };

  const onWhatsApp = () => {
    if (!phone) return;
    void Haptics.selectionAsync();
    const digits = phone.replace(/[^\d]/g, '');
    void Linking.openURL(`https://wa.me/${digits}`).catch(() =>
      toast.error("Couldn't open WhatsApp", { description: 'Make sure WhatsApp is installed.' }),
    );
  };

  const onMessage = () => {
    if (!requestId) {
      toast.info('Chat opens after a match', {
        description: 'Accept each other through a request to start the conversation.',
      });
      return;
    }
    void Haptics.selectionAsync();
    router.push({
      pathname: '/chat',
      params: {
        requestId: String(requestId),
        receiverId: donor.id,
        receiverName: encodeURIComponent(donor.full_name ?? 'Donor'),
      },
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Donor" onBack={goBack} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + Spacing[10] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <Card variant="elevated" style={{ alignItems: 'center', gap: Spacing[4] }}>
          <View style={styles.avatarWrap}>
            <View
              style={[
                styles.avatarRing,
                { borderColor: statusColor, backgroundColor: theme.primaryGhost },
              ]}
            >
              {donor.avatar_url ? (
                <Image
                  source={donor.avatar_url}
                  style={styles.avatar}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={150}
                />
              ) : (
                <Text variant="headline" tone="brand">
                  {initialsOf(donor.full_name)}
                </Text>
              )}
            </View>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[
                styles.statusDot,
                { backgroundColor: statusColor, borderColor: theme.cardElevated },
              ]}
            />
          </View>

          <View style={{ alignItems: 'center', gap: Spacing[1] }}>
            <View style={styles.nameRow}>
              <Text variant="title" numberOfLines={1} style={{ flexShrink: 1, textAlign: 'center' }}>
                {donor.full_name}
              </Text>
              {donor.is_verified ? (
                <Ionicons name="checkmark-circle" size={20} color={theme.success} />
              ) : null}
            </View>

            <View style={styles.statusRow}>
              <View style={[styles.statusPip, { backgroundColor: statusColor }]} />
              <Text variant="labelSm" tone={statusTone}>
                {statusLabel}
              </Text>
            </View>
          </View>

          <BloodGroupBadge group={donor.blood_group} size="lg" />

          {/* Trust stats row */}
          <View style={[styles.statsRow, { borderTopColor: theme.border }]}>
            <View style={styles.statCell}>
              <Text variant="title" style={{ fontVariant: ['tabular-nums'] }}>
                {totalDonations}
              </Text>
              <Text variant="overline" tone="muted">
                Donations
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statCell}>
              <Text variant="titleSm" numberOfLines={1}>
                {donor.last_donation_date ? timeAgo(donor.last_donation_date) : 'Never'}
              </Text>
              <Text variant="overline" tone="muted">
                Last donated
              </Text>
            </View>
            {donor.is_verified ? (
              <>
                <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                <View style={styles.statCell}>
                  <Ionicons name="shield-checkmark" size={22} color={theme.success} />
                  <Text variant="overline" tone="muted">
                    Verified
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </Card>

        {/* ── Compatibility verdict (reciprocity hook) ── */}
        {!isOwnProfile && compatible !== null ? (
          <Card
            variant="surface"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing[3],
              backgroundColor: compatible ? theme.successSoft : theme.warningSoft,
              borderColor: compatible ? theme.success : theme.warning,
            }}
          >
            <Ionicons
              name={compatible ? 'checkmark-circle' : 'alert-circle'}
              size={26}
              color={compatible ? theme.success : theme.warning}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label" tone={compatible ? 'success' : 'warning'}>
                {compatible ? 'Can donate to me' : 'Cannot donate to my blood group'}
              </Text>
              <Text variant="caption" tone="secondary">
                {compatible
                  ? `${donor.blood_group} is compatible with your ${myGroup}. If they show up, your need is covered.`
                  : `${donor.blood_group} is not a match for your ${myGroup}. Confirm with hospital staff before relying on it.`}
              </Text>
            </View>
          </Card>
        ) : null}

        {/* ── Reciprocity line: what they have given ── */}
        <Card variant="surface" style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[3] }}>
          <View style={[styles.iconCircle, { backgroundColor: theme.primaryGhost }]}>
            <Ionicons name="water" size={20} color={theme.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label">{donationLine(totalDonations)}</Text>
            {donor.created_at ? (
              <Text variant="caption" tone="muted">
                On BludStack since {formatDate(donor.created_at)}
              </Text>
            ) : null}
          </View>
        </Card>

        {/* ── Disclosed conditions (recent activity / trust) ── */}
        {conditions.length > 0 ? (
          <Card variant="surface" style={{ gap: Spacing[3] }}>
            <Text variant="overline" tone="muted">
              Shared health notes
            </Text>
            <View style={styles.tags}>
              {conditions.map((c) => (
                <View
                  key={c}
                  style={[styles.tag, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}
                >
                  <Text variant="labelSm" tone="secondary">
                    {c}
                  </Text>
                </View>
              ))}
            </View>
            <Text variant="caption" tone="tertiary">
              Shared by this donor. Hospital screening is always the final word.
            </Text>
          </Card>
        ) : null}

        {/* ── Contact actions ──
            Recipients only, and only once the donor row exposes a phone (a
            matched-thread context). Otherwise we say so plainly instead of
            dangling dead buttons. */}
        {showContact ? (
          canCall ? (
            <View style={{ gap: Spacing[3] }}>
              <Text variant="overline" tone="muted" style={{ marginLeft: Spacing[1] }}>
                Reach out
              </Text>
              <Button
                label="Call"
                icon="call"
                variant="primary"
                size="lg"
                fullWidth
                onPress={onCall}
                accessibilityLabel={`Call ${donor.full_name}`}
              />
              {donor.whatsapp_available ? (
                <Button
                  label="WhatsApp"
                  icon="logo-whatsapp"
                  variant="success"
                  size="md"
                  fullWidth
                  onPress={onWhatsApp}
                  accessibilityLabel={`Message ${donor.full_name} on WhatsApp`}
                />
              ) : null}
              <Button
                label="Message"
                icon="chatbubble-ellipses-outline"
                variant="outline"
                size="md"
                fullWidth
                onPress={onMessage}
                accessibilityLabel={`Message ${donor.full_name} in the app`}
              />
            </View>
          ) : (
            <Card
              variant="surface"
              style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[3] }}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.cardElevated }]}>
                <Ionicons name="lock-closed-outline" size={18} color={theme.textMuted} />
              </View>
              <Text variant="caption" tone="muted" style={{ flex: 1 }}>
                Contact details unlock once this donor accepts your request. Post one or wait for them to
                accept, then call and chat open here.
              </Text>
            </Card>
          )
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: Spacing[5], gap: Spacing[4] },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: Spacing[16] },

  avatarWrap: { position: 'relative' },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: Radius.pill,
    borderCurve: 'continuous',
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: { width: 96, height: 96 },
  statusDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: Radius.pill,
    borderWidth: 3,
  },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[1], justifyContent: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  statusPip: { width: 7, height: 7, borderRadius: Radius.pill },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing[4],
  },
  statCell: { flex: 1, alignItems: 'center', gap: Spacing[1] },
  statDivider: { width: StyleSheet.hairlineWidth, height: 32 },

  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  tag: {
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing['1.5'],
    borderRadius: Radius.pill,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
