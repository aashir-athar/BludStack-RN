// components/UrgencyBanner.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/Typography';

interface UrgencyBannerProps {
  donorCount: number;
  radiusKm: number;
  bloodGroup: string;
}

const UrgencyBanner = React.memo(function UrgencyBanner({
  donorCount,
  radiusKm,
  bloodGroup,
}: UrgencyBannerProps) {
  const { theme } = useTheme();
  const isCritical = donorCount <= 3;
  const color = isCritical ? theme.primary : theme.warning;

  return (
    <View style={[styles.container, { backgroundColor: `${color}18`, borderColor: `${color}55` }]}>
      <Text style={styles.icon}>{isCritical ? '🚨' : '⚠️'}</Text>
      <View style={styles.textWrap}>
        <Text style={[styles.headline, { color }]}>
          {donorCount === 0
            ? `No ${bloodGroup} donors within ${radiusKm} km — expanding search…`
            : `Only ${donorCount} compatible ${bloodGroup} donor${donorCount === 1 ? '' : 's'} within ${radiusKm} km`}
        </Text>
        <Text style={[styles.sub, { color: theme.textSecondary }]}>
          Your request can save a life in minutes.
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing[3],
  },
  icon:     { fontSize: 22 },
  textWrap: { flex: 1, gap: 2 },
  headline: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  sub:      { fontSize: FontSize.xs },
});

export default UrgencyBanner;
