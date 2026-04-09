// components/BloodGroupBadge.tsx
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { getBloodGroupColor } from '@/utils/helpers';
import { FontSize, FontWeight, BorderRadius, Spacing } from '@/constants/Typography';

interface BloodGroupBadgeProps {
  bloodGroup: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  style?: ViewStyle;
  showGlow?: boolean;
}

const SIZES = {
  sm: { container: 28, fontSize: FontSize.xs,  borderRadius: BorderRadius.sm },
  md: { container: 40, fontSize: FontSize.sm,  borderRadius: BorderRadius.base },
  lg: { container: 56, fontSize: FontSize.md,  borderRadius: BorderRadius.md },
  xl: { container: 72, fontSize: FontSize.xl,  borderRadius: BorderRadius.lg },
};

const BloodGroupBadge = React.memo(function BloodGroupBadge({
  bloodGroup,
  size = 'md',
  style,
  showGlow = false,
}: BloodGroupBadgeProps) {
  const color = getBloodGroupColor(bloodGroup);
  const cfg = SIZES[size];

  return (
    <View
      style={[
        styles.container,
        {
          width: cfg.container,
          height: cfg.container,
          borderRadius: cfg.borderRadius,
          backgroundColor: `${color}22`,
          borderColor: `${color}88`,
          shadowColor: color,
          shadowOpacity: showGlow ? 0.55 : 0,
          shadowRadius: showGlow ? 10 : 0,
          elevation: showGlow ? 8 : 0,
        },
        style,
      ]}
    >
      <Text style={[styles.label, { fontSize: cfg.fontSize, color }]}>
        {bloodGroup}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 0 },
  },
  label: {
    fontWeight: FontWeight.black,
    letterSpacing: -0.3,
  },
});

export default BloodGroupBadge;
