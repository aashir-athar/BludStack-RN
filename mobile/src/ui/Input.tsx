// Text field with label-above, animated focus ring, and inline error. Works
// standalone or inside a react-hook-form Controller. Variants: text / pill / area.
import React, { forwardRef, useState } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import Animated, {
  interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Spacing, FontSize, FontWeight, Motion } from '@/constants/Typography';
import { useAppTheme } from '@/stores/themeStore';
import { Text } from './Text';

const AnimatedView = Animated.createAnimatedComponent(View);

export type InputVariant = 'text' | 'pill' | 'area';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  helper?: string;
  variant?: InputVariant;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, helper, variant = 'text', leftIcon, rightIcon, onRightIconPress, onFocus, onBlur, ...rest },
  ref,
) {
  const theme = useAppTheme();
  const reduceMotion = useReducedMotion();
  const focus = useSharedValue(0);
  const [focused, setFocused] = useState(false);

  const borderStyle = useAnimatedStyle(() => {
    const to = error ? theme.inputError : theme.inputFocus;
    return {
      borderColor: error
        ? theme.inputError
        : interpolateColor(focus.value, [0, 1], [theme.inputBorder, to]),
    };
  });

  const radius = variant === 'pill' ? Radius.pill : Radius.base;

  return (
    <View style={{ gap: Spacing[2] }}>
      {label ? (
        <Text variant="label" tone="secondary" accessibilityRole="text">
          {label}
        </Text>
      ) : null}

      <AnimatedView
        style={[
          {
            flexDirection: 'row',
            alignItems: variant === 'area' ? 'flex-start' : 'center',
            gap: Spacing[2],
            backgroundColor: theme.inputBg,
            borderWidth: 1.5,
            borderRadius: radius,
            borderCurve: 'continuous',
            paddingHorizontal: Spacing[4],
            paddingVertical: variant === 'area' ? Spacing[3] : 0,
            minHeight: variant === 'area' ? 96 : 52,
          },
          borderStyle,
        ]}
      >
        {leftIcon ? <Ionicons name={leftIcon} size={20} color={theme.textTertiary} /> : null}

        <TextInput
          ref={ref}
          placeholderTextColor={theme.placeholder}
          multiline={variant === 'area'}
          onFocus={(e) => {
            setFocused(true);
            focus.value = reduceMotion ? 1 : withTiming(1, { duration: Motion.duration.fast });
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            focus.value = reduceMotion ? 0 : withTiming(0, { duration: Motion.duration.fast });
            onBlur?.(e);
          }}
          style={{
            flex: 1,
            color: theme.textPrimary,
            fontSize: FontSize.base,
            fontWeight: FontWeight.medium,
            paddingVertical: variant === 'area' ? 0 : Spacing[4],
            textAlignVertical: variant === 'area' ? 'top' : 'center',
          }}
          {...rest}
        />

        {rightIcon ? (
          <Pressable
            onPress={onRightIconPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Toggle field"
          >
            <Ionicons name={rightIcon} size={20} color={focused ? theme.primary : theme.textTertiary} />
          </Pressable>
        ) : null}
      </AnimatedView>

      {error ? (
        <Text variant="caption" tone="danger">{error}</Text>
      ) : helper ? (
        <Text variant="caption" tone="tertiary">{helper}</Text>
      ) : null}
    </View>
  );
});
