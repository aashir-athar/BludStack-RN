// constants/Colors.ts
// BludStack — Uber-inspired design system
// Pure black base · Surgical white type · Blood red as the ONLY accent
// No gradients. No glass. No neon. Just weight, space, and contrast.

export const palette = {
  // Absolute
  black:      '#000000',
  white:      '#FFFFFF',
  offBlack:   '#080808',

  // Surfaces — dark
  surface0:   '#0A0A0A', // deepest bg
  surface1:   '#111111', // card bg
  surface2:   '#1A1A1A', // elevated
  surface3:   '#242424', // input bg
  surface4:   '#2E2E2E', // border/divider

  // Surfaces — light
  lSurface0:  '#F6F6F6',
  lSurface1:  '#FFFFFF',
  lSurface2:  '#F0F0F0',
  lSurface3:  '#E8E8E8',
  lSurface4:  '#D8D8D8',

  // Type — dark mode
  textPrimary:   '#FFFFFF',
  textSecondary: '#9B9B9B',
  textTertiary:  '#5A5A5A',
  textDisabled:  '#3A3A3A',

  // Type — light mode
  lTextPrimary:   '#000000',
  lTextSecondary: '#6B6B6B',
  lTextTertiary:  '#9B9B9B',
  lTextDisabled:  '#C4C4C4',

  // The ONE accent — blood
  red:        '#E8002D', // Uber red, slightly shifted for medical feel
  redDark:    '#B8001F',
  redLight:   '#FF1744',
  redMuted:   '#E8002D18',
  redSubtle:  '#E8002D0A',

  // Semantic
  green:      '#00A651',
  greenMuted: '#00A65118',
  amber:      '#F5A623',
  amberMuted: '#F5A62318',
};

export const Colors = {
  dark: {
    background:    palette.surface0,
    surface:       palette.surface1,
    card:          palette.surface1,
    cardElevated:  palette.surface2,
    border:        palette.surface4,
    divider:       palette.surface3,
    inputBg:       palette.surface3,
    inputBorder:   palette.surface4,
    inputFocus:    palette.white,

    textPrimary:   palette.textPrimary,
    textSecondary: palette.textSecondary,
    textMuted:     palette.textTertiary,
    textDisabled:  palette.textDisabled,
    textInverse:   palette.black,

    primary:       palette.red,
    primaryDark:   palette.redDark,
    primaryLight:  palette.redLight,
    primaryMuted:  palette.redMuted,
    primarySubtle: palette.redSubtle,

    success:       palette.green,
    successMuted:  palette.greenMuted,
    warning:       palette.amber,
    warningMuted:  palette.amberMuted,
    error:         palette.red,

    tabBar:        palette.surface1,
    tabActive:     palette.white,
    tabInactive:   palette.textTertiary,

    shadowColor:   '#000000',
    overlay:       'rgba(0,0,0,0.7)',
    pillBg:        palette.surface3,
  },
  light: {
    background:    palette.lSurface0,
    surface:       palette.lSurface1,
    card:          palette.lSurface1,
    cardElevated:  palette.lSurface2,
    border:        palette.lSurface4,
    divider:       palette.lSurface3,
    inputBg:       palette.lSurface2,
    inputBorder:   palette.lSurface4,
    inputFocus:    palette.black,

    textPrimary:   palette.lTextPrimary,
    textSecondary: palette.lTextSecondary,
    textMuted:     palette.lTextTertiary,
    textDisabled:  palette.lTextDisabled,
    textInverse:   palette.white,

    primary:       palette.red,
    primaryDark:   palette.redDark,
    primaryLight:  palette.redLight,
    primaryMuted:  palette.redMuted,
    primarySubtle: palette.redSubtle,

    success:       palette.green,
    successMuted:  palette.greenMuted,
    warning:       palette.amber,
    warningMuted:  palette.amberMuted,
    error:         palette.red,

    tabBar:        palette.white,
    tabActive:     palette.black,
    tabInactive:   palette.lTextTertiary,

    shadowColor:   '#000000',
    overlay:       'rgba(0,0,0,0.5)',
    pillBg:        palette.lSurface2,
  },
};

export type ThemeColors = typeof Colors.dark;
