// components/Input.tsx
import React, { useState, useCallback, forwardRef } from 'react';
import { View, Text, TextInput, TextInputProps, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { FontSize, FontWeight, Spacing, Radius, LetterSpacing } from '@/constants/Typography';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  containerStyle?: object;
}

const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, hint, leftIcon, rightIcon, onRightIconPress, containerStyle, style, ...props }, ref,
) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);

  const handleFocus = useCallback((e: any) => { setFocused(true);  props.onFocus?.(e); }, [props]);
  const handleBlur  = useCallback((e: any) => { setFocused(false); props.onBlur?.(e);  }, [props]);

  const borderColor = error ? theme.error : focused ? theme.inputFocus : theme.inputBorder;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, {
          color: error ? theme.error : focused ? theme.textPrimary : theme.textSecondary,
        }]}>
          {label}
        </Text>
      )}
      <View style={[styles.row, {
        backgroundColor: theme.inputBg,
        borderColor,
        borderWidth: focused ? 1.5 : StyleSheet.hairlineWidth,
        borderRadius: Radius.sm,
      }]}>
        {leftIcon  && <View style={styles.leftIcon}>{leftIcon}</View>}
        <TextInput
          ref={ref}
          {...props}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor={theme.textMuted}
          style={[styles.input, { color: theme.textPrimary }, style]}
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress} style={styles.rightIcon} activeOpacity={0.7}>
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>
      {(error || hint) && (
        <Text style={[styles.helper, { color: error ? theme.error : theme.textMuted }]}>
          {error ?? hint}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container:  { gap: Spacing[1] },
  label:      { fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.wider, textTransform: 'uppercase' },
  row:        { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  input:      { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.medium, paddingVertical: Spacing[3], paddingHorizontal: Spacing[4] },
  leftIcon:   { paddingLeft: Spacing[4] },
  rightIcon:  { paddingRight: Spacing[4] },
  helper:     { fontSize: FontSize.xs, paddingHorizontal: Spacing[1] },
});

export default Input;
