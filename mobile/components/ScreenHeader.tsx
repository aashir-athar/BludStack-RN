// components/ScreenHeader.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { FontSize, FontWeight, Spacing } from '@/constants/Typography';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  transparent?: boolean;
}

const ScreenHeader = React.memo(function ScreenHeader({
  title,
  subtitle,
  showBack = false,
  rightAction,
  transparent = false,
}: ScreenHeaderProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + Spacing[2],
          backgroundColor: transparent ? 'transparent' : theme.surface,
          borderBottomColor: transparent ? 'transparent' : theme.border,
          borderBottomWidth: transparent ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={styles.inner}>
        {showBack ? (
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={[styles.backIcon, { color: theme.accent }]}>‹</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backPlaceholder} />
        )}

        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        <View style={styles.rightWrap}>{rightAction ?? <View style={styles.backPlaceholder} />}</View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container:       { paddingBottom: Spacing[2] },
  inner:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing[4], gap: Spacing[2] },
  backBtn:         { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backIcon:        { fontSize: 32, lineHeight: 36, fontWeight: FontWeight.regular },
  backPlaceholder: { width: 40 },
  titleWrap:       { flex: 1, alignItems: 'center' },
  title:           { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  subtitle:        { fontSize: FontSize.xs },
  rightWrap:       { width: 40, alignItems: 'flex-end' },
});

export default ScreenHeader;
