// contexts/ToastContext.tsx
// Lever: peak-end rule — the *moment* of feedback is what the user remembers.
// Replaces Alert.alert across the app. One animated pill, auto-dismiss, theme-aware.
//
// API: const toast = useToast(); toast.success('Saved'); toast.error('No network');
//      Optional second arg: { description, duration, action }

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, withTiming, runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import {
  Spacing, Radius, FontWeight, LetterSpacing, FontSize, Elevation, Motion,
} from '@/constants/Typography';

type ToastKind = 'success' | 'error' | 'info' | 'warning';

interface ToastInput {
  description?: string;
  duration?: number;
  action?: { label: string; onPress: () => void };
}

interface ToastShape extends ToastInput {
  id: number;
  kind: ToastKind;
  title: string;
}

interface ToastContextValue {
  success: (title: string, opts?: ToastInput) => void;
  error:   (title: string, opts?: ToastInput) => void;
  info:    (title: string, opts?: ToastInput) => void;
  warning: (title: string, opts?: ToastInput) => void;
  dismiss: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<ToastShape | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setCurrent(null);
  }, []);

  const push = useCallback((kind: ToastKind, title: string, opts?: ToastInput) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const id = Date.now();
    setCurrent({ id, kind, title, ...(opts ?? {}) });
    const duration = opts?.duration ?? (kind === 'error' ? 5000 : 3200);
    timerRef.current = setTimeout(() => setCurrent(null), duration);
  }, []);

  const value: ToastContextValue = {
    success: (t, o) => push('success', t, o),
    error:   (t, o) => push('error',   t, o),
    info:    (t, o) => push('info',    t, o),
    warning: (t, o) => push('warning', t, o),
    dismiss,
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toast={current} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({ toast, onDismiss }: { toast: ToastShape | null; onDismiss: () => void }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const offset = useSharedValue(-100);
  const opacity = useSharedValue(0);
  const [render, setRender] = useState(false);

  useEffect(() => {
    if (toast) {
      setRender(true);
      opacity.value = withTiming(1, { duration: Motion.duration.fast });
      offset.value  = withSpring(0, Motion.spring.snappy);
    } else if (render) {
      opacity.value = withTiming(0, { duration: Motion.duration.fast });
      offset.value  = withTiming(-100, { duration: Motion.duration.base }, (finished) => {
        if (finished) runOnJS(setRender)(false);
      });
    }
  }, [toast, render, offset, opacity]);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
    opacity: opacity.value,
  }));

  if (!render || !toast) return null;

  const accent =
    toast.kind === 'success' ? theme.success
    : toast.kind === 'error'   ? theme.danger
    : toast.kind === 'warning' ? theme.warning
    :                            theme.info;

  const iconName =
    toast.kind === 'success' ? 'checkmark-circle'
    : toast.kind === 'error'   ? 'alert-circle'
    : toast.kind === 'warning' ? 'warning'
    :                            'information-circle';

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.viewport,
        { top: insets.top + Spacing[2], width: Math.min(width - Spacing[8], 520) },
        aStyle,
      ]}
    >
      <Pressable
        onPress={onDismiss}
        style={[
          styles.pill,
          {
            backgroundColor: theme.cardElevated,
            borderColor: theme.border,
          },
          Elevation.md,
        ]}
        accessibilityRole="alert"
        accessibilityLabel={`${toast.kind}: ${toast.title}`}
      >
        <View style={[styles.iconCircle, { backgroundColor: accent + '22' }]}>
          <Ionicons name={iconName as any} size={20} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>
            {toast.title}
          </Text>
          {toast.description && (
            <Text style={[styles.desc, { color: theme.textMuted }]} numberOfLines={2}>
              {toast.description}
            </Text>
          )}
        </View>
        {toast.action && (
          <Pressable
            onPress={() => { toast.action?.onPress(); onDismiss(); }}
            hitSlop={8}
          >
            <Text style={[styles.action, { color: accent }]}>{toast.action.label}</Text>
          </Pressable>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  viewport: {
    position: 'absolute', alignSelf: 'center', zIndex: 1000,
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    paddingVertical: Spacing[3], paddingHorizontal: Spacing[4],
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconCircle: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.snug },
  desc:  { fontSize: FontSize.xs, marginTop: 2, lineHeight: FontSize.xs * 1.5 },
  action: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.snug, paddingHorizontal: Spacing[2] },
});
