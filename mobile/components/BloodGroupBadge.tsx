// components/BloodGroupBadge.tsx
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { getBloodGroupColor } from '@/utils/helpers';
import { FontSize, FontWeight, Radius } from '@/constants/Typography';

interface BloodGroupBadgeProps {
  bloodGroup: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  style?: ViewStyle;
  inverted?: boolean;  // solid bg
  showGlow?: boolean;  // legacy compat — same as inverted
}

const CFG = {
  xs: { w: 32, h: 20, fs: FontSize['2xs'], br: Radius.xs },
  sm: { w: 44, h: 26, fs: FontSize.xs,    br: Radius.xs },
  md: { w: 56, h: 32, fs: FontSize.sm,    br: Radius.sm },
  lg: { w: 72, h: 44, fs: FontSize.md,    br: Radius.sm },
  xl: { w: 88, h: 56, fs: FontSize.lg,    br: Radius.base },
};

const BloodGroupBadge = React.memo(function BloodGroupBadge({
  bloodGroup, size = 'md', style, inverted = false, showGlow = false,
}: BloodGroupBadgeProps) {
  const solid = inverted || showGlow;
  const color = getBloodGroupColor(bloodGroup);
  const cfg   = CFG[size];

  return (
    <View style={[
      styles.base,
      {
        width:           cfg.w,
        height:          cfg.h,
        borderRadius:    cfg.br,
        backgroundColor: solid ? color : `${color}1A`,
        borderColor:     color,
        borderWidth:     solid ? 0 : 1.5,
      },
      style,
    ]}>
      <Text style={[
        styles.text,
        { fontSize: cfg.fs, color: solid ? '#fff' : color },
      ]}>
        {bloodGroup}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: FontWeight.black, letterSpacing: -0.3 },
});

export default BloodGroupBadge;