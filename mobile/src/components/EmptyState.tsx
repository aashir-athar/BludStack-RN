// components/EmptyState.tsx
// Variants: brand (default) | iconName (Ionicons)
// Replaces emoji-icon empty states with vector icons.
// Lever: emotional connection — empty states feel encouraging, not absent.

import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import BrandMark from './BrandMark';
import Button from './Button';
import { FontSize, FontWeight, Spacing, LetterSpacing, Radius } from '@/constants/Typography';

export interface EmptyStateProps {
  /** Pass an Ionicons name to override the default brand-mark icon. */
  iconName?: keyof typeof Ionicons.glyphMap;
  /** Backwards-compat: legacy callers may pass `icon` as an emoji or short label. Ignored visually. */
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState = React.memo(function EmptyState({
  iconName, title, description, actionLabel, onAction,
}: EmptyStateProps) {
  const { theme } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconCircle, { backgroundColor: theme.primarySoft }]}>
        {iconName
          ? <Ionicons name={iconName} size={28} color={theme.primary} />
          : <BrandMark size={32} variant="solid" />}
      </View>
      <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
      {description && (
        <Text style={[styles.desc, { color: theme.textMuted }]}>{description}</Text>
      )}
      {actionLabel && onAction && (
        <Button
          onPress={onAction}
          label={actionLabel}
          variant="primary"
          size="lg"
          style={styles.btn}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap:  { alignItems: 'center', paddingVertical: Spacing[14], paddingHorizontal: Spacing[8], gap: Spacing[3] },
  iconCircle: {
    width: 72, height: 72, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing[2],
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.tight,
    textAlign: 'center',
  },
  desc:  {
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: FontSize.sm * 1.6,
    maxWidth: 320,
  },
  btn:   { marginTop: Spacing[3], minWidth: 200 },
});

export default EmptyState;
