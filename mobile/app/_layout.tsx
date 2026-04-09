// app/_layout.tsx
import LoadingScreen from '@/components/LoadingScreen';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-url-polyfill/auto';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { theme, isDark } = useTheme();
  const { loading, session, profile } = useAuth();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

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
        {session ? (
          // Auth group
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        ) : !profile?.full_name ? (
          // Onboarding
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        ) : (
          // Main app
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        )}
        {/* Shared modals */}
        <Stack.Screen name="request/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="donor/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="map/live" options={{ headerShown: false }} />
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
