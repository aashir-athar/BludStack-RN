// constants/Typography.ts
// 2026 type scale + motion tokens. System-font based (no font bundle weight)
// with semantic roles (display / headline / title / body / label / caption).
// Primitive sizes/weights/letterSpacings preserved for backwards compatibility.

import { Platform, TextStyle, Easing } from 'react-native';

// ── Font families ───────────────────────────────────────────────────────────
export const FontFamily = {
  display: Platform.select({
    ios:     'System',
    android: 'sans-serif',
    default: 'System',
  }),
  body: Platform.select({
    ios:     'System',
    android: 'sans-serif',
    default: 'System',
  }),
  mono: Platform.select({
    ios:     'Menlo',
    android: 'monospace',
    default: 'monospace',
  }),
};

// ── Primitive sizes (kept for backwards compatibility) ──────────────────────
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
  tighter: -1.2,
  tight:   -0.8,
  snug:    -0.4,
  normal:   0,
  wide:     0.4,
  wider:    1.0,
  widest:   1.6,
};

export const LineHeight = {
  none:    1.0,
  tight:   1.1,
  snug:    1.2,
  normal:  1.4,
  relaxed: 1.6,
};

// ── Spacing scale (4pt base grid) ───────────────────────────────────────────
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
  '0.5': 2,
  '1.5': 6,
  '2.5': 10,
  '3.5': 14,
};

// ── Radius — 2026 = generous curvature, pill shape is the default for actions
export const Radius = {
  none:  0,
  xs:    6,
  sm:    10,
  base:  14,
  md:    18,
  lg:    22,
  xl:    28,
  '2xl': 36,
  '3xl': 44,
  pill:  9999,
  full:  9999,
};

// ── Elevation — restrained, no harsh shadows. iOS uses opacity, Android elevation
export const Elevation = {
  none: { shadowColor: 'transparent', shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
  xs: {
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius:  2,
    elevation:     1,
  },
  sm: {
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius:  4,
    elevation:     2,
  },
  base: {
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius:  12,
    elevation:     4,
  },
  md: {
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius:  24,
    elevation:     8,
  },
  lg: {
    shadowOffset:  { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius:  40,
    elevation:     16,
  },
};

// Backwards-compat alias for older imports
export const Shadow = Elevation;

// ── Semantic type roles ─────────────────────────────────────────────────────
// One source of truth — components compose these.
export type TypographyRole =
  | 'display' | 'headline' | 'title' | 'titleSm'
  | 'body'    | 'bodySm'   | 'label' | 'labelSm'
  | 'overline' | 'caption';

export const Type: Record<TypographyRole, TextStyle> = {
  display: {
    fontFamily: FontFamily.display,
    fontSize:   FontSize['3xl'],
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.tighter,
    lineHeight: FontSize['3xl'] * LineHeight.tight,
  },
  headline: {
    fontFamily: FontFamily.display,
    fontSize:   FontSize['2xl'],
    fontWeight: FontWeight.heavy,
    letterSpacing: LetterSpacing.tight,
    lineHeight: FontSize['2xl'] * LineHeight.tight,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize:   FontSize.lg,
    fontWeight: FontWeight.bold,
    letterSpacing: LetterSpacing.snug,
    lineHeight: FontSize.lg * LineHeight.snug,
  },
  titleSm: {
    fontFamily: FontFamily.display,
    fontSize:   FontSize.md,
    fontWeight: FontWeight.bold,
    letterSpacing: LetterSpacing.snug,
    lineHeight: FontSize.md * LineHeight.snug,
  },
  body: {
    fontFamily: FontFamily.body,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.regular,
    letterSpacing: LetterSpacing.normal,
    lineHeight: FontSize.base * LineHeight.relaxed,
  },
  bodySm: {
    fontFamily: FontFamily.body,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.regular,
    letterSpacing: LetterSpacing.normal,
    lineHeight: FontSize.sm * LineHeight.relaxed,
  },
  label: {
    fontFamily: FontFamily.body,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.semibold,
    letterSpacing: LetterSpacing.wide,
    lineHeight: FontSize.sm * LineHeight.normal,
  },
  labelSm: {
    fontFamily: FontFamily.body,
    fontSize:   FontSize.xs,
    fontWeight: FontWeight.semibold,
    letterSpacing: LetterSpacing.wide,
    lineHeight: FontSize.xs * LineHeight.normal,
  },
  overline: {
    fontFamily: FontFamily.body,
    fontSize:   FontSize['2xs'],
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.widest,
    lineHeight: FontSize['2xs'] * LineHeight.normal,
    textTransform: 'uppercase',
  },
  caption: {
    fontFamily: FontFamily.body,
    fontSize:   FontSize.xs,
    fontWeight: FontWeight.regular,
    letterSpacing: LetterSpacing.normal,
    lineHeight: FontSize.xs * LineHeight.relaxed,
  },
};

// ── Motion tokens — Reanimated v4 worklet-friendly ──────────────────────────
// One curve to rule them all (in-out, slight overshoot on bigger moves).
export const Motion = {
  duration: {
    instant: 80,   // micro press feedback
    fast:    160,  // tap → state change
    base:    240,  // sheet / modal slide
    slow:    400,  // full-page transition
    bloom:   640,  // success / celebration
  },
  spring: {
    snappy: { damping: 18, stiffness: 240, mass: 0.7 },
    soft:   { damping: 16, stiffness: 140, mass: 0.9 },
    bouncy: { damping: 12, stiffness: 180, mass: 0.8 },
    rigid:  { damping: 24, stiffness: 320, mass: 0.6 },
  },
  easing: {
    standard: Easing.bezier(0.2, 0.0, 0.0, 1.0),     // material 3 standard
    emphasized: Easing.bezier(0.2, 0.0, 0.0, 1.0),
    decelerate: Easing.bezier(0.0, 0.0, 0.2, 1.0),
    accelerate: Easing.bezier(0.4, 0.0, 1.0, 1.0),
  },
};

// ── Layout constants ────────────────────────────────────────────────────────
export const TAB_BAR_HEIGHT      = 64;
export const TAB_BAR_BOTTOM_INSET = 96;     // safe area + tab bar lift
export const PILL_HEIGHT_SM      = 32;
export const PILL_HEIGHT_BASE    = 44;
export const PILL_HEIGHT_LG      = 52;
export const PILL_HEIGHT_XL      = 60;
export const HIT_SLOP            = { top: 8, right: 8, bottom: 8, left: 8 };

// Backwards-compat alias for older imports
export const BorderRadius = Radius;
