// components/RequestCard.tsx
import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { BloodRequest } from '@/hooks/useRequests';
import BloodGroupBadge from './BloodGroupBadge';
import Card from './Card';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/Typography';
import { URGENCY_CONFIG } from '@/constants/BloodData';
import { timeAgo, formatDistance } from '@/utils/helpers';
import { haversineDistance } from '@/utils/geo';

interface RequestCardProps {
  request: BloodRequest;
  userLat?: number | null;
  userLon?: number | null;
  onPress?: (request: BloodRequest) => void;
  showActions?: boolean;
  onAccept?: (request: BloodRequest) => void;
  onDecline?: (request: BloodRequest) => void;
}

const RequestCard = React.memo(function RequestCard({
  request,
  userLat,
  userLon,
  onPress,
  showActions = false,
  onAccept,
  onDecline,
}: RequestCardProps) {
  const { theme } = useTheme();
  const urgency = URGENCY_CONFIG[request.urgency];

  const distance =
    userLat && userLon
      ? haversineDistance(userLat, userLon, request.latitude, request.longitude)
      : null;

  const handlePress = useCallback(() => onPress?.(request), [onPress, request]);
  const handleAccept = useCallback(() => onAccept?.(request), [onAccept, request]);
  const handleDecline = useCallback(() => onDecline?.(request), [onDecline, request]);

  const statusColor =
    request.status === 'active'
      ? theme.success
      : request.status === 'fulfilled'
      ? theme.accent
      : theme.textMuted;

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.82} disabled={!onPress}>
      <Card style={styles.card} elevated>
        {/* Urgency stripe */}
        <View style={[styles.urgencyStripe, { backgroundColor: urgency.color }]} />

        <View style={styles.body}>
          {/* Top row */}
          <View style={styles.row}>
            <BloodGroupBadge bloodGroup={request.blood_group} size="lg" showGlow />
            <View style={styles.meta}>
              <View style={styles.urgencyRow}>
                <Text style={styles.urgencyIcon}>{urgency.icon}</Text>
                <Text style={[styles.urgencyLabel, { color: urgency.color }]}>
                  {urgency.label}
                </Text>
                <Text style={[styles.dot, { color: theme.textMuted }]}> · </Text>
                <Text style={[styles.time, { color: theme.textMuted }]}>
                  {timeAgo(request.created_at)}
                </Text>
              </View>
              <Text style={[styles.hospital, { color: theme.textPrimary }]} numberOfLines={1}>
                {request.hospital_name}
              </Text>
              <Text style={[styles.address, { color: theme.textSecondary }]} numberOfLines={1}>
                {request.hospital_address}
              </Text>
            </View>
          </View>

          {/* Stats row */}
          <View style={[styles.statsRow, { borderTopColor: theme.border }]}>
            <Stat label="Units" value={`${request.units_needed}`} color={theme.primary} theme={theme} />
            {distance !== null && (
              <Stat label="Distance" value={formatDistance(distance)} color={theme.accent} theme={theme} />
            )}
            <Stat
              label="Status"
              value={request.status.charAt(0).toUpperCase() + request.status.slice(1)}
              color={statusColor}
              theme={theme}
            />
          </View>

          {/* Recipient info */}
          {request.recipient && (
            <Text style={[styles.recipientName, { color: theme.textSecondary }]}>
              👤 {request.recipient.full_name}
            </Text>
          )}

          {/* Notes */}
          {request.notes && (
            <Text style={[styles.notes, { color: theme.textMuted }]} numberOfLines={2}>
              {request.notes}
            </Text>
          )}

          {/* Actions */}
          {showActions && request.status === 'active' && (
            <View style={styles.actions}>
              <TouchableOpacity
                onPress={handleDecline}
                style={[styles.actionBtn, styles.declineBtn, { borderColor: theme.border }]}
                activeOpacity={0.8}
              >
                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAccept}
                style={[styles.actionBtn, styles.acceptBtn, { backgroundColor: theme.primary }]}
                activeOpacity={0.8}
              >
                <Text style={[styles.actionLabel, { color: '#fff' }]}>🩸 Accept</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
});

function Stat({
  label, value, color, theme,
}: { label: string; value: string; color: string; theme: any }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card:          { marginBottom: Spacing[3], overflow: 'hidden' },
  urgencyStripe: { height: 3, marginBottom: Spacing[3], marginHorizontal: -Spacing[4], marginTop: -Spacing[4] },
  body:          { gap: Spacing[3] },
  row:           { flexDirection: 'row', gap: Spacing[3], alignItems: 'flex-start' },
  meta:          { flex: 1, gap: Spacing[1] },
  urgencyRow:    { flexDirection: 'row', alignItems: 'center' },
  urgencyIcon:   { fontSize: FontSize.sm, marginRight: 2 },
  urgencyLabel:  { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  dot:           { fontSize: FontSize.sm },
  time:          { fontSize: FontSize.xs },
  hospital:      { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  address:       { fontSize: FontSize.xs },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing[3],
  },
  stat:        { alignItems: 'center', gap: 2 },
  statValue:   { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  statLabel:   { fontSize: FontSize.xs },
  recipientName: { fontSize: FontSize.xs },
  notes:       { fontSize: FontSize.xs, fontStyle: 'italic' },
  actions:     { flexDirection: 'row', gap: Spacing[3], marginTop: Spacing[1] },
  actionBtn: {
    flex: 1,
    paddingVertical: Spacing[2.5],
    borderRadius: BorderRadius.base,
    alignItems: 'center',
  },
  declineBtn: { borderWidth: 1 },
  acceptBtn:  {},
  actionLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});

export default RequestCard;
