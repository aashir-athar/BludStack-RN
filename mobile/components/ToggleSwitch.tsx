// components/ToggleSwitch.tsx
import React, { useCallback } from 'react';
import { View, Text, Switch, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/Typography';

interface ToggleSwitchProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  icon?: string;
  disabled?: boolean;
}

const ToggleSwitch = React.memo(function ToggleSwitch({
  label,
  description,
  value,
  onValueChange,
  icon,
  disabled = false,
}: ToggleSwitchProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <View style={styles.left}>
        {icon && <Text style={styles.icon}>{icon}</Text>}
        <View style={styles.textWrap}>
          <Text style={[styles.label, { color: theme.textPrimary }]}>{label}</Text>
          {description && (
            <Text style={[styles.desc, { color: theme.textMuted }]}>{description}</Text>
          )}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: theme.border, true: `${theme.primary}88` }}
        thumbColor={value ? theme.primary : theme.textMuted}
        ios_backgroundColor={theme.border}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing[3],
  },
  left:    { flexDirection: 'row', alignItems: 'center', flex: 1, gap: Spacing[3] },
  icon:    { fontSize: 20 },
  textWrap:{ flex: 1, gap: 2 },
  label:   { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  desc:    { fontSize: FontSize.xs },
});

export default ToggleSwitch;
