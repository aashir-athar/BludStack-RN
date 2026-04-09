// components/Button.tsx
import React, { useCallback } from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { FontSize, FontWeight, BorderRadius, Spacing } from '@/constants/Typography';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  onPress: () => void;
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const Button = React.memo(function Button({
  onPress,
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
}: ButtonProps) {
  const { theme, isDark } = useTheme();

  const handlePress = useCallback(() => {
    if (!loading && !disabled) onPress();
  }, [loading, disabled, onPress]);

  const containerStyle = useCallback((): ViewStyle[] => {
    const base: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: BorderRadius.md,
      opacity: disabled ? 0.45 : 1,
      alignSelf: fullWidth ? 'stretch' : 'auto',
    };

    const sizes: Record<Size, ViewStyle> = {
      sm: { paddingVertical: Spacing[2], paddingHorizontal: Spacing[4], minHeight: 36 },
      md: { paddingVertical: Spacing[3], paddingHorizontal: Spacing[6], minHeight: 48 },
      lg: { paddingVertical: Spacing[4], paddingHorizontal: Spacing[8], minHeight: 58 },
    };

    const variants: Record<Variant, ViewStyle> = {
      primary:   { backgroundColor: theme.primary },
      secondary: { backgroundColor: theme.accent },
      ghost:     { backgroundColor: 'transparent' },
      danger:    { backgroundColor: theme.error },
      success:   { backgroundColor: theme.success },
      outline:   { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: theme.primary },
    };

    return [base, sizes[size], variants[variant], style as ViewStyle].filter(Boolean) as ViewStyle[];
  }, [variant, size, disabled, fullWidth, theme, style]);

  const labelStyle = useCallback((): TextStyle => {
    const sizes: Record<Size, TextStyle> = {
      sm: { fontSize: FontSize.sm, letterSpacing: 0.3 },
      md: { fontSize: FontSize.base, letterSpacing: 0.4 },
      lg: { fontSize: FontSize.md, letterSpacing: 0.5 },
    };

    const variantText: Record<Variant, TextStyle> = {
      primary:   { color: '#FFFFFF' },
      secondary: { color: '#FFFFFF' },
      ghost:     { color: theme.accent },
      danger:    { color: '#FFFFFF' },
      success:   { color: '#FFFFFF' },
      outline:   { color: theme.primary },
    };

    return {
      fontWeight: FontWeight.semibold,
      ...sizes[size],
      ...variantText[variant],
      ...textStyle,
    };
  }, [variant, size, theme, textStyle]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.78}
      disabled={disabled || loading}
      style={containerStyle()}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'ghost' || variant === 'outline' ? theme.primary : '#FFFFFF'}
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <View style={styles.iconLeft}>{icon}</View>
          )}
          <Text style={labelStyle()}>{label}</Text>
          {icon && iconPosition === 'right' && (
            <View style={styles.iconRight}>{icon}</View>
          )}
        </>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  iconLeft:  { marginRight: Spacing[2] },
  iconRight: { marginLeft: Spacing[2] },
});

export default Button;
