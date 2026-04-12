// components/Card.tsx
import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Radius, Spacing } from '@/constants/Typography';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  noPadding?: boolean;
  elevated?: boolean;
}

const Card = React.memo(function Card({ children, style, noPadding, elevated }: CardProps) {
  const { theme } = useTheme();
  return (
    <View style={[
      styles.card,
      {
        backgroundColor: elevated ? theme.cardElevated : theme.card,
        borderColor: theme.border,
      },
      noPadding ? null : styles.padding,
      style,
    ]}>
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  card:    { borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth },
  padding: { padding: Spacing[4] },
});

export default Card;
