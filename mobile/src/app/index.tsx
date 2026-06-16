// app/index.tsx
// The root entry. Decides the destination BEFORE any other screen mounts,
// so a fresh cold start never accidentally renders /onboarding or /(tabs)
// while the redirect-on-effect is still queued.
//
// Flow mirrored from _layout.tsx (single source of truth):
//   • loading                     → render nothing (splash stays visible)
//   • !session                    → /(auth)
//   • session but no full_name    → /onboarding
//   • fully onboarded (recipient-only) → /(tabs)/request
//   • fully onboarded (donor / both)   → /(tabs)
//
// The /_layout.tsx guard is still there as a defence-in-depth for later
// navigation hops; this file just owns the very first paint.

import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function RootIndex() {
  const { loading, session, profile, isDonor, isRecipient } = useAuth();

  if (loading) return null;

  if (!session?.user?.id) return <Redirect href="/(auth)" />;
  if (!profile?.full_name) return <Redirect href="/onboarding" />;

  if (isRecipient && !isDonor) return <Redirect href="/(tabs)/request" />;
  return <Redirect href="/(tabs)" />;
}
