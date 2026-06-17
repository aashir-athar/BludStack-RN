// Toast viewport. Reads the toast store, renders one pill at the top, auto-
// dismisses, tap to clear. Mount once at the app root. Replaces Alert.alert.
import React from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import Animated, { SlideInUp, SlideOutUp, ReduceMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Radius, Elevation } from '@/constants/Typography';
import { useAppTheme } from '@/stores/themeStore';
import { useToastCurrent, useToastStore, type ToastKind } from '@/stores/toastStore';
import { Text } from './Text';

const ICON: Record<ToastKind, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  warning: 'warning',
  info: 'information-circle',
};

export function ToastViewport() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const toast = useToastCurrent();
  const dismiss = useToastStore((s) => s.dismiss);

  // Reanimated's entering/exiting keeps the pill mounted through its exit, so no
  // manual mount state is needed (and reduced motion is honored).
  if (!toast) return null;

  const accent =
    toast.kind === 'success' ? theme.success
    : toast.kind === 'error' ? theme.danger
    : toast.kind === 'warning' ? theme.warning
    : theme.info;

  return (
    <Animated.View
      key={toast.id}
      pointerEvents="box-none"
      entering={SlideInUp.springify().damping(18).stiffness(240).reduceMotion(ReduceMotion.System)}
      exiting={SlideOutUp.duration(220).reduceMotion(ReduceMotion.System)}
      style={{
        position: 'absolute', alignSelf: 'center', zIndex: 1000,
        top: insets.top + Spacing[2], width: Math.min(width - Spacing[8], 520),
      }}
    >
      <Pressable
        onPress={dismiss}
        accessibilityRole="alert"
        accessibilityLabel={`${toast.kind}: ${toast.title}`}
        style={[
          {
            flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
            paddingVertical: Spacing[3], paddingHorizontal: Spacing[4],
            borderRadius: Radius.pill, borderCurve: 'continuous', borderWidth: 1,
            backgroundColor: theme.cardElevated, borderColor: theme.border,
          },
          Elevation.md,
        ]}
      >
        <View
          style={{
            width: 32, height: 32, borderRadius: Radius.pill,
            alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primaryGhost,
          }}
        >
          <Ionicons name={ICON[toast.kind]} size={20} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="label" numberOfLines={1}>{toast.title}</Text>
          {toast.description ? (
            <Text variant="caption" tone="muted" numberOfLines={2}>{toast.description}</Text>
          ) : null}
        </View>
        {toast.action ? (
          <Pressable
            onPress={() => { toast.action?.onPress(); dismiss(); }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={toast.action.label}
          >
            <Text variant="label" style={{ color: accent }}>{toast.action.label}</Text>
          </Pressable>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

export default ToastViewport;
