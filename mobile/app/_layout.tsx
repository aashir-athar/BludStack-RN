// app/_layout.tsx
import 'react-native-url-polyfill/auto';
import React, { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import LoadingScreen from '@/components/LoadingScreen';

SplashScreen.preventAutoHideAsync();

// Any segment[0] in this set is considered a valid "inside the app" location.
// Without this, opening a deep link like request/abc on cold start bounces the
// user to (tabs) — destroying the link target. (Fixes flaw #11.)
const IN_APP_SEGMENTS = new Set(['(tabs)', 'request', 'donor', 'map', 'chat']);

function RootNavigator() {
  const { theme, isDark } = useTheme();
  const { loading, session, profile, isDonor, isRecipient } = useAuth();
  const segments = useSegments();
  const router   = useRouter();
  const didInitialRedirect = useRef(false);

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  useEffect(() => {
    if (loading) return;

    const seg0 = segments[0];
    const inAuth       = seg0 === '(auth)';
    const inOnboarding = seg0 === 'onboarding';
    const inApp        = seg0 !== undefined && IN_APP_SEGMENTS.has(seg0);

    if (!session) {
      if (!inAuth) router.replace('/(auth)');
      return;
    }

    if (!profile?.full_name) {
      if (!inOnboarding) router.replace('/onboarding');
      return;
    }

    // Logged in + onboarded. Only redirect if the user is somewhere they
    // shouldn't be (e.g. still on (auth) or onboarding after login).
    if (!inApp) {
      if (!didInitialRedirect.current) {
        didInitialRedirect.current = true;
        // First landing: recipient-only users go straight to Request tab;
        // anyone with donor capability gets the home feed.
        if (isRecipient && !isDonor) router.replace('/(tabs)/request');
        else                          router.replace('/(tabs)');
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [loading, session, profile?.full_name, isDonor, isRecipient, segments[0]]);

  if (loading) return <LoadingScreen message="Starting BludStack…" />;

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
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
        <Stack.Screen name="chat"         options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
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
