// components/ToggleSwitch.tsx
import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { FontSize, FontWeight, Spacing, LetterSpacing } from '@/constants/Typography';

interface ToggleSwitchProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  icon?: string;
  disabled?: boolean;
}

const ToggleSwitch = React.memo(function ToggleSwitch({
  label, description, value, onValueChange, icon, disabled = false,
}: ToggleSwitchProps) {
  const { theme } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <View style={styles.left}>
        {icon && <Text style={styles.icon}>{icon}</Text>}
        <View style={{ flex: 1 }}>
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
        trackColor={{ false: theme.border, true: theme.primary }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={theme.border}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing[4], borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left:  { flexDirection: 'row', alignItems: 'center', flex: 1, gap: Spacing[3], marginRight: Spacing[3] },
  icon:  { fontSize: 20 },
  label: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  desc:  { fontSize: FontSize.xs, marginTop: 2 },
});

export default ToggleSwitch;
