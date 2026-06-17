// tamagui.config.ts
// BludStack design system, expressed as a Tamagui config. The palette, spacing,
// radius and type scale are imported from the existing constants so there is a
// SINGLE source of truth and the 2026 visual language stays pixel-identical to
// the locked `request.tsx` north-star. Tamagui drives reactive theming (dark/
// light) + the styled() API; precise layout values still come from the tokens.
//
// Verified to bundle on Expo SDK 56 / RN 0.85 / React 19.2 / New Architecture.
import { defaultConfig } from '@tamagui/config/v4';
import { createTamagui, createTokens } from '@tamagui/core';
import { palette, Colors, type ThemeColors } from '@/constants/Colors';
import { Spacing, Radius } from '@/constants/Typography';

// ── Token groups ────────────────────────────────────────────────────────────
// Space + size share the existing 4pt grid (Spacing). Tamagui requires a `true`
// default key.
const spaceScale = { ...Spacing, true: 16 } as const;

const radiusScale = {
  0: 0, xs: Radius.xs, sm: Radius.sm, base: Radius.base, md: Radius.md,
  lg: Radius.lg, xl: Radius.xl, '2xl': Radius['2xl'], '3xl': Radius['3xl'],
  pill: Radius.pill, true: Radius.base,
} as const;

const tokens = createTokens({
  ...defaultConfig.tokens,
  // v4 keeps colours in themes, not tokens - add a colour token group so brand
  // colours are usable as $tokens (e.g. $crimson600, $saline500).
  color: palette,
  space: spaceScale,
  size: spaceScale,
  radius: radiusScale,
});

// ── Themes ──────────────────────────────────────────────────────────────────
// Spread every BludStack semantic key (primary, success, textMuted, …) so
// components can use `$primary` / `useTheme().primary`, then add the base keys
// Tamagui's built-in primitives expect (color, borderColor, placeholderColor…).
function buildTheme(c: ThemeColors) {
  return {
    ...c,
    color: c.textPrimary,
    colorHover: c.textSecondary,
    colorPress: c.textMuted,
    colorFocus: c.textPrimary,
    colorTransparent: 'rgba(0,0,0,0)',
    backgroundHover: c.surfaceMuted,
    backgroundPress: c.card,
    backgroundFocus: c.surface,
    backgroundTransparent: 'rgba(0,0,0,0)',
    borderColor: c.border,
    borderColorHover: c.borderStrong,
    borderColorPress: c.borderStrong,
    borderColorFocus: c.primary,
    placeholderColor: c.placeholder,
    outlineColor: c.primary,
  };
}

const config = createTamagui({
  ...defaultConfig,
  tokens,
  themes: {
    ...defaultConfig.themes,
    dark: { ...defaultConfig.themes.dark, ...buildTheme(Colors.dark) },
    light: { ...defaultConfig.themes.light, ...buildTheme(Colors.light) },
  },
  settings: {
    ...defaultConfig.settings,
    // We run on the New Architecture; allow the faster style resolution paths.
    fastSchemeChange: true,
    onlyAllowShorthands: false,
  },
});

export type AppTamaguiConfig = typeof config;

declare module '@tamagui/core' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TamaguiCustomConfig extends AppTamaguiConfig {}
}

export const tamaguiConfig = config;
export default config;
