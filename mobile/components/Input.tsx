// components/Input.tsx
// Variants: text (default), pill, area
// Sizes:    md (default), lg
//
// 2026 pill input. Animated focus ring via Reanimated worklets, integrated
// label/error/hint hierarchy, no Alerts — field-level errors live inline.

import React, { useState, useCallback, forwardRef, useMemo } from 'react';
import {
  View, Text, TextInput, TextInputProps, StyleSheet, Pressable,
} from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withTiming, interpolateColor,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import {
  Spacing, Radius, FontSize, FontWeight, LetterSpacing, PILL_HEIGHT_LG, PILL_HEIGHT_XL, Motion,
} from '@/constants/Typography';

export type InputVariant = 'text' | 'pill' | 'area';
export type InputSize    = 'md' | 'lg';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  variant?: InputVariant;
  size?: InputSize;
  containerStyle?: object;
  style?: TextInputProps['style'];
}

const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label, error, hint, leftIcon, rightIcon, onRightIconPress,
    variant = 'pill', size = 'lg', containerStyle, style, ...props
  },
  ref,
) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const focus = useSharedValue(0);

  const handleFocus = useCallback((e: any) => {
    setFocused(true);
    focus.value = withTiming(1, { duration: Motion.duration.fast });
    props.onFocus?.(e);
  }, [focus, props]);
  const handleBlur = useCallback((e: any) => {
    setFocused(false);
    focus.value = withTiming(0, { duration: Motion.duration.fast });
    props.onBlur?.(e);
  }, [focus, props]);

  const borderStyle = useAnimatedStyle(() => {
    const errorActive = error ? 1 : 0;
    return {
      borderColor: interpolateColor(
        Math.max(focus.value, errorActive),
        [0, 1],
        [theme.inputBorder, error ? theme.inputError : theme.inputFocus],
      ),
      borderWidth: 1.5,
    };
  });

  const minHeight = variant === 'area'
    ? 110
    : size === 'lg' ? PILL_HEIGHT_XL : PILL_HEIGHT_LG;

  const radius = variant === 'area'
    ? Radius.lg
    : variant === 'pill' ? Radius.pill : Radius.base;

  const labelColor = error ? theme.inputError : focused ? theme.textPrimary : theme.textSecondary;

  const containerStyles = useMemo(
    () => [{ gap: label ? Spacing[2] : 0 }, containerStyle],
    [label, containerStyle],
  );

  return (
    <View style={containerStyles}>
      {label && (
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      )}

      <Animated.View
        style={[
          styles.row,
          {
            backgroundColor: theme.inputBg,
            borderRadius: radius,
            minHeight,
            alignItems: variant === 'area' ? 'flex-start' : 'center',
            paddingVertical: variant === 'area' ? Spacing[3] : 0,
          },
          borderStyle,
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <TextInput
          ref={ref}
          {...props}
          onFocus={handleFocus}
          onBlur={handleBlur}
          multiline={variant === 'area' || props.multiline}
          placeholderTextColor={theme.placeholder}
          selectionColor={theme.primary}
          style={[
            styles.input,
            {
              color: theme.textPrimary,
              paddingLeft:  leftIcon  ? Spacing[2] : variant === 'pill' ? Spacing[5] : Spacing[4],
              paddingRight: rightIcon ? Spacing[2] : variant === 'pill' ? Spacing[5] : Spacing[4],
              minHeight: variant === 'area' ? 80 : undefined,
              textAlignVertical: variant === 'area' ? 'top' : 'center',
            },
            style,
          ]}
        />
        {rightIcon && (
          <Pressable
            onPress={onRightIconPress}
            style={styles.rightIcon}
            hitSlop={8}
            disabled={!onRightIconPress}
          >
            {rightIcon}
          </Pressable>
        )}
      </Animated.View>

      {(error || hint) && (
        <Text style={[styles.helper, { color: error ? theme.inputError : theme.textMuted }]}>
          {error ?? hint}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: LetterSpacing.wider,
    textTransform: 'uppercase',
    marginLeft: Spacing[2],
  },
  row: { flexDirection: 'row' },
  input: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    paddingVertical: Spacing[3],
  },
  leftIcon:  { paddingLeft:  Spacing[4], alignSelf: 'center' },
  rightIcon: { paddingRight: Spacing[4], alignSelf: 'center' },
  helper: {
    fontSize: FontSize.xs,
    marginLeft: Spacing[4],
    marginTop: Spacing[1],
  },
});

export default Input;
