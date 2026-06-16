// components/SelectSheet.tsx
// Bottom-sheet selector with backdrop + handle. Theme-tokenised, accepts a
// `value` prop (new) OR `selected` (legacy) for the active option.

import React, { useCallback } from 'react';
import {
  Modal, View, Text, Pressable, FlatList, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import {
  FontSize, FontWeight, Spacing, Radius, LetterSpacing, Elevation,
} from '@/constants/Typography';

export interface SelectSheetOption<T = string> {
  label: string;
  value: T;
  iconName?: keyof typeof Ionicons.glyphMap;
  description?: string;
  /** Backwards-compat: legacy string icon (ignored visually). */
  icon?: string;
}

export interface SelectSheetProps<T = string> {
  visible: boolean;
  title: string;
  options: SelectSheetOption<T>[];
  /** Preferred prop name. */
  value?: T;
  /** Backwards-compat. */
  selected?: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}

function SelectSheet<T extends string>({
  visible, title, options, value, selected, onSelect, onClose,
}: SelectSheetProps<T>) {
  const { theme } = useTheme();
  const insets    = useSafeAreaInsets();
  const active = value ?? selected;

  const renderItem = useCallback(({ item }: { item: SelectSheetOption<T> }) => {
    const isSelected = item.value === active;
    return (
      <Pressable
        onPress={() => { Haptics.selectionAsync().catch(() => {}); onSelect(item.value); onClose(); }}
        style={({ pressed }) => [
          styles.option,
          { backgroundColor: pressed ? theme.cardHover : 'transparent' },
        ]}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
      >
        {item.iconName && (
          <View style={[styles.iconWrap, { backgroundColor: theme.primarySoft }]}>
            <Ionicons name={item.iconName} size={18} color={theme.primary} />
          </View>
        )}
        <View style={styles.optText}>
          <Text style={[
            styles.optLabel,
            { color: isSelected ? theme.primary : theme.textPrimary },
          ]}>
            {item.label}
          </Text>
          {item.description && (
            <Text style={[styles.optDesc, { color: theme.textMuted }]}>{item.description}</Text>
          )}
        </View>
        <Ionicons
          name={isSelected ? 'radio-button-on' : 'radio-button-off'}
          size={22}
          color={isSelected ? theme.primary : theme.textTertiary}
        />
      </Pressable>
    );
  }, [active, theme, onSelect, onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[styles.backdrop, { backgroundColor: theme.scrim }]} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            paddingBottom: insets.bottom + Spacing[3],
          },
          Elevation.lg,
        ]}
      >
        {/* Brand accent strip + handle — matches Request screen sheet language. */}
        <View style={styles.sheetTop}>
          <View style={[styles.accentStrip, { backgroundColor: theme.primary }]} />
          <View style={[styles.handle, { backgroundColor: theme.borderStrong }]} />
        </View>
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={theme.textMuted} />
          </Pressable>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.divider }]} />
        <FlatList
          data={options}
          keyExtractor={(item) => String(item.value)}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: Spacing[2] }}
          ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    maxHeight: '78%',
    paddingTop: Spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  sheetTop:    { alignItems: 'center', paddingTop: Spacing[2], paddingBottom: Spacing[2] },
  accentStrip: { width: 36, height: 3, borderRadius: 2, marginBottom: Spacing[1], opacity: 0.9 },
  handle:      { width: 44, height: 4, borderRadius: 2 },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing[5], paddingVertical: Spacing[3],
  },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.black, letterSpacing: LetterSpacing.tight },
  divider:    { height: StyleSheet.hairlineWidth, marginHorizontal: Spacing[5] },
  option: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing[5], paddingVertical: Spacing[4],
    gap: Spacing[3],
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  optText:  { flex: 1 },
  optLabel: { fontSize: FontSize.base, fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.snug },
  optDesc:  { fontSize: FontSize.xs, marginTop: 2, lineHeight: FontSize.xs * 1.5 },
});

export default SelectSheet;
