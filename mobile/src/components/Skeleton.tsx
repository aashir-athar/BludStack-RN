// components/Skeleton.tsx
// Shimmer loading placeholder. Replaces ActivityIndicator across the app —
// per the project's memory rule: "every loading/pending state uses shimmer
// skeleton placeholders shaped like the content; never ActivityIndicator."
//
// Reanimated v4 worklet-based loop. New Arch / SDK 54 friendly.

import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { Radius } from '@/constants/Typography';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle | ViewStyle[];
}

export default function Skeleton({
  width = '100%',
  height = 16,
  radius = Radius.sm,
  style,
}: SkeletonProps) {
  const { isDark } = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.55, 1]),
  }));

  const baseColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: baseColor },
        animatedStyle,
        style as any,
      ]}
    />
  );
}

interface SkeletonGroupProps {
  count?: number;
  spacing?: number;
  itemHeight?: number;
  itemRadius?: number;
  style?: ViewStyle | ViewStyle[];
}

/**
 * SkeletonGroup — stacked skeleton rows for list placeholders.
 */
export function SkeletonGroup({
  count = 4,
  spacing = 12,
  itemHeight = 60,
  itemRadius = Radius.md,
  style,
}: SkeletonGroupProps) {
  return (
    <View style={[skeletonGroupStyles.wrap, style as any]}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          key={`sk-${i}`}
          height={itemHeight}
          radius={itemRadius}
          style={{ marginTop: i === 0 ? 0 : spacing }}
        />
      ))}
    </View>
  );
}

const skeletonGroupStyles = StyleSheet.create({
  wrap: { width: '100%' },
});
