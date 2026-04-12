// constants/Typography.ts
// Uber uses their own "Uber Move" — we mirror the feel with platform
// system fonts at aggressive weights. Heavy display, clean body.

import { Platform } from 'react-native';

export const FontFamily = {
  // Heavy display — mimics Uber Move Bold
  display: Platform.select({
    ios:     'System',   // SF Pro — excellent at heavy weights
    android: 'sans-serif-condensed', // Roboto Condensed — bold & tight
    default: 'System',
  }),
  // Body — clean, readable
  body: Platform.select({
    ios:     'System',
    android: 'sans-serif',
    default: 'System',
  }),
  // Mono — for codes/tokens
  mono: Platform.select({
    ios:     'Courier New',
    android: 'monospace',
    default: 'monospace',
  }),
};

export const FontSize = {
  '2xs': 10,
  xs:    12,
  sm:    14,
  base:  16,
  md:    18,
  lg:    22,
  xl:    28,
  '2xl': 34,
  '3xl': 42,
  '4xl': 52,
  hero:  64,
};

export const FontWeight = {
  regular:  '400' as const,
  medium:   '500' as const,
  semibold: '600' as const,
  bold:     '700' as const,
  heavy:    '800' as const,
  black:    '900' as const,
};

export const LetterSpacing = {
  tight:   -0.8,
  snug:    -0.4,
  normal:   0,
  wide:     0.5,
  wider:    1.2,
  widest:   2.0,
};

export const LineHeight = {
  none:    1.0,
  tight:   1.1,
  snug:    1.2,
  normal:  1.4,
  relaxed: 1.6,
};

// Uber-style spacing — 4pt base grid, generous at large sizes
export const Spacing = {
  0:    0,
  1:    4,
  2:    8,
  3:    12,
  4:    16,
  5:    20,
  6:    24,
  7:    28,
  8:    32,
  10:   40,
  12:   48,
  14:   56,
  16:   64,
  20:   80,
  24:   96,
  // halves
  '0.5': 2,
  '1.5': 6,
  '2.5': 10,
  '3.5': 14,
};

// Uber uses very subtle radius — mostly square with just enough rounding
export const Radius = {
  none:  0,
  xs:    4,
  sm:    6,
  base:  8,
  md:    12,
  lg:    16,
  xl:    20,
  '2xl': 28,
  full:  9999,
};

// Shadow tokens — Uber uses almost no shadow, relies on borders/contrast
export const Shadow = {
  none: {},
  sm: {
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius:  3,
    elevation:     2,
  },
  base: {
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius:  8,
    elevation:     4,
  },
  md: {
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius:  16,
    elevation:     8,
  },
};

// Alias — backwards-compatible with files that import BorderRadius
export const BorderRadius = Radius;
export const TAB_BAR_BOTTOM_INSET = 96;