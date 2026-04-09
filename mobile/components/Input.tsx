// components/Input.tsx
import React, { useState, useCallback, forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { FontSize, FontWeight, BorderRadius, Spacing } from '@/constants/Typography';

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
  {
    label,
    error,
    hint,
    leftIcon,
    rightIcon,
    onRightIconPress,
    containerStyle,
    style,
    ...props
  },
  ref
) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);

  const handleFocus = useCallback((e: any) => {
    setFocused(true);
    props.onFocus?.(e);
  }, [props]);

  const handleBlur = useCallback((e: any) => {
    setFocused(false);
    props.onBlur?.(e);
  }, [props]);

  const borderColor = error
    ? theme.error
    : focused
    ? theme.inputFocus
    : theme.inputBorder;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text
          style={[
            styles.label,
            { color: error ? theme.error : focused ? theme.accent : theme.textSecondary },
          ]}
        >
          {label}
        </Text>
      )}
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: theme.inputBg,
            borderColor,
            borderWidth: focused ? 1.5 : 1,
          },
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <TextInput
          ref={ref}
          {...props}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor={theme.textMuted}
          style={[
            styles.input,
            { color: theme.textPrimary, flex: 1 },
            leftIcon ? styles.inputWithLeft : null,
            rightIcon ? styles.inputWithRight : null,
            style,
          ]}
        />
        {rightIcon && (
          <TouchableOpacity
            onPress={onRightIconPress}
            style={styles.rightIcon}
            accessibilityRole="button"
          >
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>
      {(error || hint) && (
        <Text
          style={[
            styles.helperText,
            { color: error ? theme.error : theme.textMuted },
          ]}
        >
          {error ?? hint}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container:     { marginBottom: Spacing[4] },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing[1.5],
    letterSpacing: 0.3,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.base,
    overflow: 'hidden',
    minHeight: 50,
  },
  input: {
    fontSize: FontSize.base,
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[4],
  },
  inputWithLeft:  { paddingLeft: Spacing[2] },
  inputWithRight: { paddingRight: Spacing[2] },
  leftIcon:   { paddingLeft: Spacing[4] },
  rightIcon:  { paddingRight: Spacing[4] },
  helperText: {
    fontSize: FontSize.xs,
    marginTop: Spacing[1],
    marginLeft: Spacing[1],
  },
});

export default Input;
