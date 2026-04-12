// app/_layout.tsx
import 'react-native-url-polyfill/auto';
import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import LoadingScreen from '@/components/LoadingScreen';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { theme, isDark } = useTheme();
  const { loading, session, profile } = useAuth();
  const segments = useSegments();
  const router   = useRouter();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  // Auth guard — redirect based on login/profile state
  useEffect(() => {
    if (loading) return;

    const inAuth       = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';
    const inTabs       = segments[0] === '(tabs)';

    if (!session) {
      if (!inAuth) router.replace('/(auth)');
    } else if (!profile?.full_name) {
      if (!inOnboarding) router.replace('/onboarding');
    } else {
      if (!inTabs) router.replace('/(tabs)');
    }
  }, [loading, session, profile?.full_name, segments[0]]);

  if (loading) return <LoadingScreen message="Starting BludStack…" />;

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/*
        In Expo Router v4, ALL screens must be registered unconditionally.
        Navigation is controlled by the useEffect guard above, not by
        conditionally rendering Stack.Screen children.
      */}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
          animation: 'fade_from_bottom',
        }}
      >
        <Stack.Screen name="(auth)"       options={{ headerShown: false }} />
        <Stack.Screen name="onboarding"   options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="(tabs)"       options={{ headerShown: false }} />
        <Stack.Screen name="request/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="donor/[id]"   options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="map/live"     options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}