// constants/Typography.ts
import { Platform } from 'react-native';

export const FontFamily = {
  // System fonts — no heavy font loading, max performance
  display: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
  mono:    Platform.select({ ios: 'Courier New', android: 'monospace', default: 'monospace' }),
  regular: Platform.select({ ios: 'System', android: 'Roboto', default: 'System' }),
};

export const FontSize = {
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  '2xl': 28,
  '3xl': 34,
  '4xl': 42,
  hero: 52,
};

export const FontWeight = {
  regular:   '400' as const,
  medium:    '500' as const,
  semibold:  '600' as const,
  bold:      '700' as const,
  extrabold: '800' as const,
  black:     '900' as const,
};

export const LineHeight = {
  tight:   1.2,
  snug:    1.35,
  normal:  1.5,
  relaxed: 1.65,
};

export const Spacing = {
  px: 1,
  0.5: 2,
  1:   4,
  1.5: 6,
  2:   8,
  2.5: 10,
  3:   12,
  3.5: 14,
  4:   16,
  5:   20,
  6:   24,
  7:   28,
  8:   32,
  9:   36,
  10:  40,
  12:  48,
  14:  56,
  16:  64,
  20:  80,
  24:  96,
};

export const BorderRadius = {
  sm:   6,
  base: 10,
  md:   14,
  lg:   18,
  xl:   24,
  '2xl': 32,
  full: 9999,
};

export const Shadow = {
  sm: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  base: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  md: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  lg: {
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
    shadowRadius: 32,
    elevation: 16,
  },
  glow: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
  },
};
