// components/LoadingScreen.tsx
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { FontSize, FontWeight, Spacing, LetterSpacing } from '@/constants/Typography';

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
      <ActivityIndicator color={theme.textSecondary} style={styles.spinner} />
      {message && (
        <Text style={[styles.msg, { color: theme.textMuted }]}>{message}</Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  root:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing[3] },
  wordmark: { fontSize: 52 },
  brand:    { fontSize: FontSize.sm, fontWeight: FontWeight.black, letterSpacing: LetterSpacing.widest },
  spinner:  { marginTop: Spacing[4] },
  msg:      { fontSize: FontSize.xs, marginTop: Spacing[2] },
});

export default LoadingScreen;
