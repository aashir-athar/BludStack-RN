// Blood-request card: urgency stripe (semantic token), blood badge, hospital
// block, meta footer, optional inline accept/decline. Used on home, my-requests,
// history, and the donor feed.
import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '@/constants/Typography';
import { useAppTheme } from '@/stores/themeStore';
import type { ThemeColors } from '@/constants/Colors';
import { Text } from './Text';
import { Card } from './Card';
import { Button } from './Button';
import { BloodGroupBadge } from './BloodGroupBadge';
import { PressableScale } from './PressableScale';

export type Urgency = 'critical' | 'urgent' | 'standard';

export interface RequestCardData {
  id: string;
  blood_group: string;
  urgency: Urgency;
  units_needed: number;
  hospital_name: string;
  hospital_address?: string | null;
  created_at: string;
  status?: string;
  distanceKm?: number;
  notes?: string | null;
}

export interface RequestCardProps {
  request: RequestCardData;
  onPress?: () => void;
  showActions?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  accepting?: boolean;
}

const URGENCY: Record<Urgency, { label: string; tone: (t: ThemeColors) => string; icon: keyof typeof Ionicons.glyphMap }> = {
  critical: { label: 'Critical', tone: (t) => t.danger, icon: 'flash' },
  urgent: { label: 'Urgent', tone: (t) => t.warning, icon: 'time' },
  standard: { label: 'Standard', tone: (t) => t.success, icon: 'calendar-outline' },
};

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function RequestCardImpl({ request, onPress, showActions, onAccept, onDecline, accepting }: RequestCardProps) {
  const theme = useAppTheme();
  const u = URGENCY[request.urgency];
  const accent = u.tone(theme);
  const distance = request.distanceKm != null
    ? request.distanceKm < 1 ? `${Math.round(request.distanceKm * 1000)} m` : `${request.distanceKm.toFixed(1)} km`
    : null;

  return (
    <PressableScale
      onPress={onPress}
      haptic={!!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${u.label} request for ${request.blood_group} at ${request.hospital_name}`}
    >
      <Card variant="elevated" pad="none" style={{ overflow: 'hidden', flexDirection: 'row' }}>
        <View style={{ width: 4, backgroundColor: accent }} />
        <View style={{ flex: 1, padding: Spacing[4], gap: Spacing[3] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[2] }}>
              <BloodGroupBadge group={request.blood_group} size="md" />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[1] }}>
                <Ionicons name={u.icon} size={13} color={accent} />
                <Text variant="overline" style={{ color: accent }}>{u.label}</Text>
              </View>
            </View>
            <Text variant="caption" tone="tertiary" style={{ fontVariant: ['tabular-nums'] }}>{timeAgo(request.created_at)}</Text>
          </View>

          <View style={{ gap: 2 }}>
            <Text variant="titleSm" numberOfLines={1}>{request.hospital_name}</Text>
            {request.hospital_address ? (
              <Text variant="caption" tone="muted" numberOfLines={1}>{request.hospital_address}</Text>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[4] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[1] }}>
              <Ionicons name="water-outline" size={14} color={theme.textTertiary} />
              <Text variant="caption" tone="muted">{request.units_needed} {request.units_needed === 1 ? 'donor' : 'donors'}</Text>
            </View>
            {distance ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[1] }}>
                <Ionicons name="navigate-outline" size={14} color={theme.textTertiary} />
                <Text variant="caption" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>{distance} away</Text>
              </View>
            ) : null}
          </View>

          {showActions ? (
            <View style={{ flexDirection: 'row', gap: Spacing[2], marginTop: Spacing[1] }}>
              <Button label="Accept and donate" onPress={onAccept} loading={accepting} loadingLabel="Joining" size="md" style={{ flex: 1 }} />
              <Button label="Not this time" onPress={onDecline} variant="outline" size="md" haptic={false} />
            </View>
          ) : null}
        </View>
      </Card>
    </PressableScale>
  );
}

export const RequestCard = React.memo(RequestCardImpl);
export default RequestCard;
