// Bottom-sheet single-select. Backdrop + handle + accent strip + radio rows.
// Controlled: parent owns `visible` and `value`. Replaces inline native pickers.
import React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, Radius, Elevation } from '@/constants/Typography';
import { useAppTheme } from '@/stores/themeStore';
import { Text } from './Text';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export interface SelectSheetProps<T extends string> {
  visible: boolean;
  title: string;
  options: SelectOption<T>[];
  value?: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}

export function SelectSheet<T extends string>({
  visible, title, options, value, onSelect, onClose,
}: SelectSheetProps<T>) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.scrim }}
      >
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(160)} style={{ flex: 1 }} />
      </Pressable>

      <Animated.View
        entering={SlideInDown.springify().damping(18).stiffness(220).reduceMotion(ReduceMotion.System)}
        exiting={SlideOutDown.duration(220).reduceMotion(ReduceMotion.System)}
        style={[
          {
            position: 'absolute', left: 0, right: 0, bottom: 0,
            backgroundColor: theme.surface,
            borderTopLeftRadius: Radius['2xl'], borderTopRightRadius: Radius['2xl'],
            borderCurve: 'continuous',
            paddingBottom: insets.bottom + Spacing[4],
            maxHeight: '80%',
          },
          Elevation.lg,
        ]}
      >
        <View style={{ alignItems: 'center', paddingTop: Spacing[2], paddingBottom: Spacing[3] }}>
          <View style={{ width: 36, height: 3, borderRadius: 2, marginBottom: Spacing[1], backgroundColor: theme.primary, opacity: 0.9 }} />
          <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: theme.borderStrong }} />
        </View>

        <Text variant="title" style={{ paddingHorizontal: Spacing[5], marginBottom: Spacing[3] }}>{title}</Text>

        <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing[4], gap: Spacing[1], paddingBottom: Spacing[2] }}>
          {options.map((opt) => {
            const selected = opt.value === value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => { onSelect(opt.value); onClose(); }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={opt.label}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
                  paddingVertical: Spacing[3], paddingHorizontal: Spacing[4],
                  borderRadius: Radius.lg, borderCurve: 'continuous',
                  backgroundColor: selected ? theme.primaryGhost : 'transparent',
                }}
              >
                {opt.icon ? <Ionicons name={opt.icon} size={20} color={selected ? theme.primary : theme.textMuted} /> : null}
                <View style={{ flex: 1 }}>
                  <Text variant="label" tone={selected ? 'brand' : 'primary'}>{opt.label}</Text>
                  {opt.hint ? <Text variant="caption" tone="muted">{opt.hint}</Text> : null}
                </View>
                {selected ? <Ionicons name="checkmark-circle" size={22} color={theme.primary} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

export default SelectSheet;
