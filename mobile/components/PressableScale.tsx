// components/PressableScale.tsx
// Uber's core tactile primitive — every touchable element uses this.
// Scale 0.96 on press with spring physics. No jank, no flat opacity hacks.
// Psychology: physical feedback = perceived quality = trust.

import React, { useCallback, useRef } from 'react';
import {
  Animated, Pressable, PressableProps, StyleProp, ViewStyle,
} from 'react-native';

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  animatedStyle?: StyleProp<ViewStyle>;
}

const PressableScale = React.memo(function PressableScale({
  children,
  scaleTo = 0.96,
  style,
  onPress,
  onLongPress,
  disabled,
  ...rest
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: scaleTo,
      useNativeDriver: true,
      speed: 300,
      bounciness: 0,
    }).start();
  }, [scale, scaleTo]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 200,
      bounciness: 6,
    }).start();
  }, [scale]);

  return (
    <Pressable
      {...rest}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <Animated.View style={[style, { transform: [{ scale }], opacity: disabled ? 0.4 : 1 }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
});

export default PressableScale;
