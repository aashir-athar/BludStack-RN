// constants/Colors.ts
// BludStack Design System — Medical Neon / Dark Futuristic

export const palette = {
  // Core brand
  bloodRed: '#FF2D55',
  bloodRedDark: '#C0001E',
  bloodRedLight: '#FF6B85',

  // Medical neon
  cyan: '#00D4FF',
  cyanDark: '#0099CC',
  cyanGlow: '#00D4FF22',
  teal: '#00897B',
  tealLight: '#4DB6AC',

  // Alert / Urgency
  amber: '#FFB300',
  amberLight: '#FFD54F',
  green: '#00C853',
  greenLight: '#69F0AE',

  // Neutrals (dark)
  darkBg: '#080D14',
  darkSurface: '#0F1620',
  darkCard: '#131C28',
  darkBorder: '#1E2D3D',
  darkMuted: '#1A2535',

  // Neutrals (light)
  lightBg: '#F0F4F8',
  lightSurface: '#FFFFFF',
  lightCard: '#F7F9FC',
  lightBorder: '#DDE4ED',
  lightMuted: '#EAF0F6',

  // Text (dark mode)
  textPrimaryDark: '#F0F8FF',
  textSecondaryDark: '#8BA5C0',
  textMutedDark: '#4A6278',

  // Text (light mode)
  textPrimaryLight: '#0A1628',
  textSecondaryLight: '#3D5A72',
  textMutedLight: '#7A96AE',

  // Overlays
  overlay: 'rgba(8,13,20,0.85)',
  overlayLight: 'rgba(240,244,248,0.90)',

  // Glass
  glassDark: 'rgba(19,28,40,0.75)',
  glassLight: 'rgba(255,255,255,0.75)',
};

export const Colors = {
  dark: {
    // Backgrounds
    background: palette.darkBg,
    surface: palette.darkSurface,
    card: palette.darkCard,
    border: palette.darkBorder,
    muted: palette.darkMuted,

    // Text
    textPrimary: palette.textPrimaryDark,
    textSecondary: palette.textSecondaryDark,
    textMuted: palette.textMutedDark,
    textInverse: palette.textPrimaryLight,

    // Brand
    primary: palette.bloodRed,
    primaryDark: palette.bloodRedDark,
    primaryLight: palette.bloodRedLight,
    accent: palette.cyan,
    accentDark: palette.cyanDark,
    accentGlow: palette.cyanGlow,
    teal: palette.teal,
    tealLight: palette.tealLight,

    // Status
    success: palette.green,
    successLight: palette.greenLight,
    warning: palette.amber,
    warningLight: palette.amberLight,
    error: palette.bloodRed,

    // Glass / Overlay
    glass: palette.glassDark,
    overlay: palette.overlay,

    // Tab bar
    tabActive: palette.cyan,
    tabInactive: palette.textMutedDark,
    tabBar: palette.darkSurface,

    // Input
    inputBg: palette.darkMuted,
    inputBorder: palette.darkBorder,
    inputFocus: palette.cyan,

    // Shadow
    shadowColor: '#000000',
  },
  light: {
    // Backgrounds
    background: palette.lightBg,
    surface: palette.lightSurface,
    card: palette.lightCard,
    border: palette.lightBorder,
    muted: palette.lightMuted,

    // Text
    textPrimary: palette.textPrimaryLight,
    textSecondary: palette.textSecondaryLight,
    textMuted: palette.textMutedLight,
    textInverse: palette.textPrimaryDark,

    // Brand
    primary: palette.bloodRed,
    primaryDark: palette.bloodRedDark,
    primaryLight: palette.bloodRedLight,
    accent: palette.cyanDark,
    accentDark: palette.cyanDark,
    accentGlow: 'rgba(0,153,204,0.10)',
    teal: palette.teal,
    tealLight: palette.tealLight,

    // Status
    success: palette.teal,
    successLight: palette.tealLight,
    warning: palette.amber,
    warningLight: palette.amberLight,
    error: palette.bloodRed,

    // Glass / Overlay
    glass: palette.glassLight,
    overlay: palette.overlayLight,

    // Tab bar
    tabActive: palette.bloodRed,
    tabInactive: palette.textMutedLight,
    tabBar: palette.lightSurface,

    // Input
    inputBg: palette.lightMuted,
    inputBorder: palette.lightBorder,
    inputFocus: palette.cyanDark,

    // Shadow
    shadowColor: '#2A4A6A',
  },
};

export type ThemeColors = typeof Colors.dark;
