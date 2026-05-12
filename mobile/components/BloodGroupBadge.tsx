// components/BloodGroupBadge.tsx
// Variants: solid (filled crimson, white text) | soft (tinted bg, crimson text)
//           | outline (transparent, bordered) | ghost (no border, no fill)
// Sizes:    xs | sm | md | lg | xl
//
// Pill-shaped, theme-tokenized. Reads from theme.primary so it follows the
// active palette. No hardcoded hex.

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { FontSize, FontWeight, LetterSpacing, Radius } from '@/constants/Typography';

export type BloodGroupBadgeVariant = 'solid' | 'soft' | 'outline' | 'ghost';
export type BloodGroupBadgeSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface BloodGroupBadgeProps {
  bloodGroup: string;
  size?: BloodGroupBadgeSize;
  variant?: BloodGroupBadgeVariant;
  style?: ViewStyle;
  /** Legacy compat — true == solid. */
  inverted?: boolean;
  showGlow?: boolean;
}

const SIZE_CFG: Record<BloodGroupBadgeSize, { px: number; py: number; fs: number; minW: number }> = {
  xs: { px: 8,  py: 3,  fs: FontSize['2xs'], minW: 34 },
  sm: { px: 10, py: 4,  fs: FontSize.xs,     minW: 44 },
  md: { px: 12, py: 6,  fs: FontSize.sm,     minW: 56 },
  lg: { px: 16, py: 10, fs: FontSize.md,     minW: 72 },
  xl: { px: 20, py: 14, fs: FontSize.lg,     minW: 88 },
};

const BloodGroupBadge = React.memo(function BloodGroupBadge({
  bloodGroup, size = 'md', variant, inverted, showGlow, style,
}: BloodGroupBadgeProps) {
  const { theme } = useTheme();
  const resolvedVariant: BloodGroupBadgeVariant =
    variant ?? ((inverted || showGlow) ? 'solid' : 'soft');
  const cfg = SIZE_CFG[size];

  let bg: string, fg: string, borderColor: string, borderWidth = 0;
  switch (resolvedVariant) {
    case 'solid':
      bg = theme.primary; fg = theme.textOnPrimary; borderColor = 'transparent';
      break;
    case 'outline':
      bg = 'transparent'; fg = theme.primary; borderColor = theme.primary; borderWidth = 1.5;
      break;
    case 'ghost':
      bg = 'transparent'; fg = theme.primary; borderColor = 'transparent';
      break;
    case 'soft':
    default:
      bg = theme.primarySoft; fg = theme.primary; borderColor = 'transparent';
  }

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Blood group ${bloodGroup}`}
      style={[
        styles.base,
        {
          paddingHorizontal: cfg.px, paddingVertical: cfg.py,
          minWidth: cfg.minW,
          backgroundColor: bg, borderColor, borderWidth,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { fontSize: cfg.fs, color: fg }]}>{bloodGroup}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill },
  text: { fontWeight: FontWeight.black, letterSpacing: LetterSpacing.tight },
});

export default BloodGroupBadge;
