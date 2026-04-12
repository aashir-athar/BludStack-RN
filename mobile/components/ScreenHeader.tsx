// components/ScreenHeader.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { FontSize, FontWeight, Spacing, LetterSpacing } from '@/constants/Typography';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  transparent?: boolean;
}

const ScreenHeader = React.memo(function ScreenHeader({
  title, subtitle, showBack = false, rightAction, transparent = false,
}: ScreenHeaderProps) {
  const { theme } = useTheme();
  const router    = useRouter();
  const insets    = useSafeAreaInsets();

  return (
    <View style={[
      styles.wrap,
      {
        paddingTop:      insets.top + Spacing[3],
        backgroundColor: transparent ? 'transparent' : theme.surface,
        borderBottomColor: transparent ? 'transparent' : theme.border,
        borderBottomWidth: transparent ? 0 : StyleSheet.hairlineWidth,
      },
    ]}>
      <View style={styles.row}>
        {/* Back button */}
        {showBack ? (
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.6}>
            <Text style={[styles.backArrow, { color: theme.textPrimary }]}>←</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.sideSlot} />
        )}

        {/* Title block */}
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

        {/* Right action */}
        <View style={styles.sideSlot}>
          {rightAction}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap:       { paddingBottom: Spacing[3] },
  row:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing[5] },
  backBtn:    { width: 40, height: 40, justifyContent: 'center' },
  backArrow:  { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  titleBlock: { flex: 1, alignItems: 'center' },
  title:      { fontSize: FontSize.base, fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.snug },
  subtitle:   { fontSize: FontSize.xs, marginTop: 1 },
  sideSlot:   { width: 40, alignItems: 'flex-end' },
});

export default ScreenHeader;
