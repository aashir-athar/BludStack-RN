// Modal/stack header: pill back button, centered title, optional right slot.
import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, Radius } from '@/constants/Typography';
import { useAppTheme } from '@/stores/themeStore';
import { Text } from './Text';

export interface ScreenHeaderProps {
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  transparent?: boolean;
}

function ScreenHeaderImpl({ title, onBack, right, transparent }: ScreenHeaderProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingTop: insets.top + Spacing[2],
        paddingBottom: Spacing[3],
        paddingHorizontal: Spacing[4],
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: transparent ? 'transparent' : theme.background,
      }}
    >
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={{
            width: 40,
            height: 40,
            borderRadius: Radius.pill,
            borderCurve: 'continuous',
            backgroundColor: theme.pillBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
        </Pressable>
      ) : (
        <View style={{ width: 40 }} />
      )}

      {title ? (
        <Text variant="titleSm" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
          {title}
        </Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}

      <View style={{ width: 40, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

export const ScreenHeader = React.memo(ScreenHeaderImpl);
export default ScreenHeader;
