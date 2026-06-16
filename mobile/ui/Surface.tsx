// ui/Surface.tsx
// Platform-aware translucent surface — the non-negotiable decision tree lives
// here so no screen ever reaches for BlurView / GlassView directly:
//   • iOS >= 26 -> expo-glass-effect (Liquid Glass)
//   • iOS < 26  -> expo-blur BlurView
//   • Android   -> flat themed container with elevation (never blur/glass)
// Variants: solid (default) / elevated / glass / ghost.
import React from 'react';
import {
  Platform, StyleSheet, View, type ViewProps, type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Elevation, Radius } from '@/constants/Typography';
import { useAppTheme, useIsDark } from '@/stores/themeStore';

// expo-glass-effect is iOS-26-only; require it lazily so Android never loads the
// native module (the Platform.OS guard tree-shakes the use site).
type GlassModule = {
  GlassView: React.ComponentType<ViewProps & { glassEffectStyle?: string; tintColor?: string }>;
  isLiquidGlassAvailable: () => boolean;
};
let glass: GlassModule | null = null;
if (Platform.OS === 'ios') {
  try {
    // Lazy require by design: expo-glass-effect is an iOS-26-only native module;
    // the Platform.OS guard keeps Android from ever loading it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    glass = require('expo-glass-effect') as GlassModule;
  } catch {
    glass = null;
  }
}

export type SurfaceVariant = 'solid' | 'elevated' | 'glass' | 'ghost';

export interface SurfaceProps extends ViewProps {
  variant?: SurfaceVariant;
  radius?: number;
  /** Blur intensity for the iOS < 26 fallback (0-100). */
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  children?: React.ReactNode;
}

function SurfaceImpl({
  variant = 'solid',
  radius = Radius.lg,
  intensity = 32,
  tint,
  style,
  children,
  ...rest
}: SurfaceProps) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const base: ViewStyle = { borderRadius: radius, overflow: 'hidden' };

  if (variant === 'glass') {
    if (Platform.OS === 'ios') {
      if (glass && glass.isLiquidGlassAvailable()) {
        const Glass = glass.GlassView;
        return (
          <Glass
            style={[base, style]}
            glassEffectStyle="regular"
            tintColor={tint === 'dark' ? '#0F0E14' : tint === 'light' ? '#FAF8F5' : undefined}
            {...rest}
          >
            {children}
          </Glass>
        );
      }
      return (
        <BlurView intensity={intensity} tint={tint ?? (isDark ? 'dark' : 'light')} style={[base, style]} {...rest}>
          {children}
        </BlurView>
      );
    }
    // Android — flat themed surface with elevation.
    return (
      <View
        style={[base, { backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border }, Elevation.sm, style]}
        {...rest}
      >
        {children}
      </View>
    );
  }

  const bg = variant === 'ghost' ? 'transparent' : variant === 'elevated' ? theme.cardElevated : theme.surface;

  return (
    <View
      style={[
        base,
        { backgroundColor: bg },
        variant !== 'ghost' && { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
        variant === 'elevated' && Elevation.base,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

export const Surface = React.memo(SurfaceImpl);
export default Surface;
