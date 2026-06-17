// Render-phase fallback with retry. Takes the blame, keeps the rest of the app alive.
import React from 'react';
import { View } from '@tamagui/core';
import { errorReporter } from '@/lib/errorReporter';
import { Text } from './Text';
import { Button } from './Button';

interface Props {
  children: React.ReactNode;
  boundary?: string;
}
interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    errorReporter.error(error, {
      action: 'render',
      boundary: this.props.boundary,
      componentStack: info.componentStack ?? undefined,
    });
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View flex={1} backgroundColor="$background" alignItems="center" justifyContent="center" padding="$8" gap="$4">
        <Text variant="title" style={{ textAlign: 'center' }}>Something slipped</Text>
        <Text variant="bodySm" tone="muted" style={{ textAlign: 'center' }}>
          We hit a snag rendering this screen. Tap below to reload it. The rest of the app is fine.
        </Text>
        <Button label="Reload screen" onPress={this.reset} size="md" />
      </View>
    );
  }
}

export default ErrorBoundary;
