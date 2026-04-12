// components/SelectSheet.tsx
import React, { useCallback } from 'react';
import {
  Modal, View, Text, TouchableOpacity, FlatList,
  StyleSheet, TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { FontSize, FontWeight, Spacing, Radius, LetterSpacing } from '@/constants/Typography';

interface Option<T = string> {
  label: string;
  value: T;
  icon?: string;
  description?: string;
}

interface SelectSheetProps<T = string> {
  visible: boolean;
  title: string;
  options: Option<T>[];
  selected?: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}

function SelectSheet<T extends string>({
  visible, title, options, selected, onSelect, onClose,
}: SelectSheetProps<T>) {
  const { theme } = useTheme();
  const insets    = useSafeAreaInsets();

  const renderItem = useCallback(({ item }: { item: Option<T> }) => {
    const isSelected = item.value === selected;
    return (
      <TouchableOpacity
        onPress={() => { onSelect(item.value); onClose(); }}
        style={[styles.option, { borderBottomColor: theme.border }]}
        activeOpacity={0.6}
      >
        {item.icon && <Text style={styles.optIcon}>{item.icon}</Text>}
        <View style={styles.optText}>
          <Text style={[styles.optLabel, { color: isSelected ? theme.primary : theme.textPrimary }]}>
            {item.label}
          </Text>
          {item.description && (
            <Text style={[styles.optDesc, { color: theme.textMuted }]}>{item.description}</Text>
          )}
        </View>
        {isSelected && (
          <Text style={[styles.check, { color: theme.primary }]}>✓</Text>
        )}
      </TouchableOpacity>
    );
  }, [selected, theme, onSelect, onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>
      <View style={[styles.sheet, {
        backgroundColor: theme.surface,
        paddingBottom: insets.bottom + Spacing[4],
      }]}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <Text style={[styles.sheetTitle, { color: theme.textPrimary, borderBottomColor: theme.border }]}>
          {title}
        </Text>
        <FlatList
          data={options}
          keyExtractor={(item) => String(item.value)}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    maxHeight: '75%',
    paddingTop: Spacing[2],
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing[3] },
  sheetTitle: {
    fontSize: FontSize.base, fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.snug,
    paddingHorizontal: Spacing[6], paddingBottom: Spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  option: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing[6], paddingVertical: Spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth, gap: Spacing[3],
  },
  optIcon:  { fontSize: 20 },
  optText:  { flex: 1 },
  optLabel: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  optDesc:  { fontSize: FontSize.xs, marginTop: 2 },
  check:    { fontSize: FontSize.md, fontWeight: FontWeight.black },
});

export default SelectSheet;
