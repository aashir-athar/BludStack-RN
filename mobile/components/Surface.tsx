// components/Surface.tsx
// Variants: solid (default), elevated, glass, ghost
//
// The platform-aware translucent surface, per the non-negotiable decision tree:
//   • iOS ≥ 26  → expo-glass-effect (Liquid Glass)
//   • iOS < 26  → expo-blur BlurView
//   • Android   → flat themed container with elevation (NEVER blur, NEVER glass)
//
// Components and screens never reach for BlurView / GlassView directly —
// they request a Surface variant and let this file own the platform fork.

import React from 'react';
import { Platform, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/contexts/ThemeContext';
import { Elevation, Radius } from '@/constants/Typography';

// expo-glass-effect is iOS-26-only. We require it lazily so Android bundles
// don't try to load the native module. The dynamic require is tree-shaken
// on Android because of the Platform.OS guard at the use site.
let GlassView: any = null;
let isLiquidGlassAvailable: (() => boolean) | null = null;
if (Platform.OS === 'ios') {
  try {
    const mod = require('expo-glass-effect');
    GlassView = mod.GlassView;
    isLiquidGlassAvailable = mod.isLiquidGlassAvailable;
  } catch {
    GlassView = null;
  }
}

export type SurfaceVariant = 'solid' | 'elevated' | 'glass' | 'ghost';

export interface SurfaceProps extends ViewProps {
  variant?: SurfaceVariant;
  radius?: number;
  /** Blur intensity (iOS < 26 fallback). 0–100. */
  intensity?: number;
  /** Glass tint on iOS 26. 'systemMaterial' is the safest default. */
  tint?: 'light' | 'dark' | 'default';
  children?: React.ReactNode;
}

function Surface({
  variant = 'solid',
  radius = Radius.lg,
  intensity = 32,
  tint,
  style,
  children,
  ...rest
}: SurfaceProps) {
  const { theme, isDark } = useTheme();

  const baseStyle: ViewStyle = {
    borderRadius: radius,
    overflow: 'hidden',
  };

  // ── Glass variant ────────────────────────────────────────────────────────
  if (variant === 'glass') {
    if (Platform.OS === 'ios') {
      const canUseLiquidGlass = !!(GlassView && isLiquidGlassAvailable && isLiquidGlassAvailable());
      if (canUseLiquidGlass) {
        return (
          <GlassView
            style={[baseStyle, style as any]}
            glassEffectStyle="regular"
            tintColor={tint === 'dark' ? '#0F0E14' : tint === 'light' ? '#FAF8F5' : undefined}
            {...rest}
          >
            {children}
          </GlassView>
        );
      }
      // iOS < 26 fallback
      return (
        <BlurView
          intensity={intensity}
          tint={tint ?? (isDark ? 'dark' : 'light')}
          style={[baseStyle, style as any]}
          {...rest}
        >
          {children}
        </BlurView>
      );
    }
    // Android — flat themed surface with elevation
    return (
      <View
        style={[
          baseStyle,
          { backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
          Elevation.sm,
          style as any,
        ]}
        {...rest}
      >
        {children}
      </View>
    );
  }

  // ── Solid / Elevated / Ghost ────────────────────────────────────────────
  const bg =
    variant === 'ghost'    ? 'transparent'
    : variant === 'elevated' ? theme.cardElevated
    :                          theme.surface;

  const elev = variant === 'elevated' ? Elevation.base : Elevation.xs;

  return (
    <View
      style={[
        baseStyle,
        { backgroundColor: bg },
        variant !== 'ghost' && { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
        variant === 'elevated' && elev,
        style as any,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

export default React.memo(Surface);
