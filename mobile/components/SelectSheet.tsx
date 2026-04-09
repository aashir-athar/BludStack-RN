// components/SelectSheet.tsx
import React, { useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/Typography';

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
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: SelectSheetProps<T>) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const renderItem = useCallback(({ item }: { item: Option<T> }) => {
    const isSelected = item.value === selected;
    return (
      <TouchableOpacity
        onPress={() => { onSelect(item.value); onClose(); }}
        style={[
          styles.option,
          {
            backgroundColor: isSelected ? `${theme.primary}18` : 'transparent',
            borderBottomColor: theme.border,
          },
        ]}
        activeOpacity={0.75}
      >
        {item.icon && <Text style={styles.optionIcon}>{item.icon}</Text>}
        <View style={styles.optionText}>
          <Text style={[styles.optionLabel, { color: isSelected ? theme.primary : theme.textPrimary }]}>
            {item.label}
          </Text>
          {item.description && (
            <Text style={[styles.optionDesc, { color: theme.textMuted }]}>{item.description}</Text>
          )}
        </View>
        {isSelected && <Text style={[styles.check, { color: theme.primary }]}>✓</Text>}
      </TouchableOpacity>
    );
  }, [selected, theme, onSelect, onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>
      <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + Spacing[4] }]}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
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
  backdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    maxHeight: '75%',
    paddingTop: Spacing[3],
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing[4] },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    paddingHorizontal: Spacing[6],
    marginBottom: Spacing[2],
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing[3],
  },
  optionIcon:  { fontSize: 20 },
  optionText:  { flex: 1, gap: 2 },
  optionLabel: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  optionDesc:  { fontSize: FontSize.xs },
  check:       { fontSize: FontSize.md, fontWeight: FontWeight.bold },
});

export default SelectSheet;
