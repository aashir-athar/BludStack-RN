// components/RequestCard.tsx
// Pill-radius card for blood request listings. Theme-tokenised throughout.
// Urgency stripe along the top, blood badge + hospital block, meta footer.
// Optional inline accept/decline actions (donor side) — guarded by showActions.

import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { BloodRequest } from '@/hooks/useRequests';
import BloodGroupBadge from './BloodGroupBadge';
import {
  FontSize, FontWeight, Spacing, Radius, LetterSpacing, Elevation,
} from '@/constants/Typography';
import { timeAgo, formatDistance } from '@/utils/helpers';
import { haversineDistance } from '@/utils/geo';

export interface RequestCardProps {
  request: BloodRequest;
  userLat?: number | null;
  userLon?: number | null;
  onPress?: (r: BloodRequest) => void;
  onAccept?: (r: BloodRequest) => void;
  onDecline?: (r: BloodRequest) => void;
  showActions?: boolean;
}

const URGENCY_META: Record<string, { label: string; iconName: keyof typeof Ionicons.glyphMap; toneKey: 'danger' | 'warning' | 'success' }> = {
  critical: { label: 'Critical', iconName: 'flash',           toneKey: 'danger'  },
  urgent:   { label: 'Urgent',   iconName: 'time',            toneKey: 'warning' },
  standard: { label: 'Standard', iconName: 'calendar-outline', toneKey: 'success' },
};

const RequestCard = React.memo(function RequestCard({
  request, userLat, userLon, onPress, onAccept, onDecline, showActions,
}: RequestCardProps) {
  const { theme } = useTheme();
  const meta = URGENCY_META[request.urgency] ?? URGENCY_META.urgent;

  // Card colorway depends on status:
  //   • active    → urgency tone (red/amber/green by criticality)
  //   • fulfilled → SUCCESS green — the donation actually happened, this is
  //                 a positive outcome, not a closure to mute.
  //   • cancelled → monochrome muted grey (recipient walked away)
  //   • expired   → monochrome muted grey (timed out without a donor)
  const isDead      = request.status === 'cancelled' || request.status === 'expired';
  const isFulfilled = request.status === 'fulfilled';

  const toneColor = isDead
    ? theme.textMuted
    : isFulfilled
      ? theme.success
      : meta.toneKey === 'danger'  ? theme.danger
      : meta.toneKey === 'warning' ? theme.warning
      :                              theme.success;

  const toneSoft  = isDead
    ? theme.cardElevated
    : isFulfilled
      ? theme.successSoft
      : meta.toneKey === 'danger'  ? theme.dangerSoft
      : meta.toneKey === 'warning' ? theme.warningSoft
      :                              theme.successSoft;

  // Pill label + icon mirror the status when it's a terminal state, the
  // urgency tier while the request is still live.
  const pillIcon: keyof typeof Ionicons.glyphMap =
    request.status === 'cancelled' ? 'close-circle'
    : request.status === 'expired' ? 'time-outline'
    : isFulfilled                  ? 'checkmark-circle'
    : meta.iconName;
  const pillLabel =
    request.status === 'cancelled' ? 'Cancelled'
    : request.status === 'expired' ? 'Expired'
    : isFulfilled                  ? 'Fulfilled · life saved'
    : meta.label;

  const distance = (userLat != null && userLon != null)
    ? haversineDistance(userLat, userLon, request.latitude, request.longitude)
    : null;

  const handlePress   = useCallback(() => onPress?.(request),   [onPress, request]);
  const handleAccept  = useCallback(() => onAccept?.(request),  [onAccept, request]);
  const handleDecline = useCallback(() => onDecline?.(request), [onDecline, request]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          // Dead requests fade slightly so they read as closed at a glance
          // without losing legibility.
          opacity: isDead ? 0.78 : (onPress && pressed ? 0.96 : 1),
        },
        Elevation.xs,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Request for ${request.blood_group} at ${request.hospital_name}`}
    >
      {/* Urgency / status stripe */}
      <View style={[styles.stripe, { backgroundColor: toneColor }]} />

      <View style={styles.inner}>
        {/* Top row */}
        <View style={styles.topRow}>
          <BloodGroupBadge
            bloodGroup={request.blood_group}
            // Solid for live + fulfilled (positive states), soft for dead.
            size="lg"
            variant={isDead ? 'soft' : 'solid'}
          />
          <View style={styles.topRight}>
            <Text
              style={[
                styles.hospital,
                { color: isDead ? theme.textMuted : theme.textPrimary },
              ]}
              numberOfLines={1}
            >
              {request.hospital_name}
            </Text>
            <Text style={[styles.address, { color: theme.textMuted }]} numberOfLines={1}>
              {request.hospital_address}
            </Text>
            <View style={[styles.urgencyPill, { backgroundColor: toneSoft, borderColor: toneColor }]}>
              <Ionicons name={pillIcon} size={12} color={toneColor} />
              <Text style={[styles.urgencyText, { color: toneColor }]}>{pillLabel}</Text>
            </View>
          </View>
        </View>

        {/* Meta row */}
        <View style={[styles.metaRow, { borderTopColor: theme.divider }]}>
          <MetaItem
            label={request.units_needed === 1 ? 'Donor' : 'Donors'}
            value={`${request.units_needed}`}
            theme={theme}
          />
          {distance !== null && (
            <MetaItem label="Distance" value={formatDistance(distance)} theme={theme} highlight />
          )}
          <MetaItem label="Posted" value={timeAgo(request.created_at)} theme={theme} />
          <MetaItem
            label="Status"
            value={request.status}
            theme={theme}
            color={request.status === 'active' ? theme.success : theme.textMuted}
          />
        </View>

        {request.notes && (
          <Text
            style={[styles.notes, { color: theme.textMuted, borderTopColor: theme.divider }]}
            numberOfLines={2}
          >
            {request.notes}
          </Text>
        )}

        {showActions && request.status === 'active' && (
          <View style={[styles.actions, { borderTopColor: theme.divider }]}>
            <Pressable
              onPress={handleDecline}
              style={({ pressed }) => [
                styles.declineBtn,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.cardElevated,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Decline"
            >
              <Text style={[styles.declineLabel, { color: theme.textSecondary }]}>Not now</Text>
            </Pressable>
            <Pressable
              onPress={handleAccept}
              style={({ pressed }) => [
                styles.acceptBtn,
                { backgroundColor: theme.primary, opacity: pressed ? 0.92 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Accept and donate"
            >
              <Ionicons name="checkmark-circle" size={16} color={theme.textOnPrimary} />
              <Text style={[styles.acceptLabel, { color: theme.textOnPrimary }]}>
                Accept and donate
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Pressable>
  );
});

function MetaItem({
  label, value, theme, highlight, color,
}: { label: string; value: string; theme: any; highlight?: boolean; color?: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={[
        styles.metaValue,
        { color: color ?? (highlight ? theme.primary : theme.textPrimary) },
      ]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.metaLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: Spacing[3],
  },
  stripe: { height: 4 },
  inner:  { padding: Spacing[4], gap: Spacing[3] },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  topRight: { flex: 1, gap: Spacing[1] },
  hospital: {
    fontSize: FontSize.base, fontWeight: FontWeight.black, letterSpacing: LetterSpacing.snug,
  },
  address: { fontSize: FontSize.sm },
  urgencyPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing[2], paddingVertical: 3,
    borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing[1],
  },
  urgencyText: {
    fontSize: FontSize['2xs'], fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.widest, textTransform: 'uppercase',
  },
  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing[3],
  },
  metaItem:  { alignItems: 'center', flex: 1 },
  metaValue: {
    fontSize: FontSize.sm, fontWeight: FontWeight.bold,
    letterSpacing: LetterSpacing.snug,
  },
  metaLabel: {
    fontSize: FontSize['2xs'], marginTop: 2,
    textTransform: 'uppercase', letterSpacing: LetterSpacing.widest, fontWeight: FontWeight.bold,
  },
  notes: {
    fontSize: FontSize.xs, fontStyle: 'italic',
    borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing[3],
    lineHeight: FontSize.xs * 1.6,
  },
  actions: {
    flexDirection: 'row', gap: Spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing[3],
  },
  declineBtn: {
    flex: 1, paddingVertical: Spacing[3],
    borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', justifyContent: 'center',
  },
  declineLabel: {
    fontSize: FontSize.sm, fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.snug,
  },
  acceptBtn: {
    flex: 2, paddingVertical: Spacing[3],
    borderRadius: Radius.pill,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing[1],
  },
  acceptLabel: {
    fontSize: FontSize.sm, fontWeight: FontWeight.black, letterSpacing: LetterSpacing.snug,
  },
});

export default RequestCard;
