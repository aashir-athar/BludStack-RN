// Blood-group pill (A+, O-, ...). The crimson signature carries the medical
// weight. Variants: solid / soft / outline; sizes: sm / md / lg.
import React from 'react';
import { View } from 'react-native';
import { Radius, Spacing, FontSize, FontWeight, LetterSpacing } from '@/constants/Typography';
import { useAppTheme } from '@/stores/themeStore';
import { Text } from './Text';

export type BloodGroupBadgeVariant = 'solid' | 'soft' | 'outline';
export type BloodGroupBadgeSize = 'sm' | 'md' | 'lg';

export interface BloodGroupBadgeProps {
  group: string;
  variant?: BloodGroupBadgeVariant;
  size?: BloodGroupBadgeSize;
}

const SIZES: Record<BloodGroupBadgeSize, { font: number; padX: number; padY: number }> = {
  sm: { font: FontSize.xs, padX: Spacing[2], padY: Spacing[1] },
  md: { font: FontSize.sm, padX: Spacing[3], padY: Spacing['1.5'] },
  lg: { font: FontSize.md, padX: Spacing[4], padY: Spacing[2] },
};

function BloodGroupBadgeImpl({ group, variant = 'solid', size = 'md' }: BloodGroupBadgeProps) {
  const theme = useAppTheme();
  const s = SIZES[size];

  const bg = variant === 'solid' ? theme.primary : variant === 'soft' ? theme.primarySoft : 'transparent';
  const fg = variant === 'solid' ? theme.textOnPrimary : theme.primary;
  const border = variant === 'outline' ? theme.primary : 'transparent';

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Blood group ${group}`}
      style={{
        backgroundColor: bg,
        borderColor: border,
        borderWidth: variant === 'outline' ? 1.5 : 0,
        borderRadius: Radius.pill,
        borderCurve: 'continuous',
        paddingHorizontal: s.padX,
        paddingVertical: s.padY,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          color: fg,
          fontSize: s.font,
          fontWeight: FontWeight.black,
          letterSpacing: LetterSpacing.wide,
        }}
      >
        {group}
      </Text>
    </View>
  );
}

export const BloodGroupBadge = React.memo(BloodGroupBadgeImpl);
export default BloodGroupBadge;
