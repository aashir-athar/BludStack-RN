// ui/Button.tsx
// Pill button. Variants: primary/secondary/ghost/danger/success/outline; sizes
// sm/md/lg/xl. Scale-on-press + optional commit haptic (Reanimated v4 worklets).
// Loading state is a LABEL PULSE - never an ActivityIndicator/spinner.
import React, { useEffect } from 'react';
import {
  Pressable, StyleSheet, type StyleProp, type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import {
  Radius, Spacing, FontSize, FontWeight, LetterSpacing, Motion,
  PILL_HEIGHT_SM, PILL_HEIGHT_BASE, PILL_HEIGHT_LG, PILL_HEIGHT_XL,
} from '@/constants/Typography';
import { useAppTheme } from '@/stores/themeStore';
import type { ThemeColors } from '@/constants/Colors';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
  haptic?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

function colorsFor(variant: ButtonVariant, theme: ThemeColors) {
  switch (variant) {
    case 'primary':   return { bg: theme.primary, fg: theme.textOnPrimary, border: 'transparent' };
    case 'secondary': return { bg: theme.pillBg, fg: theme.textPrimary, border: 'transparent' };
    case 'ghost':     return { bg: 'transparent', fg: theme.primary, border: 'transparent' };
    case 'danger':    return { bg: theme.danger, fg: theme.textOnPrimary, border: 'transparent' };
    case 'success':   return { bg: theme.success, fg: theme.textOnPrimary, border: 'transparent' };
    case 'outline':   return { bg: 'transparent', fg: theme.textPrimary, border: theme.borderStrong };
  }
}

function dimsFor(size: ButtonSize) {
  switch (size) {
    case 'sm': return { height: PILL_HEIGHT_SM,   fontSize: FontSize.xs,   padX: Spacing[4], iconSize: 16 };
    case 'md': return { height: PILL_HEIGHT_BASE, fontSize: FontSize.sm,   padX: Spacing[5], iconSize: 18 };
    case 'lg': return { height: PILL_HEIGHT_LG,   fontSize: FontSize.base, padX: Spacing[6], iconSize: 20 };
    case 'xl': return { height: PILL_HEIGHT_XL,   fontSize: FontSize.md,   padX: Spacing[7], iconSize: 22 };
  }
}

function ButtonImpl({
  label, onPress, variant = 'primary', size = 'lg',
  loading = false, loadingLabel, disabled = false,
  icon, iconRight, fullWidth = false, haptic = true,
  accessibilityLabel, style,
}: ButtonProps) {
  const theme = useAppTheme();
  const scale = useSharedValue(1);
  const pulse = useSharedValue(1);
  const isDisabled = disabled || loading;

  useEffect(() => {
    pulse.value = loading
      ? withRepeat(withTiming(0.45, { duration: 620 }), -1, true)
      : withTiming(1, { duration: Motion.duration.fast });
  }, [loading, pulse]);

  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const c = colorsFor(variant, theme);
  const d = dimsFor(size);

  return (
    <AnimatedPressable
      disabled={isDisabled}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.97, { duration: Motion.duration.instant });
        if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }}
      onPressOut={() => { scale.value = withSpring(1, Motion.spring.snappy); }}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.base,
        {
          height: d.height,
          paddingHorizontal: d.padX,
          backgroundColor: c.bg,
          borderColor: c.border,
          borderWidth: c.border === 'transparent' ? 0 : 1.5,
          opacity: isDisabled && !loading ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        scaleStyle,
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={d.iconSize} color={c.fg} style={{ marginRight: Spacing[2] }} /> : null}
      <Animated.Text
        numberOfLines={1}
        style={[
          { color: c.fg, fontSize: d.fontSize, fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.snug },
          pulseStyle,
        ]}
      >
        {loading ? (loadingLabel ?? label) : label}
      </Animated.Text>
      {iconRight ? <Ionicons name={iconRight} size={d.iconSize} color={c.fg} style={{ marginLeft: Spacing[2] }} /> : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
});

export const Button = React.memo(ButtonImpl);
export default Button;
