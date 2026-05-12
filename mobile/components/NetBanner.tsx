// components/NetBanner.tsx
// Lever: scarcity / loss aversion — a quiet pill that surfaces only when
// connectivity is lost, so the user knows actions might queue rather than
// failing silently. Auto-hides on reconnect.

import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, withTiming, runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import {
  Spacing, Radius, FontSize, FontWeight, LetterSpacing, Elevation, Motion,
} from '@/constants/Typography';

export default function NetBanner() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [online, setOnline] = useState(true);
  const [render, setRender] = useState(false);
  const lastStateRef = useRef<boolean>(true);

  const offset  = useSharedValue(-120);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state: NetInfoState) => {
      const next = !!(state.isConnected && state.isInternetReachable !== false);
      if (next === lastStateRef.current) return;
      lastStateRef.current = next;
      setOnline(next);
    });
    NetInfo.fetch().then(s => {
      const initial = !!(s.isConnected && s.isInternetReachable !== false);
      lastStateRef.current = initial;
      setOnline(initial);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!online) {
      setRender(true);
      opacity.value = withTiming(1, { duration: Motion.duration.fast });
      offset.value  = withSpring(0, Motion.spring.snappy);
    } else if (render) {
      opacity.value = withTiming(0, { duration: Motion.duration.fast });
      offset.value  = withTiming(-120, { duration: Motion.duration.base }, (finished) => {
        if (finished) runOnJS(setRender)(false);
      });
    }
  }, [online, render, offset, opacity]);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
    opacity: opacity.value,
  }));

  if (!render) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.viewport,
        { top: insets.top + Spacing[2] },
        aStyle,
      ]}
    >
      <View
        style={[
          styles.pill,
          {
            backgroundColor: theme.cardElevated,
            borderColor: theme.border,
          },
          Elevation.md,
        ]}
      >
        <Ionicons name="cloud-offline" size={16} color={theme.warning} />
        <Text style={[styles.text, { color: theme.textPrimary }]}>
          Offline · we'll catch up when you reconnect
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    position: 'absolute', left: 0, right: 0,
    alignItems: 'center', zIndex: 999,
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[2],
    borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth,
  },
  text: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.snug },
});
