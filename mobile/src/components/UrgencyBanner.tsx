// components/UrgencyBanner.tsx
// Shows donor-availability context next to a posted request.
// Uses theme tokens for soft tints (no alpha-hex hacks).

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import {
  FontSize, FontWeight, Spacing, Radius, LetterSpacing,
} from '@/constants/Typography';

export interface UrgencyBannerProps {
  donorCount: number;
  radiusKm: number;
  bloodGroup: string;
  isCountryWide?: boolean;
  countryName?: string;
}

const UrgencyBanner = React.memo(function UrgencyBanner({
  donorCount, radiusKm, bloodGroup, isCountryWide, countryName,
}: UrgencyBannerProps) {
  const { theme } = useTheme();

  const tone =
    donorCount === 0 ? { bg: theme.dangerSoft,  fg: theme.danger,  icon: 'alert-circle' as const }
    : donorCount <= 3  ? { bg: theme.warningSoft, fg: theme.warning, icon: 'warning'      as const }
    :                    { bg: theme.successSoft, fg: theme.success, icon: 'pulse'        as const };

  const headline =
    donorCount === 0
      ? isCountryWide
        ? `No ${bloodGroup} donors found in ${countryName ?? 'your country'}`
        : `No ${bloodGroup} donors within ${radiusKm} km — expanding search`
      : isCountryWide
        ? `${donorCount} ${bloodGroup} donor${donorCount === 1 ? '' : 's'} across ${countryName ?? 'your country'}`
        : `${donorCount} ${bloodGroup} donor${donorCount === 1 ? '' : 's'} within ${radiusKm} km`;

  const sub =
    donorCount > 0
      ? 'Notifying compatible donors now. Every second counts.'
      : "Your request is live. We'll notify donors as they appear.";

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.wrap,
        { backgroundColor: tone.bg, borderColor: tone.fg },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: tone.fg + '22' }]}>
        <Ionicons name={tone.icon} size={18} color={tone.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.headline, { color: tone.fg }]}>{headline}</Text>
        <Text style={[styles.sub, { color: theme.textMuted }]}>{sub}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
    padding: Spacing[3],
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  headline: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.snug },
  sub:      { fontSize: FontSize.xs, marginTop: 2, lineHeight: FontSize.xs * 1.6 },
});

export default UrgencyBanner;
