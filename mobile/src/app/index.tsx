// Root entry. Decides the destination before any other screen mounts, so a cold
// start never flashes the wrong screen while the redirect effect queues. Mirrors
// the _layout flow, which is the defence-in-depth guard for later hops.
import { Redirect } from 'expo-router';
import { useAuth } from '@/stores/authStore';

export default function RootIndex() {
  const { loading, session, profile, isDonor, isRecipient } = useAuth();

  if (loading) return null;
  if (!session?.user?.id) return <Redirect href="/(auth)" />;
  if (!profile?.full_name) return <Redirect href="/onboarding" />;
  if (isRecipient && !isDonor) return <Redirect href="/(tabs)/request" />;
  return <Redirect href="/(tabs)" />;
}
