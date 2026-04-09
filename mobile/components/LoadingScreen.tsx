// components/LoadingScreen.tsx
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { FontSize, Spacing } from '@/constants/Typography';

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen = React.memo(function LoadingScreen({ message }: LoadingScreenProps) {
  const { theme } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={styles.logo}>🩸</Text>
      <ActivityIndicator size="large" color={theme.primary} style={styles.spinner} />
      {message && <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing[4] },
  logo:      { fontSize: 48 },
  spinner:   { marginTop: Spacing[2] },
  message:   { fontSize: FontSize.sm, textAlign: 'center', paddingHorizontal: Spacing[8] },
});

export default LoadingScreen;
