// components/ScreenHeader.tsx
// Variants: solid (default) | transparent | floating
// Pill back button (Ionicons chevron), centered title block, right slot.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import {
  FontSize, FontWeight, Spacing, LetterSpacing, Radius,
} from '@/constants/Typography';

export type ScreenHeaderVariant = 'solid' | 'transparent' | 'floating';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  variant?: ScreenHeaderVariant;
  /** Backwards-compat for the `transparent` prop. */
  transparent?: boolean;
}

const ScreenHeader = React.memo(function ScreenHeader({
  title, subtitle, showBack = false, onBack, rightAction, variant, transparent,
}: ScreenHeaderProps) {
  const { theme } = useTheme();
  const router    = useRouter();
  const insets    = useSafeAreaInsets();
  const v: ScreenHeaderVariant = variant ?? (transparent ? 'transparent' : 'solid');

  const bg =
    v === 'solid' ? theme.surface
    :               'transparent';

  const border = v === 'solid' ? theme.border : 'transparent';

  return (
    <View style={[
      styles.wrap,
      {
        paddingTop: insets.top + Spacing[2],
        backgroundColor: bg,
        borderBottomColor: border,
        borderBottomWidth: v === 'solid' ? StyleSheet.hairlineWidth : 0,
      },
    ]}>
      <View style={styles.row}>
        {showBack ? (
          <Pressable
            onPress={onBack ?? (() => router.back())}
            style={[
              styles.iconBtn,
              { backgroundColor: v === 'floating' ? theme.surface : 'transparent', borderColor: v === 'floating' ? theme.border : 'transparent' },
            ]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
          </Pressable>
        ) : (
          <View style={styles.sideSlot} />
        )}

        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: theme.textMuted }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        <View style={styles.sideSlot}>{rightAction}</View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap:       { paddingBottom: Spacing[3] },
  row:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing[4] },
  iconBtn: {
    width: 40, height: 40, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  titleBlock: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing[3] },
  title: {
    fontSize: FontSize.base, fontWeight: FontWeight.black, letterSpacing: LetterSpacing.snug,
  },
  subtitle: { fontSize: FontSize.xs, marginTop: 2 },
  sideSlot: { width: 40, alignItems: 'flex-end' },
});

export default ScreenHeader;
