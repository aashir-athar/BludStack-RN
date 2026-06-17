// ui/BrandMark.tsx
// Vector blood-drop - the brand glyph that replaces the literal blood-drop emoji
// everywhere. Crisp at any size, themed via the store. Variants: solid/outline/ghost.
import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { useAppTheme } from '@/stores/themeStore';

export type BrandMarkVariant = 'solid' | 'outline' | 'ghost';

export interface BrandMarkProps {
  size?: number;
  variant?: BrandMarkVariant;
  color?: string;
}

function BrandMarkImpl({ size = 24, variant = 'solid', color }: BrandMarkProps) {
  const theme = useAppTheme();
  const fill   = variant === 'outline' ? 'transparent' : (color ?? theme.primary);
  const stroke = variant === 'outline' ? (color ?? theme.primary) : 'transparent';

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.4 c-1.2 2.2 -3.6 5.6 -5.5 8.4 -1.5 2.2 -2.5 4.5 -2.5 6.4 0 4.5 3.6 8.0 8.0 8.0 4.4 0 8.0 -3.5 8.0 -8.0 0 -1.9 -1.0 -4.2 -2.5 -6.4 -1.9 -2.8 -4.3 -6.2 -5.5 -8.4 z"
        fill={fill}
        stroke={stroke}
        strokeWidth={variant === 'outline' ? 1.8 : 0}
        strokeLinejoin="round"
        opacity={variant === 'ghost' ? 0.3 : 1}
      />
    </Svg>
  );
}

export const BrandMark = React.memo(BrandMarkImpl);
export default BrandMark;
