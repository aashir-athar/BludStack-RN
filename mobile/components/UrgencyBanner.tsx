// components/UrgencyBanner.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { FontSize, FontWeight, Spacing, Radius, LetterSpacing } from '@/constants/Typography';

interface UrgencyBannerProps {
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
  const critical = donorCount <= 3;
  const color    = donorCount === 0 ? theme.error : critical ? theme.warning : theme.success;

  const headline = donorCount === 0
    ? isCountryWide
      ? `No ${bloodGroup} donors found in ${countryName ?? 'your country'}`
      : `No ${bloodGroup} donors within ${radiusKm} km — expanding search…`
    : isCountryWide
      ? `${donorCount} ${bloodGroup} donor${donorCount === 1 ? '' : 's'} found across ${countryName ?? 'your country'}`
      : `Only ${donorCount} ${bloodGroup} donor${donorCount === 1 ? '' : 's'} within ${radiusKm} km`;

  return (
    <View style={[styles.wrap, { backgroundColor: `${color}10`, borderColor: `${color}40` }]}>
      <Text style={[styles.dot, { color }]}>●</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.headline, { color }]}>{headline}</Text>
        <Text style={[styles.sub, { color: theme.textSecondary }]}>
          {donorCount > 0
            ? 'Notifying compatible donors now. Every second counts.'
            : 'Your request is live. We\'ll notify donors as they appear.'}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap:     { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3], borderWidth: 1, borderRadius: Radius.sm, padding: Spacing[3] },
  dot:      { fontSize: 10, marginTop: 3 },
  headline: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  sub:      { fontSize: FontSize.xs, marginTop: 2, lineHeight: 18 },
});

export default UrgencyBanner;
