// components/EmptyState.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import Button from './Button';
import { FontSize, FontWeight, Spacing } from '@/constants/Typography';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState = React.memo(function EmptyState({
  icon = '🩸',
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const { theme } = useTheme();
  return (
    <View style={styles.container}>
      <Text style={styles.iconText}>{icon}</Text>
      <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
      {description && (
        <Text style={[styles.desc, { color: theme.textSecondary }]}>{description}</Text>
      )}
      {actionLabel && onAction && (
        <Button onPress={onAction} label={actionLabel} variant="outline" size="sm" style={styles.btn} />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: Spacing[12], paddingHorizontal: Spacing[8], gap: Spacing[3] },
  iconText:  { fontSize: 48 },
  title:     { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, textAlign: 'center' },
  desc:      { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
  btn:       { marginTop: Spacing[2] },
});

export default EmptyState;
