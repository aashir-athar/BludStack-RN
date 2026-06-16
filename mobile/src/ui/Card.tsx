// ui/Card.tsx
// Pill-radius surface container built on Tamagui. Variants: surface / elevated /
// ghost / tinted; pad: none / sm / md / lg. Colours + shadow are theme tokens.
import type { ComponentProps } from 'react';
import { View, styled } from '@tamagui/core';
import { Radius } from '@/constants/Typography';

export const Card = styled(View, {
  name: 'BCard',
  backgroundColor: '$surface',
  borderColor: '$border',
  borderWidth: 1,
  borderRadius: Radius.lg,

  variants: {
    variant: {
      surface:  {},
      elevated: {
        backgroundColor: '$cardElevated',
        shadowColor: '$shadowColor',
        shadowOpacity: 0.12,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 },
      },
      ghost:  { backgroundColor: 'transparent', borderColor: 'transparent' },
      tinted: { backgroundColor: '$primaryGhost', borderColor: '$primarySoft' },
    },
    pad: {
      none: { padding: 0 },
      sm:   { padding: 12 },
      md:   { padding: 16 },
      lg:   { padding: 20 },
    },
  } as const,

  defaultVariants: { variant: 'surface', pad: 'md' },
});

export type CardProps = ComponentProps<typeof Card>;
