// app/(tabs)/_layout.tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { Text, View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { FontSize, Spacing } from '@/constants/Typography';

interface TabIconProps {
  emoji: string;
  focused: boolean;
  label: string;
  color: string;
}

function TabIcon({ emoji, focused, label, color }: TabIconProps) {
  return (
    <View style={[styles.tabIconWrap, focused && styles.tabIconFocused]}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.tabLabel, { color }]}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: theme.tabActive,
        tabBarInactiveTintColor: theme.tabInactive,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="🏠" focused={focused} label="Home" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="request"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="🩸" focused={focused} label="Request" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="donors"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="🗺️" focused={focused} label="Find" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-requests"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="📋" focused={focused} label="My Requests" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="👤" focused={focused} label="Profile" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIconWrap: { alignItems: 'center', justifyContent: 'center', gap: 2, paddingTop: Spacing[1] },
  tabIconFocused: {},
  emoji:    { fontSize: 20 },
  tabLabel: { fontSize: FontSize.xs - 1 },
});
