// components/ErrorBoundary.tsx
// Lever: emotional connection — error states must take the blame, not the user.
// Catches render-phase errors so a thrown component doesn't blank-screen the
// app. Renders a recovery card with retry; logs through the typed no-op reporter.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, palette } from '@/constants/Colors';
import {
  FontSize, FontWeight, LetterSpacing, Radius, Spacing,
} from '@/constants/Typography';
import { errorReporter } from '@/lib/errorReporter';

interface Props {
  /** Optional screen / boundary name shown in dev. */
  boundary?: string;
  fallbackTitle?: string;
  fallbackBody?: string;
  children: React.ReactNode;
}
interface State { error: Error | null }

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State { return { error }; }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    errorReporter.error(error, {
      screen: this.props.boundary ?? 'unknown',
      action: 'render',
      componentStack: info.componentStack,
    });
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    // We can't use useTheme() inside a class. Read both palettes and pick by
    // appearance heuristic: in production the boundary tree is rare anyway.
    const theme = Colors.dark;

    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <View style={[styles.card, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: theme.dangerSoft }]}>
            <Ionicons name="warning" size={28} color={theme.danger} />
          </View>
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            {this.props.fallbackTitle ?? 'Something went sideways'}
          </Text>
          <Text style={[styles.body, { color: theme.textMuted }]}>
            {this.props.fallbackBody ??
              'We hit a snag rendering this screen. Tap below to reload it — the rest of the app is fine.'}
          </Text>
          {__DEV__ && this.state.error?.message && (
            <Text style={[styles.devDetail, { color: palette.crimson400 }]} numberOfLines={4}>
              {this.state.error.message}
            </Text>
          )}
          <Pressable
            onPress={this.reset}
            style={[styles.retry, { backgroundColor: theme.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Retry"
          >
            <Text style={[styles.retryLabel, { color: theme.textOnPrimary }]}>Reload screen</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing[6] },
  card: {
    width: '100%', maxWidth: 420, padding: Spacing[6],
    borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', gap: Spacing[3],
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.lg, fontWeight: FontWeight.heavy,
    letterSpacing: LetterSpacing.tight, textAlign: 'center',
  },
  body: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: FontSize.sm * 1.6 },
  devDetail: {
    fontSize: FontSize.xs, marginTop: Spacing[2],
    fontFamily: 'monospace', textAlign: 'center',
  },
  retry: {
    marginTop: Spacing[3],
    paddingHorizontal: Spacing[6], paddingVertical: Spacing[3],
    borderRadius: Radius.pill,
  },
  retryLabel: {
    fontSize: FontSize.sm, fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.snug,
  },
});
