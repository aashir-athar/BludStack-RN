// components/Button.tsx
// Variants: primary, secondary, ghost, danger, success, outline
// Sizes:    sm, md, lg, xl
//
// 2026 pill-shaped action component. Reanimated v4 scale-on-press for tactility
// (Fitts's Law + dopamine-pacing). Loading state uses an animated pulse on the
// label, never a spinner — per project's no-ActivityIndicator rule.

import React, { useCallback } from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import {
  FontWeight, Spacing, Radius, LetterSpacing,
  PILL_HEIGHT_SM, PILL_HEIGHT_BASE, PILL_HEIGHT_LG, PILL_HEIGHT_XL, Motion,
} from '@/constants/Typography';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
export type ButtonSize    = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps {
  onPress: () => void;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  haptic?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityHint?: string;
}

const SIZE_MAP: Record<ButtonSize, { minHeight: number; fontSize: number; px: number }> = {
  sm: { minHeight: PILL_HEIGHT_SM,   fontSize: 13, px: Spacing[4] },
  md: { minHeight: PILL_HEIGHT_BASE, fontSize: 15, px: Spacing[5] },
  lg: { minHeight: PILL_HEIGHT_LG,   fontSize: 16, px: Spacing[6] },
  xl: { minHeight: PILL_HEIGHT_XL,   fontSize: 17, px: Spacing[7] },
};

function ButtonImpl({
  onPress, label,
  variant = 'primary', size = 'md',
  loading = false, disabled = false, fullWidth = false,
  icon, iconPosition = 'left',
  haptic = true,
  style, textStyle, accessibilityHint,
}: ButtonProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);
  const pulse = useSharedValue(0);

  React.useEffect(() => {
    if (loading) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: Motion.duration.base }),
          withTiming(0, { duration: Motion.duration.base }),
        ),
        -1,
        false,
      );
    } else {
      pulse.value = withTiming(0, { duration: Motion.duration.fast });
    }
  }, [loading, pulse]);

  const handlePressIn = useCallback(() => {
    scale.value = withTiming(0.97, { duration: Motion.duration.instant });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withTiming(1, { duration: Motion.duration.fast });
  }, [scale]);

  const handlePress = useCallback(() => {
    if (loading || disabled) return;
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  }, [loading, disabled, haptic, onPress]);

  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const labelAnim = useAnimatedStyle(() => ({ opacity: interpolate(pulse.value, [0, 1], [1, 0.5]) }));

  const { minHeight, fontSize, px } = SIZE_MAP[size];

  const bg: Record<ButtonVariant, string> = {
    primary:   theme.primary,
    secondary: theme.cardElevated,
    ghost:     'transparent',
    danger:    theme.danger,
    success:   theme.success,
    outline:   'transparent',
  };

  const fg: Record<ButtonVariant, string> = {
    primary:   theme.textOnPrimary,
    secondary: theme.textPrimary,
    ghost:     theme.textPrimary,
    danger:    theme.textOnPrimary,
    success:   theme.textOnPrimary,
    outline:   theme.textPrimary,
  };

  const border: Record<ButtonVariant, ViewStyle> = {
    primary:   {},
    secondary: { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
    ghost:     {},
    danger:    {},
    success:   {},
    outline:   { borderWidth: 1.5, borderColor: theme.textPrimary },
  };

  return (
    <Animated.View style={[fullWidth && styles.fullWidth, aStyle, style]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
        style={({ pressed }) => [
          styles.base,
          {
            minHeight, paddingHorizontal: px,
            backgroundColor: bg[variant],
            opacity: disabled ? 0.4 : pressed ? 0.92 : 1,
          },
          border[variant],
        ]}
      >
        {icon && iconPosition === 'left' && <View style={styles.iconL}>{icon}</View>}
        <Animated.Text
          style={[
            styles.label,
            { color: fg[variant], fontSize },
            labelAnim,
            textStyle,
          ]}
          numberOfLines={1}
        >
          {loading ? 'One moment' : label}
        </Animated.Text>
        {icon && iconPosition === 'right' && <View style={styles.iconR}>{icon}</View>}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
  fullWidth: { alignSelf: 'stretch' },
  label:     { fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.snug },
  iconL:     { marginRight: Spacing[2] },
  iconR:     { marginLeft:  Spacing[2] },
});

export default React.memo(ButtonImpl);
