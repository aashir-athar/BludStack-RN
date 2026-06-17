// constants/Colors.ts
// BludStack - 2026 brand palette.
// Distinct from Uber. Warm onyx, warm bone, crimson-on-saline duality.
// Designed for medical urgency + emotional trust. Every token is semantic.

export const palette = {
  // ── Absolute (used by tokens; do not consume directly in components) ─────
  pure: '#FFFFFF',
  ink:  '#000000',

  // ── Crimson - the brand signature. Warmer than Uber red, more medical.
  crimson900: '#7A0C20',
  crimson800: '#A41030',
  crimson700: '#C8163C',
  crimson600: '#D4183D', // primary
  crimson500: '#E5314F',
  crimson400: '#EF5570',
  crimson300: '#F69CAC',
  crimson200: '#FBC7D1',
  crimson100: '#FDE4EA',
  crimson050: '#FDF1F4',

  // ── Saline - trust + medical green. Used for success, verified, available.
  saline900: '#04382A',
  saline800: '#075A41',
  saline700: '#0B7C58',
  saline600: '#0EA371',
  saline500: '#14C083',
  saline400: '#3DD49B',
  saline300: '#7CE3B9',
  saline200: '#B6F0D6',
  saline100: '#DCF7E8',

  // ── Plasma - amber for "urgent" tier. Warmer than pure orange.
  plasma900: '#5F3700',
  plasma800: '#8A4E00',
  plasma700: '#B86B0A',
  plasma600: '#E08410',
  plasma500: '#F5A623',
  plasma400: '#FFB94D',
  plasma300: '#FFD183',
  plasma200: '#FFE3B0',
  plasma100: '#FFF1D6',

  // ── Onyx - dark surfaces. Warm undertone, never pure black.
  onyx950: '#0A0910',
  onyx900: '#0F0E14',
  onyx850: '#161520',
  onyx800: '#1C1B27',
  onyx750: '#23222E',
  onyx700: '#2C2B38',
  onyx600: '#3A3946',
  onyx500: '#4E4D5A',
  onyx400: '#6C6B78',
  onyx300: '#8C8B96',
  onyx200: '#B5B4BC',
  onyx100: '#D7D6DC',

  // ── Bone - light surfaces. Warm off-white, never pure white.
  bone050: '#FAF8F5',
  bone100: '#F4F2EE',
  bone200: '#EAE7E2',
  bone300: '#DDD9D2',
  bone400: '#C1BDB6',
  bone500: '#9C9890',
  bone600: '#75716A',
  bone700: '#4F4C46',
  bone800: '#2D2C28',

  // ── Always-on alphas (overlays, scrims, pressed states) ──────────────────
  alphaInkXL:   'rgba(15,14,20,0.72)',  // modal scrim, dark
  alphaInkL:    'rgba(15,14,20,0.55)',
  alphaInkM:    'rgba(15,14,20,0.32)',
  alphaInkS:    'rgba(15,14,20,0.12)',
  alphaInkXS:   'rgba(15,14,20,0.06)',
  alphaPureXL:  'rgba(255,255,255,0.85)',
  alphaPureL:   'rgba(255,255,255,0.55)',
  alphaPureM:   'rgba(255,255,255,0.18)',
  alphaPureS:   'rgba(255,255,255,0.08)',
  alphaPureXS:  'rgba(255,255,255,0.04)',
};

export const Colors = {
  dark: {
    // ── Surfaces (Surface component reads from these) ──────────────────────
    background:     palette.onyx950,
    surface:        palette.onyx900,
    surfaceMuted:   palette.onyx850,
    card:           palette.onyx850,
    cardElevated:   palette.onyx800,
    cardHover:      palette.onyx750,

    // ── Borders + dividers ────────────────────────────────────────────────
    border:         palette.onyx700,
    borderStrong:   palette.onyx600,
    divider:        palette.onyx750,

    // ── Input ─────────────────────────────────────────────────────────────
    inputBg:        palette.onyx850,
    inputBorder:    palette.onyx700,
    inputFocus:     palette.crimson500,
    inputError:     palette.crimson500,
    placeholder:    palette.onyx400,

    // ── Text ──────────────────────────────────────────────────────────────
    textPrimary:    palette.pure,
    textSecondary:  palette.onyx200,
    textMuted:      palette.onyx300,
    textTertiary:   palette.onyx400,
    textDisabled:   palette.onyx500,
    textInverse:    palette.ink,
    textOnPrimary:  palette.pure,

    // ── Brand ─────────────────────────────────────────────────────────────
    primary:        palette.crimson600,
    primaryHover:   palette.crimson500,
    primaryDeep:    palette.crimson700,
    primarySoft:    'rgba(212,24,61,0.18)',
    primaryGhost:   'rgba(212,24,61,0.08)',

    // ── Semantic ──────────────────────────────────────────────────────────
    success:        palette.saline500,
    successSoft:    'rgba(20,192,131,0.16)',
    successDeep:    palette.saline700,
    warning:        palette.plasma500,
    warningSoft:    'rgba(245,166,35,0.18)',
    warningDeep:    palette.plasma700,
    danger:         palette.crimson500,
    dangerSoft:     'rgba(229,49,79,0.18)',
    info:           palette.onyx300,
    infoSoft:       palette.alphaPureS,

    // ── Tab bar ───────────────────────────────────────────────────────────
    tabBar:         palette.onyx850,
    tabBarBorder:   palette.onyx700,
    tabActive:      palette.pure,
    tabInactive:    palette.onyx300,

    // ── Effects ───────────────────────────────────────────────────────────
    shadowColor:    palette.ink,
    scrim:          palette.alphaInkXL,
    overlay:        palette.alphaInkL,
    pillBg:         palette.onyx800,
    pillBgStrong:   palette.onyx750,

    // ── Map (tints layered over the MapLibre raster basemap) ──────────────
    mapBg:          palette.onyx900,
  },
  light: {
    background:     palette.bone050,
    surface:        palette.pure,
    surfaceMuted:   palette.bone100,
    card:           palette.pure,
    cardElevated:   palette.bone100,
    cardHover:      palette.bone200,

    border:         palette.bone300,
    borderStrong:   palette.bone400,
    divider:        palette.bone200,

    inputBg:        palette.bone100,
    inputBorder:    palette.bone300,
    inputFocus:     palette.crimson600,
    inputError:     palette.crimson600,
    placeholder:    palette.bone600,

    textPrimary:    palette.onyx900,
    textSecondary:  palette.bone800,
    textMuted:      palette.bone600,
    textTertiary:   '#7A756C', // WCAG AA: bone500 failed 3:1 on light bg
    textDisabled:   palette.bone400,
    textInverse:    palette.pure,
    textOnPrimary:  palette.pure,

    primary:        palette.crimson600,
    primaryHover:   palette.crimson700,
    primaryDeep:    palette.crimson800,
    primarySoft:    palette.crimson100,
    primaryGhost:   palette.crimson050,

    success:        palette.saline600,
    successSoft:    palette.saline100,
    successDeep:    palette.saline800,
    warning:        '#A8620A', // WCAG AA: plasma600 failed 3:1 on light bg
    warningSoft:    palette.plasma100,
    warningDeep:    palette.plasma800,
    danger:         palette.crimson600,
    dangerSoft:     palette.crimson100,
    info:           palette.bone600,
    infoSoft:       palette.bone100,

    tabBar:         palette.pure,
    tabBarBorder:   palette.bone200,
    tabActive:      palette.onyx900,
    tabInactive:    palette.bone500,

    shadowColor:    palette.onyx900,
    scrim:          palette.alphaInkL,
    overlay:        palette.alphaInkM,
    pillBg:         palette.bone100,
    pillBgStrong:   palette.bone200,

    mapBg:          palette.bone050,
  },
};

export type ThemeColors = typeof Colors.dark;

// ── Urgency-tier specific colors (consumed by RequestCard / UrgencyBanner) ──
// Map server-side urgency_enum to a semantic surface color.
export const UrgencyTone = {
  critical: { tone: 'primary',  label: 'Critical' },
  urgent:   { tone: 'warning',  label: 'Urgent'   },
  standard: { tone: 'success',  label: 'Standard' },
} as const;
