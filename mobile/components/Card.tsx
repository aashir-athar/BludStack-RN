// components/Card.tsx
// Variants: surface (default) | elevated | ghost | tinted
// Generic theme-tokenized surface with optional press feedback.

import React from 'react';
import {
  View, Pressable, StyleSheet, ViewStyle, StyleProp,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Radius, Spacing, Elevation } from '@/constants/Typography';

export type CardVariant = 'surface' | 'elevated' | 'ghost' | 'tinted';

export interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  noPadding?: boolean;
  /** Backwards-compat — `elevated` flag maps to variant='elevated'. */
  elevated?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

const Card = React.memo(function Card({
  children, variant, radius = Radius.lg, style, noPadding, elevated, onPress, accessibilityLabel,
}: CardProps) {
  const { theme } = useTheme();
  const v: CardVariant = variant ?? (elevated ? 'elevated' : 'surface');

  const bg =
    v === 'elevated' ? theme.cardElevated
    : v === 'tinted' ? theme.primarySoft
    : v === 'ghost'  ? 'transparent'
    :                  theme.card;

  const borderColor = v === 'ghost' ? 'transparent' : theme.border;

  const baseStyle: ViewStyle[] = [
    styles.card,
    {
      borderRadius: radius,
      backgroundColor: bg,
      borderColor,
      borderWidth: v === 'ghost' ? 0 : StyleSheet.hairlineWidth,
    },
    v === 'elevated' && Elevation.base,
    noPadding ? undefined : styles.padding,
  ].filter(Boolean) as ViewStyle[];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [...baseStyle, pressed && { opacity: 0.92 }, style as ViewStyle]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[...baseStyle, style as ViewStyle]}>{children}</View>;
});

const styles = StyleSheet.create({
  card:    {},
  padding: { padding: Spacing[4] },
});

export default Card;
