// app/(tabs)/_layout.tsx
import React from 'react';
import { Tabs } from 'expo-router';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import Svg, { Path, Circle, Line, Polyline } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '@/contexts/ThemeContext';
import { FontSize, FontWeight, Spacing, Radius, LetterSpacing } from '@/constants/Typography';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { name: 'index',       label: 'Home',    isRed: false },
  { name: 'request',     label: 'Request', isRed: true  },
  { name: 'donors',      label: 'Find',    isRed: false },
  { name: 'my-requests', label: 'History', isRed: false },
  { name: 'profile',     label: 'Account', isRed: false },
];

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconHome({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <Polyline points="9,22 9,12 15,12 15,22" />
    </Svg>
  );
}
function IconPlusCircle({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={9} />
      <Line x1={12} y1={8} x2={12} y2={16} />
      <Line x1={8} y1={12} x2={16} y2={12} />
    </Svg>
  );
}
function IconSearch({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={11} cy={11} r={8} />
      <Line x1={21} y1={21} x2={16.65} y2={16.65} />
    </Svg>
  );
}
function IconList({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Line x1={8}  y1={6}  x2={21} y2={6}  />
      <Line x1={8}  y1={12} x2={21} y2={12} />
      <Line x1={8}  y1={18} x2={21} y2={18} />
      <Circle cx={4} cy={6}  r={1} fill={color} />
      <Circle cx={4} cy={12} r={1} fill={color} />
      <Circle cx={4} cy={18} r={1} fill={color} />
    </Svg>
  );
}
function IconUser({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <Circle cx={12} cy={7} r={4} />
    </Svg>
  );
}

const ICONS = [IconHome, IconPlusCircle, IconSearch, IconList, IconUser];

// ─── Custom Tab Bar ───────────────────────────────────────────────────────────

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const TAB_BAR_HEIGHT = 68;
  const BOTTOM_OFFSET  = Math.max(insets.bottom, Spacing[4]);

  const barBg    = isDark ? 'rgba(22,22,22,0.97)' : 'rgba(255,255,255,0.97)';
  const barBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const inactiveColor = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)';
  const dotColor      = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.18)';

  function handlePress(index: number, key: string, name: string) {
    LayoutAnimation.configureNext({
      duration: 320,
      create: { type: 'spring', springDamping: 0.72, property: 'scaleXY' },
      update: { type: 'spring', springDamping: 0.72 },
      delete: { type: 'spring', springDamping: 0.72, property: 'scaleXY' },
    });
    const event = navigation.emit({ type: 'tabPress', target: key, canPreventDefault: true });
    if (state.index !== index && !event.defaultPrevented) {
      navigation.navigate(name);
    }
  }

  return (
    <View
      style={[
        styles.barWrapper,
        {
          bottom: BOTTOM_OFFSET,
          left: Spacing[5],
          right: Spacing[5],
          height: TAB_BAR_HEIGHT,
          backgroundColor: barBg,
          borderColor: barBorder,
          shadowOpacity: isDark ? 0.6 : 0.12,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const focused  = state.index === index;
        const tabCfg   = TABS[index];
        const Icon     = ICONS[index];

        // Pill colours
        const pillBg    = tabCfg.isRed ? '#E8002D' : isDark ? '#FFFFFF' : '#111111';
        const onPill    = tabCfg.isRed ? '#FFFFFF' : isDark ? '#000000' : '#FFFFFF';

        return (
          <Pressable
            key={route.key}
            onPress={() => handlePress(index, route.key, route.name)}
            style={[styles.tabItem, focused && styles.tabItemFocused]}
            accessibilityRole="button"
            accessibilityLabel={tabCfg.label}
          >
            {focused ? (
              // ── Active pill ──────────────────────────────────────────────
              <View style={[styles.activePill, { backgroundColor: pillBg }]}>
                <Icon color={onPill} />
                <Text style={[styles.activeLabel, { color: onPill }]}>
                  {tabCfg.label}
                </Text>
              </View>
            ) : (
              // ── Inactive icon + dot ──────────────────────────────────────
              <View style={styles.inactiveWrapper}>
                <Icon color={inactiveColor} />
                <View style={[styles.dot, { backgroundColor: dotColor }]} />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function TabsLayout() {
  const { theme, isDark } = useTheme();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {TABS.map(tab => (
        <Tabs.Screen key={tab.name} name={tab.name} />
      ))}
    </Tabs>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  barWrapper: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 34,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 32,
  },

  tabItem: {
    flex: 1,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabItemFocused: {
    flex: 2.4,
  },

  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    width: '100%',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[3],
  },

  // kept for variable-name parity
  activeEmoji: { fontSize: 14 },

  activeLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.snug,
  },

  // kept for variable-name parity
  inactiveEmoji: { fontSize: 18 },

  inactiveWrapper: {
    alignItems: 'center',
    gap: 4,
  },

  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    opacity: 0.55,
  },
});