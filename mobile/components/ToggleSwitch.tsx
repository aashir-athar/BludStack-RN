// components/ToggleSwitch.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Canonical 2026-style pill toggle for the entire app. NEVER use the native
// `<Switch>` directly — design consistency across platforms is the whole point.
// The thumb is animated on the UI thread via Reanimated v4 worklets.
//
// Two visual variants:
//   • `card`    (default) — bordered surface card with full padding. Use this
//                everywhere a toggle stands on its own (profile edit, onboarding
//                share/availability toggles, settings rows on profile/edit).
//   • `inline`  — flush row with no background. Use this inside an already-
//                bordered container (e.g. (tabs)/profile section cards).
//
// Both variants share the same pill thumb so the visual identity is identical;
// only the row chrome differs.
// ──────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, withTiming, Easing,
  interpolateColor,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import {
  FontSize, FontWeight, LetterSpacing, Radius, Spacing,
} from '@/constants/Typography';

export interface ToggleSwitchProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  iconName?: keyof typeof Ionicons.glyphMap;
  /** Legacy string icon — ignored. */
  icon?: string;
  disabled?: boolean;
  /** 'card' (default) is the standalone bordered row; 'inline' is flush. */
  variant?: 'card' | 'inline';
}

// Track + thumb dimensions — single source of truth so every toggle looks
// pixel-identical across screens.
const TRACK_W   = 48;
const TRACK_H   = 28;
const THUMB     = 22;
const THUMB_PAD = (TRACK_H - THUMB) / 2;     // 3
const THUMB_MAX = TRACK_W - THUMB - THUMB_PAD * 2; // 20

const ToggleSwitch = React.memo(function ToggleSwitch({
  label, description, value, onValueChange,
  iconName, disabled = false, variant = 'card',
}: ToggleSwitchProps) {
  const { theme } = useTheme();

  // Single animated progress 0→1 drives both thumb position and track color.
  const progress = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, {
      damping: 18, stiffness: 240, mass: 0.5,
    });
  }, [value, progress]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: THUMB_PAD + progress.value * THUMB_MAX },
    ],
  }));

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [theme.cardElevated, theme.primary],
    ),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [theme.border, theme.primary],
    ),
  }));

  const onPress = () => {
    if (disabled) return;
    Haptics.selectionAsync().catch(() => {});
    onValueChange(!value);
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        variant === 'card' ? styles.cardRow : styles.inlineRow,
        variant === 'card' && {
          backgroundColor: theme.cardElevated,
          borderColor: theme.border,
        },
        {
          opacity: disabled ? 0.5 : pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={styles.left}>
        {iconName && (
          <View style={[styles.iconPill, { backgroundColor: theme.surface }]}>
            <Ionicons name={iconName} size={16} color={theme.textPrimary} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: theme.textPrimary }]}>{label}</Text>
          {description && (
            <Text style={[styles.desc, { color: theme.textMuted }]}>{description}</Text>
          )}
        </View>
      </View>

      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View
          style={[
            styles.thumb,
            { backgroundColor: theme.surface, shadowColor: '#000' },
            thumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[4],
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingVertical: Spacing[3],
  },
  left:    { flexDirection: 'row', alignItems: 'center', flex: 1, gap: Spacing[3] },
  iconPill: {
    width: 32, height: 32, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  label:   { fontSize: FontSize.sm, fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.snug },
  desc:    { fontSize: FontSize.xs, marginTop: 2, lineHeight: FontSize.xs * 1.5 },
  track: {
    width: TRACK_W, height: TRACK_H,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB, height: THUMB,
    borderRadius: THUMB / 2,
    shadowOpacity: 0.18, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});

export default ToggleSwitch;
