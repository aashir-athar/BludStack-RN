// components/LoadingScreen.tsx
// Boot / route-loading state. Uses shimmer skeleton (not ActivityIndicator)
// per project's loading-pattern rule.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { FontSize, FontWeight, Spacing, LetterSpacing, Radius } from '@/constants/Typography';
import Skeleton from './Skeleton';

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen = React.memo(function LoadingScreen({ message }: LoadingScreenProps) {
  const { theme } = useTheme();
  const insets    = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingBottom: insets.bottom }]}>
      <Text style={[styles.wordmark, { color: theme.primary }]}>🩸</Text>
      <Text style={[styles.brand, { color: theme.textPrimary }]}>BLUDSTACK</Text>
      <View style={styles.skeletonRow}>
        <Skeleton width={140} height={4} radius={Radius.full} />
      </View>
      {message && <Text style={[styles.msg, { color: theme.textMuted }]}>{message}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  root:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing[3] },
  wordmark:    { fontSize: 52 },
  brand:       { fontSize: FontSize.sm, fontWeight: FontWeight.black, letterSpacing: LetterSpacing.widest },
  skeletonRow: { marginTop: Spacing[5], alignItems: 'center' },
  msg:         { fontSize: FontSize.xs, marginTop: Spacing[2] },
});

export default LoadingScreen;
