// Full-screen loading: brand mark over content-shaped skeletons. Never a spinner.
import React from 'react';
import { View } from 'react-native';
import { Spacing } from '@/constants/Typography';
import { useAppTheme } from '@/stores/themeStore';
import { BrandMark } from './BrandMark';
import { Skeleton } from './Skeleton';
import { Text } from './Text';

export function LoadingScreen({ message }: { message?: string }) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.background,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing[4],
      }}
    >
      <BrandMark size={48} />
      {message ? <Text variant="bodySm" tone="muted">{message}</Text> : null}
      <View style={{ gap: Spacing[2], width: 180, marginTop: Spacing[4] }}>
        <Skeleton height={10} width="100%" />
        <Skeleton height={10} width="70%" />
      </View>
    </View>
  );
}

export default LoadingScreen;
