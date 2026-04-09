// components/Card.tsx
import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { BorderRadius, Shadow, Spacing } from '@/constants/Typography';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  glass?: boolean;
  elevated?: boolean;
  noPadding?: boolean;
}

const Card = React.memo(function Card({
  children,
  style,
  glass = false,
  elevated = false,
  noPadding = false,
}: CardProps) {
  const { theme, isDark } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: glass ? theme.glass : theme.card,
          borderColor: theme.border,
          shadowColor: theme.shadowColor,
        },
        elevated ? styles.elevated : styles.base,
        noPadding ? null : styles.padding,
        style,
      ]}
    >
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  padding: {
    padding: Spacing[4],
  },
  base: {
    ...Shadow.base,
  },
  elevated: {
    ...Shadow.md,
  },
});

export default Card;
