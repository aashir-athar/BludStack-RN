// app/(tabs)/_layout.tsx
// Lever: Fitts's Law + role-aware visibility. The primary action (Request) is
// always the centre pill so the user's thumb reaches it without re-aiming;
// secondary tabs flank it. Role determines which tabs render — recipient-only
// users never see donor-side tabs, and vice versa.

import React from 'react';
import { Tabs } from 'expo-router';
import {
  LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  FontSize, FontWeight, LetterSpacing, Spacing, Radius, Elevation, Motion,
} from '@/constants/Typography';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Role = 'donor' | 'recipient' | 'all';
type TabDef = {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  role: Role;
  cta?: boolean;
};

const ALL_TABS: readonly TabDef[] = [
  { name: 'index',        label: 'Home',     icon: 'home-outline',    iconActive: 'home',          role: 'donor' },
  { name: 'request',      label: 'Request',  icon: 'add-circle',      iconActive: 'add-circle',    role: 'all', cta: true },
  { name: 'donors',       label: 'Find',     icon: 'search-outline',  iconActive: 'search',        role: 'donor' },
  { name: 'my-requests',  label: 'Requests', icon: 'list-outline',    iconActive: 'list',          role: 'recipient' },
  { name: 'history',      label: 'History',  icon: 'heart-outline',   iconActive: 'heart',         role: 'donor' },
  { name: 'profile',      label: 'Account',  icon: 'person-outline',  iconActive: 'person',        role: 'all' },
] as const;

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { theme, isDark } = useTheme();
  const { isDonor, isRecipient } = useAuth();
  const insets = useSafeAreaInsets();

  const TAB_BAR_HEIGHT = 64;

  const visibleFor = (role: Role) =>
    role === 'all' || (role === 'donor' && isDonor) || (role === 'recipient' && isRecipient);

  function handlePress(index: number, key: string, name: string) {
    LayoutAnimation.configureNext({
      duration: Motion.duration.base,
      create: { type: 'spring', springDamping: 0.72, property: 'scaleXY' },
      update: { type: 'spring', springDamping: 0.72 },
      delete: { type: 'spring', springDamping: 0.72, property: 'scaleXY' },
    });
    const event = navigation.emit({ type: 'tabPress', target: key, canPreventDefault: true });
    if (state.index !== index && !event.defaultPrevented) navigation.navigate(name);
  }

  return (
    <View
      style={[
        styles.barWrapper,
        {
          bottom: Math.max(insets.bottom, Spacing[3]) + Spacing[2],
          left: Spacing[4],
          right: Spacing[4],
          height: TAB_BAR_HEIGHT,
          backgroundColor: theme.tabBar,
          borderColor: theme.tabBarBorder,
        },
        Elevation.lg,
      ]}
    >
      {state.routes.map((route, index) => {
        const tab = ALL_TABS.find(t => t.name === route.name);
        if (!tab || !visibleFor(tab.role)) return null;

        const focused = state.index === index;
        const isCta   = tab.cta;
        const iconName = focused ? tab.iconActive : tab.icon;

        const pillBg =
          isCta   ? theme.primary
          : isDark ? theme.surface
          :          theme.textPrimary;

        const pillFg =
          isCta            ? theme.textOnPrimary
          : isDark         ? theme.textPrimary
          :                  theme.surface;

        return (
          <Pressable
            key={route.key}
            onPress={() => handlePress(index, route.key, route.name)}
            style={[styles.tabItem, focused && styles.tabItemFocused]}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            {focused ? (
              <View style={[styles.activePill, { backgroundColor: pillBg }]}>
                <Ionicons name={iconName} size={18} color={pillFg} />
                <Text style={[styles.activeLabel, { color: pillFg }]} numberOfLines={1}>
                  {tab.label}
                </Text>
              </View>
            ) : (
              <View style={styles.inactiveWrap}>
                <Ionicons
                  name={iconName}
                  size={20}
                  color={isCta ? theme.primary : theme.tabInactive}
                />
                {isCta && <View style={[styles.ctaDot, { backgroundColor: theme.primary }]} />}
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {ALL_TABS.map(tab => (
        <Tabs.Screen key={tab.name} name={tab.name} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  barWrapper: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing[2],
  },
  tabItem: {
    flex: 1,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemFocused: { flex: 2.4 },

  activePill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing[2], height: 44, width: '100%',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing[3],
  },
  activeLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.snug,
  },

  inactiveWrap: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  ctaDot: { width: 4, height: 4, borderRadius: 2, opacity: 0.9 },
});
