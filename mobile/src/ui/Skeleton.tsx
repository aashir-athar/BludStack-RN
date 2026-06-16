// ui/Skeleton.tsx
// The ONLY loading primitive — a Reanimated shimmer placeholder. Never an
// ActivityIndicator, never a spinner. Match the geometry of the content it
// stands in for, then swap it out when data arrives.
import React, { useEffect } from 'react';
import { type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import { Radius } from '@/constants/Typography';
import { useAppTheme } from '@/stores/themeStore';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

function SkeletonImpl({ width = '100%', height = 16, radius = Radius.sm, style }: SkeletonProps) {
  const theme = useAppTheme();
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.9, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, borderRadius: radius, backgroundColor: theme.surfaceMuted },
        animatedStyle,
        style,
      ]}
    />
  );
}

export const Skeleton = React.memo(SkeletonImpl);
export default Skeleton;
