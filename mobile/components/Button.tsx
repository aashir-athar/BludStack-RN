// components/Button.tsx
import React, { useCallback } from 'react';
import {
  TouchableOpacity, Text, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle, View,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { FontSize, FontWeight, Spacing, Radius, LetterSpacing } from '@/constants/Typography';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
type Size    = 'sm' | 'md' | 'lg';

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
  onPress, label, variant = 'primary', size = 'md',
  loading = false, disabled = false, fullWidth = false,
  icon, iconPosition = 'left', style, textStyle,
}: ButtonProps) {
  const { theme } = useTheme();

  const handlePress = useCallback(() => {
    if (!loading && !disabled) onPress();
  }, [loading, disabled, onPress]);

  const sizePad: Record<Size, ViewStyle> = {
    sm: { paddingVertical: Spacing[2],   paddingHorizontal: Spacing[4],  minHeight: 38 },
    md: { paddingVertical: Spacing[3],   paddingHorizontal: Spacing[6],  minHeight: 50 },
    lg: { paddingVertical: Spacing['3.5'], paddingHorizontal: Spacing[8], minHeight: 58 },
  };

  const bgMap: Record<Variant, string> = {
    primary:   theme.primary,
    secondary: theme.textPrimary,
    ghost:     'transparent',
    danger:    '#E8002D',
    success:   '#00A651',
    outline:   'transparent',
  };

  const textColorMap: Record<Variant, string> = {
    primary:   '#FFFFFF',
    secondary: theme.textInverse,
    ghost:     theme.textPrimary,
    danger:    '#FFFFFF',
    success:   '#FFFFFF',
    outline:   theme.textPrimary,
  };

  const borderMap: Record<Variant, ViewStyle> = {
    primary:   {},
    secondary: {},
    ghost:     {},
    danger:    {},
    success:   {},
    outline:   { borderWidth: 1.5, borderColor: theme.textPrimary },
  };

  const fontSizeMap: Record<Size, number> = {
    sm: FontSize.sm,
    md: FontSize.base,
    lg: FontSize.md,
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.75}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.base,
        sizePad[size],
        { backgroundColor: bgMap[variant], opacity: disabled ? 0.38 : 1 },
        borderMap[variant],
        fullWidth ? styles.fullWidth : undefined,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'ghost' || variant === 'outline' ? theme.textPrimary : '#FFFFFF'}
        />
      ) : (
        <>
          {icon && iconPosition === 'left'  && <View style={styles.iconL}>{icon}</View>}
          <Text style={[
            styles.label,
            { color: textColorMap[variant], fontSize: fontSizeMap[size] },
            textStyle,
          ]}>
            {label}
          </Text>
          {icon && iconPosition === 'right' && <View style={styles.iconR}>{icon}</View>}
        </>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  base:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm },
  fullWidth: { alignSelf: 'stretch' },
  label:     { fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.snug },
  iconL:     { marginRight: Spacing[2] },
  iconR:     { marginLeft:  Spacing[2] },
});

export default Button;