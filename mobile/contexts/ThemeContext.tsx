// contexts/ThemeContext.tsx
// Tri-state theme: 'system' | 'dark' | 'light'.
// • 'system' follows the OS appearance live (Appearance.addChangeListener).
// • Mode choice is persisted via AsyncStorage (key: bludstack_theme_mode).
//
// Robustness notes — react-native's useColorScheme() can momentarily return
// null in Expo Go on Android, which our previous implementation interpreted as
// "not dark" → light theme on a dark device. We now combine:
//   1. Appearance.getColorScheme() as a synchronous fallback,
//   2. A subscription to Appearance.addChangeListener for live updates.

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, ThemeColors } from '@/constants/Colors';

type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeContextValue {
  theme: ThemeColors;
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'bludstack_theme_mode';

function readSystem(): ColorSchemeName {
  // Direct read — works even when useColorScheme() hasn't ticked yet.
  return Appearance.getColorScheme();
}

// System-follows-device is the default — user's call. Profile → Appearance
// lets the user override.
const DEFAULT_MODE: ThemeMode = 'system';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_MODE);
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(readSystem());

  // ── Subscribe to OS appearance changes so 'system' tracks live ───────────
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    // One more re-read in case the OS reported between mount and subscription
    setSystemScheme(readSystem());
    return () => sub.remove();
  }, []);

  // ── Hydrate user's stored choice ─────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'dark' || stored === 'light' || stored === 'system') {
        setModeState(stored);
      }
    });
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(STORAGE_KEY, newMode).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  // ── Compute isDark ────────────────────────────────────────────────────────
  // Mode wins for explicit user choice; for 'system' we trust the OS, with a
  // sane default (DARK) when the OS hasn't reported yet. Defaulting to DARK
  // matches the brand palette better than flashing the light theme.
  const isDark = useMemo(() => {
    if (mode === 'dark')  return true;
    if (mode === 'light') return false;
    if (systemScheme == null) return true; // null / undefined → dark default
    return systemScheme === 'dark';
  }, [mode, systemScheme]);

  const theme = useMemo(() => (isDark ? Colors.dark : Colors.light), [isDark]);

  const value = useMemo(
    () => ({ theme, mode, isDark, setMode, toggleTheme }),
    [theme, mode, isDark, setMode, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
