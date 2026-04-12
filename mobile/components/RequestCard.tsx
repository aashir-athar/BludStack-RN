// components/RequestCard.tsx
import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { BloodRequest } from '@/hooks/useRequests';
import BloodGroupBadge from './BloodGroupBadge';
import { FontSize, FontWeight, Spacing, Radius, LetterSpacing } from '@/constants/Typography';
import { URGENCY_CONFIG } from '@/constants/BloodData';
import { timeAgo, formatDistance } from '@/utils/helpers';
import { haversineDistance } from '@/utils/geo';

interface RequestCardProps {
  request: BloodRequest;
  userLat?: number | null;
  userLon?: number | null;
  onPress?: (r: BloodRequest) => void;
  onAccept?: (r: BloodRequest) => void;
  onDecline?: (r: BloodRequest) => void;
  showActions?: boolean;
}

const URGENCY_COLORS = { critical: '#E8002D', urgent: '#F5A623', standard: '#00A651' };

const RequestCard = React.memo(function RequestCard({
  request, userLat, userLon, onPress, onAccept, onDecline, showActions,
}: RequestCardProps) {
  const { theme } = useTheme();
  const urgency = URGENCY_CONFIG[request.urgency];
  const urgencyColor = URGENCY_COLORS[request.urgency];

  const distance = userLat && userLon
    ? haversineDistance(userLat, userLon, request.latitude, request.longitude)
    : null;

  const handlePress   = useCallback(() => onPress?.(request),   [onPress, request]);
  const handleAccept  = useCallback(() => onAccept?.(request),  [onAccept, request]);
  const handleDecline = useCallback(() => onDecline?.(request), [onDecline, request]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
      style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
    >
      {/* Urgency indicator bar */}
      <View style={[styles.urgencyBar, { backgroundColor: urgencyColor }]} />

      <View style={styles.inner}>
        {/* Top: blood group + hospital */}
        <View style={styles.topRow}>
          <BloodGroupBadge bloodGroup={request.blood_group} size="lg" inverted />
          <View style={styles.topRight}>
            <Text style={[styles.hospital, { color: theme.textPrimary }]} numberOfLines={1}>
              {request.hospital_name}
            </Text>
            <Text style={[styles.address, { color: theme.textSecondary }]} numberOfLines={1}>
              {request.hospital_address}
            </Text>
            {/* Urgency pill */}
            <View style={[styles.urgencyPill, { backgroundColor: `${urgencyColor}18` }]}>
              <Text style={[styles.urgencyText, { color: urgencyColor }]}>
                {urgency.icon} {urgency.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Meta row */}
        <View style={[styles.metaRow, { borderTopColor: theme.border }]}>
          <MetaItem label="Units"    value={`${request.units_needed}`} theme={theme} />
          {distance !== null && (
            <MetaItem label="Distance" value={formatDistance(distance)} theme={theme} highlight />
          )}
          <MetaItem label="Posted"   value={timeAgo(request.created_at)} theme={theme} />
          <MetaItem
            label="Status"
            value={request.status}
            theme={theme}
            color={request.status === 'active' ? theme.success : theme.textMuted}
          />
        </View>

        {/* Notes */}
        {request.notes && (
          <Text style={[styles.notes, { color: theme.textMuted, borderTopColor: theme.border }]} numberOfLines={2}>
            {request.notes}
          </Text>
        )}

        {/* Actions */}
        {showActions && request.status === 'active' && (
          <View style={[styles.actions, { borderTopColor: theme.border }]}>
            <TouchableOpacity
              onPress={handleDecline}
              style={[styles.declineBtn, { borderColor: theme.border }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.declineLabel, { color: theme.textSecondary }]}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleAccept}
              style={[styles.acceptBtn, { backgroundColor: theme.primary }]}
              activeOpacity={0.7}
            >
              <Text style={styles.acceptLabel}>🩸 Accept & Donate</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

function MetaItem({ label, value, theme, highlight, color }: {
  label: string; value: string; theme: any; highlight?: boolean; color?: string;
}) {
  return (
    <View style={styles.metaItem}>
      <Text style={[styles.metaValue, { color: color ?? (highlight ? theme.primary : theme.textPrimary) }]}>
        {value}
      </Text>
      <Text style={[styles.metaLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card:        { borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: Spacing[3] },
  urgencyBar:  { height: 3 },
  inner:       { padding: Spacing[4], gap: Spacing[3] },
  topRow:      { flexDirection: 'row', gap: Spacing[3] },
  topRight:    { flex: 1, gap: Spacing[1] },
  hospital:    { fontSize: FontSize.base, fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.snug },
  address:     { fontSize: FontSize.sm, fontWeight: FontWeight.regular },
  urgencyPill: { alignSelf: 'flex-start', paddingHorizontal: Spacing[2], paddingVertical: 2, borderRadius: Radius.xs, marginTop: Spacing[1] },
  urgencyText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing[3],
  },
  metaItem:  { alignItems: 'center', flex: 1 },
  metaValue: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  metaLabel: { fontSize: FontSize.xs, marginTop: 2, textTransform: 'uppercase', letterSpacing: LetterSpacing.wide },
  notes: {
    fontSize: FontSize.xs, fontStyle: 'italic',
    borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing[3],
  },
  actions: {
    flexDirection: 'row', gap: Spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing[3],
  },
  declineBtn: {
    flex: 1, paddingVertical: Spacing[3], borderRadius: Radius.xs,
    alignItems: 'center', borderWidth: 1,
  },
  acceptBtn:   { flex: 2, paddingVertical: Spacing[3], borderRadius: Radius.xs, alignItems: 'center', backgroundColor: '#E8002D' },
  declineLabel:{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  acceptLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#fff' },
});

export default RequestCard;
