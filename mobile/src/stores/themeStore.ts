// stores/themeStore.ts
// Tri-state theme ('system' | 'dark' | 'light') as a Zustand store — replaces
// ThemeContext. Self-initialising: subscribes to OS appearance + hydrates the
// persisted choice at module load, so no provider is required.
//
//   const mode = useThemeMode();        // 'system' | 'dark' | 'light'
//   const isDark = useIsDark();
//   const theme = useAppTheme();        // ThemeColors (stable ref)
//   useThemeStore.getState().setMode('dark');
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { Colors, type ThemeColors } from '@/constants/Colors';

const STORAGE_KEY = 'bludstack_theme_mode';

export type ThemeMode = 'dark' | 'light' | 'system';
type SystemScheme = 'dark' | 'light';

function readSystem(): SystemScheme {
  // Unknown (null/undefined) defaults to dark — matches the brand palette and
  // avoids a light flash on a dark device.
  return Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
}

interface ThemeState {
  mode: ThemeMode;
  systemScheme: SystemScheme;
}
interface ThemeActions {
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}
export type ThemeStore = ThemeState & ThemeActions;

function resolveIsDark(s: ThemeState): boolean {
  if (s.mode === 'dark') return true;
  if (s.mode === 'light') return false;
  return s.systemScheme === 'dark';
}

export const useThemeStore = create<ThemeStore>()(
  subscribeWithSelector((set, get) => ({
    mode: 'system',
    systemScheme: readSystem(),
    setMode: (mode) => {
      set({ mode });
      AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => {});
    },
    toggleTheme: () => {
      get().setMode(resolveIsDark(get()) ? 'light' : 'dark');
    },
  })),
);

// Live OS appearance changes keep 'system' mode in sync.
Appearance.addChangeListener(({ colorScheme }) => {
  useThemeStore.setState({ systemScheme: colorScheme === 'light' ? 'light' : 'dark' });
});

// Hydrate the persisted choice once.
AsyncStorage.getItem(STORAGE_KEY)
  .then((stored) => {
    if (stored === 'dark' || stored === 'light' || stored === 'system') {
      useThemeStore.setState({ mode: stored });
    }
  })
  .catch(() => {});

// ── Selectors ────────────────────────────────────────────────────────────────
export const useIsDark = () => useThemeStore(resolveIsDark);
export const useThemeMode = () => useThemeStore((s) => s.mode);
export const useAppTheme = (): ThemeColors => (useIsDark() ? Colors.dark : Colors.light);
