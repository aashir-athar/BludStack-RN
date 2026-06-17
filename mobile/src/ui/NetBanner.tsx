// Offline indicator. Subscribes to NetInfo, fades in when the connection drops.
import React, { useEffect, useState } from 'react';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '@/constants/Typography';
import { useAppTheme } from '@/stores/themeStore';
import { Text } from './Text';

export function NetBanner() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOffline(!(state.isConnected && state.isInternetReachable !== false));
    });
    return () => unsub();
  }, []);

  if (!offline) return null;

  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(200).reduceMotion(ReduceMotion.System)}
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 999,
        paddingTop: insets.top + Spacing[1], paddingBottom: Spacing[2],
        backgroundColor: theme.surfaceMuted,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing[2],
      }}
    >
      <Ionicons name="cloud-offline-outline" size={16} color={theme.textMuted} />
      <Text variant="caption" tone="muted">Offline. We will catch up when you reconnect.</Text>
    </Animated.View>
  );
}

export default NetBanner;
