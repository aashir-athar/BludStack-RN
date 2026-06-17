// Reputation tier pill (New donor -> Lifesaver -> ... -> Legend), with an
// optional verified check. The tier comes from completed donations via the pure
// reputation lib; the colour follows the tier's tone token. One component covers
// both halves of the donor reputation + verified-badge program.
import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Spacing, FontSize, FontWeight, LetterSpacing } from '@/constants/Typography';
import { useAppTheme } from '@/stores/themeStore';
import { type ThemeColors } from '@/constants/Colors';
import { getReputationTier, type ReputationTone } from '@/lib/reputation';
import { Text } from './Text';

export type ReputationBadgeSize = 'sm' | 'md';

export interface ReputationBadgeProps {
  totalDonations: number;
  /** Show the verified check alongside the tier (the is_verified flag). */
  verified?: boolean;
  size?: ReputationBadgeSize;
}

function toneColors(tone: ReputationTone, theme: ThemeColors): { fg: string; bg: string } {
  switch (tone) {
    case 'brand':   return { fg: theme.primary, bg: theme.primarySoft };
    case 'warning': return { fg: theme.warning, bg: theme.warningSoft };
    case 'success': return { fg: theme.success, bg: theme.successSoft };
    case 'muted':
    default:        return { fg: theme.textMuted, bg: theme.pillBg };
  }
}

const SIZES: Record<ReputationBadgeSize, { font: number; icon: number; padX: number; padY: number; gap: number }> = {
  sm: { font: FontSize.xs, icon: 13, padX: Spacing[2], padY: Spacing[1],   gap: Spacing[1] },
  md: { font: FontSize.sm, icon: 15, padX: Spacing[3], padY: Spacing['1.5'], gap: Spacing['1.5'] },
};

function ReputationBadgeImpl({ totalDonations, verified = false, size = 'md' }: ReputationBadgeProps) {
  const theme = useAppTheme();
  const tier = getReputationTier(totalDonations);
  const { fg, bg } = toneColors(tier.tone, theme);
  const s = SIZES[size];

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${tier.label} tier${verified ? ', verified donor' : ''}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: s.gap,
        backgroundColor: bg,
        borderRadius: Radius.pill,
        borderCurve: 'continuous',
        paddingHorizontal: s.padX,
        paddingVertical: s.padY,
        alignSelf: 'flex-start',
      }}
    >
      <Ionicons name={tier.icon as keyof typeof Ionicons.glyphMap} size={s.icon} color={fg} />
      <Text style={{ color: fg, fontSize: s.font, fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.wide }}>
        {tier.label}
      </Text>
      {verified ? (
        <Ionicons name="checkmark-circle" size={s.icon} color={theme.success} style={{ marginLeft: 1 }} />
      ) : null}
    </View>
  );
}

export const ReputationBadge = React.memo(ReputationBadgeImpl);
export default ReputationBadge;
