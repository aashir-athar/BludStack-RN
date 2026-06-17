// ui/Text.tsx
// Typed text primitive built on Tamagui - role + tone variants mirror the
// Typography `Type` scale. Colours are theme tokens ($textPrimary, $primary…)
// so they switch with the active Tamagui theme. `Heading` is a display alias.
import type { ComponentProps } from 'react';
import { Text as TamaguiText, styled } from '@tamagui/core';

export const Text = styled(TamaguiText, {
  name: 'BText',
  fontFamily: '$body',
  color: '$textPrimary',

  variants: {
    variant: {
      display:  { fontSize: 42, fontWeight: '900', letterSpacing: -1.2, lineHeight: 46 },
      headline: { fontSize: 34, fontWeight: '800', letterSpacing: -0.8, lineHeight: 38 },
      title:    { fontSize: 22, fontWeight: '700', letterSpacing: -0.4, lineHeight: 26 },
      titleSm:  { fontSize: 18, fontWeight: '700', letterSpacing: -0.4, lineHeight: 22 },
      body:     { fontSize: 16, fontWeight: '400', lineHeight: 26 },
      bodySm:   { fontSize: 14, fontWeight: '400', lineHeight: 22 },
      label:    { fontSize: 14, fontWeight: '600', letterSpacing: 0.4, lineHeight: 20 },
      labelSm:  { fontSize: 12, fontWeight: '600', letterSpacing: 0.4, lineHeight: 16 },
      caption:  { fontSize: 12, fontWeight: '400', lineHeight: 18 },
      overline: { fontSize: 10, fontWeight: '900', letterSpacing: 1.6, lineHeight: 14, textTransform: 'uppercase' },
    },
    tone: {
      primary:   { color: '$textPrimary' },
      secondary: { color: '$textSecondary' },
      muted:     { color: '$textMuted' },
      tertiary:  { color: '$textTertiary' },
      brand:     { color: '$primary' },
      success:   { color: '$success' },
      warning:   { color: '$warning' },
      danger:    { color: '$danger' },
      onPrimary: { color: '$textOnPrimary' },
    },
  } as const,

  defaultVariants: { variant: 'body', tone: 'primary' },
});

export const Heading = styled(Text, {
  name: 'BHeading',
  variant: 'headline',
});

export type TextProps = ComponentProps<typeof Text>;
