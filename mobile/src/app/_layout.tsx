// Lever: Hick's Law + peak-end on first mount. Auth resolves and the user lands
// where their role expects; push taps deep-link straight into the request modal.
import 'react-native-url-polyfill/auto';
import React, { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { TamaguiProvider } from '@tamagui/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { tamaguiConfig } from '@/tamagui.config';
import { queryClient } from '@/queries/client';
import { useRealtimeBridge } from '@/queries/realtime';
import { useAppTheme, useIsDark } from '@/stores/themeStore';
import { initAuth, useAuth } from '@/stores/authStore';
import { LoadingScreen, ErrorBoundary, NetBanner, ToastViewport } from '@/ui';

// Old context providers are kept wrapped while screens migrate to the stores;
// they are removed once every screen reads from the new Zustand stores.
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';

// KeyboardProvider is a native module (not in Expo Go). Lazy require + a named
// pass-through fallback so the app boots in Expo Go and in a dev/prod build.
function KeyboardPassthrough({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
let KeyboardProvider: React.ComponentType<{ children: React.ReactNode }> = KeyboardPassthrough;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  KeyboardProvider = require('react-native-keyboard-controller').KeyboardProvider;
} catch {
  KeyboardProvider = KeyboardPassthrough;
}

SplashScreen.preventAutoHideAsync();

// Segments that count as "inside the app", so a deep link like /request/abc on
// cold start is not bounced back to (tabs) and the link target survives.
const IN_APP_SEGMENTS = new Set(['(tabs)', 'request', 'donor', 'map', 'chat', 'profile']);

function useNotificationDeepLinks(ready: boolean) {
  const router = useRouter();
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !lastResponse) return;
    const id = lastResponse.notification.request.identifier;
    if (handledIdRef.current === id) return;
    handledIdRef.current = id;
    routeFromPayload(router, lastResponse.notification.request.content.data);
  }, [ready, lastResponse, router]);

  useEffect(() => {
    if (!ready) return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const id = response.notification.request.identifier;
      if (handledIdRef.current === id) return;
      handledIdRef.current = id;
      routeFromPayload(router, response.notification.request.content.data);
    });
    return () => sub.remove();
  }, [ready, router]);
}

function routeFromPayload(router: ReturnType<typeof useRouter>, data: unknown) {
  if (!data || typeof data !== 'object') return;
  const payload = data as Record<string, unknown>;
  const requestId = typeof payload.requestId === 'string' ? payload.requestId : null;
  const screen = typeof payload.screen === 'string' ? payload.screen : null;
  if (!requestId) return;
  if (screen === 'chat' && typeof payload.receiverId === 'string') {
    router.push({
      pathname: '/chat',
      params: {
        requestId,
        receiverId: payload.receiverId,
        receiverName: typeof payload.receiverName === 'string' ? payload.receiverName : '',
      },
    });
    return;
  }
  router.push({ pathname: '/request/[id]', params: { id: requestId } });
}

function RootNavigator() {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const { loading, session, profile, isDonor, isRecipient } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const didInitialRedirect = useRef(false);

  useRealtimeBridge();

  const navReady = !loading && !!session && !!profile?.full_name;
  useNotificationDeepLinks(navReady);

  // Hide the native splash exactly once per app lifetime; the ref guard stops a
  // second hideAsync() (which throws) on later loading flips.
  const splashHiddenRef = useRef(false);
  useEffect(() => {
    if (loading || splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  // Single source of truth for the app flow: unauthenticated to /(auth);
  // onboarded-but-nameless to /onboarding; fully onboarded to the role-aware
  // landing (recipient-only to /(tabs)/request, donor/both to /(tabs)). The ref
  // makes the first landing one-shot; later runs only correct a wrong location.
  useEffect(() => {
    if (loading) return;
    const seg0 = segments[0];
    const inAuth = seg0 === '(auth)';
    const inOnboarding = seg0 === 'onboarding';
    const inApp = seg0 !== undefined && IN_APP_SEGMENTS.has(seg0);

    if (!session?.user?.id) {
      didInitialRedirect.current = false;
      if (!inAuth) router.replace('/(auth)');
      return;
    }
    if (!profile?.full_name) {
      if (!inOnboarding) router.replace('/onboarding');
      return;
    }
    if (!inApp) {
      if (!didInitialRedirect.current) {
        didInitialRedirect.current = true;
        if (isRecipient && !isDonor) router.replace('/(tabs)/request');
        else router.replace('/(tabs)');
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [loading, session?.user?.id, profile?.full_name, isDonor, isRecipient, segments, router]);

  if (loading) return <LoadingScreen message="Starting BludStack" />;

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} animated />
      <NetBanner />
      <Stack
        initialRouteName="index"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
          animation: 'fade_from_bottom',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false, animation: 'none' }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="request/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="donor/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="map/live" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="chat" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="profile/edit" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
      <ToastViewport />
    </>
  );
}

function TamaguiThemeBridge({ children }: { children: React.ReactNode }) {
  const isDark = useIsDark();
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={isDark ? 'dark' : 'light'}>
      {children}
    </TamaguiProvider>
  );
}

export default function RootLayout() {
  useEffect(() => initAuth(), []);
  return (
    <ErrorBoundary boundary="root">
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <SafeAreaProvider>
            <QueryClientProvider client={queryClient}>
              <TamaguiThemeBridge>
                <ThemeProvider>
                  <AuthProvider>
                    <ToastProvider>
                      <RootNavigator />
                    </ToastProvider>
                  </AuthProvider>
                </ThemeProvider>
              </TamaguiThemeBridge>
            </QueryClientProvider>
          </SafeAreaProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
