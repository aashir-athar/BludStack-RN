// queries/realtime.ts
// Supabase Realtime -> TanStack Query invalidation bridge. Realtime is THE cache-
// invalidation mechanism: instead of polling, we invalidate the affected query
// keys whenever the user's own rows change, and screens reading those queries
// refetch automatically. Every channel is uniquely named and torn down on unmount.
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import { useAuthStore } from '@/stores/authStore';
import { qk } from './client';

/**
 * Mount ONCE near the app root (inside the QueryClientProvider). Invalidates the
 * relevant lists whenever the user's own requests or donor responses change.
 */
export function useRealtimeBridge() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user?.id ?? null);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`rt_bridge_${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'blood_requests', filter: `recipient_id=eq.${userId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: qk.requests.mine });
        qc.invalidateQueries({ queryKey: qk.requests.all });
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'request_responses', filter: `donor_id=eq.${userId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: qk.requests.all });
        qc.invalidateQueries({ queryKey: qk.donations.history });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [qc, userId]);
}

/**
 * Focused per-request realtime — keeps a single request's detail (and its
 * response list) fresh while that screen is mounted.
 */
export function useRequestRealtime(requestId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!requestId) return;
    const channel = supabase
      .channel(`rt_req_${requestId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'request_responses', filter: `request_id=eq.${requestId}`,
      }, () => qc.invalidateQueries({ queryKey: qk.requests.detail(requestId) }))
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'blood_requests', filter: `id=eq.${requestId}`,
      }, () => qc.invalidateQueries({ queryKey: qk.requests.detail(requestId) }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc, requestId]);
}
