// app/_layout.tsx
// Lever: Hick's Law + peak-end rule on first-mount. We never ask the user to
// re-aim — the moment auth resolves they land where their role expects them.
// Push taps deep-link straight into the relevant request modal, so a "blood
// needed" notification skips Home entirely.

import 'react-native-url-polyfill/auto';
import React, { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
// KeyboardProvider is a native module (not available in Expo Go).
// Lazy require + fallback to a pass-through Provider so the app boots both in
// Expo Go and in a dev/production build.
let KeyboardProvider: React.ComponentType<{ children: React.ReactNode }>;
try {
  KeyboardProvider = require('react-native-keyboard-controller').KeyboardProvider;
} catch {
  KeyboardProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
}
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import LoadingScreen from '@/components/LoadingScreen';
import ErrorBoundary from '@/components/ErrorBoundary';
import NetBanner from '@/components/NetBanner';

SplashScreen.preventAutoHideAsync();

// Any segment[0] in this set is considered a valid "inside the app" location.
// Without this, opening a deep link like /request/abc on cold start bounces the
// user to (tabs) — destroying the link target.
const IN_APP_SEGMENTS = new Set(['(tabs)', 'request', 'donor', 'map', 'chat', 'profile']);

// ── Push-tap deep-link router ────────────────────────────────────────────────
// Backend pushes carry `data.requestId` (and an optional `screen`). When the
// user taps the notification we route to /request/{requestId}. This works
// across:
//   • Cold start          → useLastNotificationResponse() resolves once mount
//                            settles and session is known.
//   • Warm foreground tap → addNotificationResponseReceivedListener fires.
function useNotificationDeepLinks(ready: boolean) {
  const router = useRouter();
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledIdRef = useRef<string | null>(null);

  // Cold-start: the OS hands us the response that opened the app.
  useEffect(() => {
    if (!ready || !lastResponse) return;
    const id = lastResponse.notification.request.identifier;
    if (handledIdRef.current === id) return;
    handledIdRef.current = id;
    routeFromPayload(router, lastResponse.notification.request.content.data);
  }, [ready, lastResponse, router]);

  // Warm: subsequent taps while the app is open.
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
  const screen    = typeof payload.screen    === 'string' ? payload.screen    : null;
  if (requestId) {
    if (screen === 'chat' && typeof payload.receiverId === 'string') {
      router.push({
        pathname: '/chat',
        params: {
          requestId,
          receiverId: payload.receiverId,
          receiverName: typeof payload.receiverName === 'string' ? payload.receiverName : '',
        },
      } as any);
      return;
    }
    router.push(`/request/${requestId}` as any);
  }
}

function RootNavigator() {
  const { theme, isDark } = useTheme();
  const { loading, session, profile, isDonor, isRecipient } = useAuth();
  const segments = useSegments();
  const router   = useRouter();
  const didInitialRedirect = useRef(false);

  // Wait until auth has settled + profile is loaded before processing push taps,
  // otherwise the deep-link race-conditions against the auth-gate redirect.
  const navReady = !loading && !!session && !!profile?.full_name;
  useNotificationDeepLinks(navReady);

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  // ── App flow (single source of truth) ─────────────────────────────────
  //
  //   ┌──────────────────────────────────────────────────────────────┐
  //   │  1. session === null                  ─►  /(auth)             │
  //   │  2. profile?.full_name is empty       ─►  /onboarding         │
  //   │  3. fully onboarded — first landing   ─►  role-aware tab:     │
  //   │       recipient-only       → /(tabs)/request                  │
  //   │       donor or both        → /(tabs)                          │
  //   │  4. already inside the app (inApp) — leave the user be        │
  //   └──────────────────────────────────────────────────────────────┘
  //
  // The `didInitialRedirect` ref makes the role-aware landing one-shot.
  // Subsequent re-runs only intervene if the user is somewhere they
  // shouldn't be (still on /(auth) or /onboarding after completion).
  useEffect(() => {
    if (loading) return;

    const seg0 = segments[0];
    const inAuth       = seg0 === '(auth)';
    const inOnboarding = seg0 === 'onboarding';
    const inApp        = seg0 !== undefined && IN_APP_SEGMENTS.has(seg0);

    // Step 1 — unauthenticated → /(auth).
    // Strict check: a Supabase Session must carry a user.id. Anything weaker
    // (e.g. a stale anon row, half-constructed object) is treated as "no auth".
    const isAuthenticated = !!session?.user?.id;
    if (!isAuthenticated) {
      didInitialRedirect.current = false; // reset so post-login lands cleanly
      if (!inAuth) router.replace('/(auth)');
      return;
    }

    // Step 2 — authenticated but profile incomplete → /onboarding
    if (!profile?.full_name) {
      if (!inOnboarding) router.replace('/onboarding');
      return;
    }

    // Step 3 — fully onboarded → first role-aware landing (one-shot)
    if (!inApp) {
      if (!didInitialRedirect.current) {
        didInitialRedirect.current = true;
        if (isRecipient && !isDonor) router.replace('/(tabs)/request');
        else                          router.replace('/(tabs)');
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [loading, session?.user?.id, profile?.full_name, isDonor, isRecipient, segments[0], router]);

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
        {/* The root index decides where to go FIRST. See app/index.tsx. */}
        <Stack.Screen name="index"        options={{ headerShown: false, animation: 'none' }} />
        <Stack.Screen name="(auth)"       options={{ headerShown: false }} />
        <Stack.Screen name="onboarding"   options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="(tabs)"       options={{ headerShown: false }} />
        <Stack.Screen name="request/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="donor/[id]"   options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="map/live"     options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="chat"         options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="profile/edit" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary boundary="root">
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <SafeAreaProvider>
            <ThemeProvider>
              <AuthProvider>
                <ToastProvider>
                  <RootNavigator />
                </ToastProvider>
              </AuthProvider>
            </ThemeProvider>
          </SafeAreaProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
