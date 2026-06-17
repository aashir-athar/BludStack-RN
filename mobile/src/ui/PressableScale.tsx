// ui/PressableScale.tsx
// Tactile press wrapper - scales down on press (Reanimated v4 worklet, UI thread)
// with optional selection haptic. The base interaction primitive for cards/rows.
import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Motion } from '@/constants/Typography';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  scaleTo?: number;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function PressableScale({
  scaleTo = 0.97,
  haptic = false,
  onPressIn,
  onPressOut,
  style,
  children,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPressIn={(e) => {
        scale.value = withTiming(scaleTo, { duration: Motion.duration.instant });
        if (haptic) void Haptics.selectionAsync();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, Motion.spring.snappy);
        onPressOut?.(e);
      }}
      style={[style, animatedStyle]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}

export default PressableScale;
