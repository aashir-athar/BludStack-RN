// queries/client.ts
// The shared TanStack Query client + the typed query-key factory. Supabase
// Realtime is the cache-invalidation source (see queries/realtime.ts), so query
// staleTime is short and we lean on invalidation rather than polling.
import { QueryClient } from '@tanstack/react-query';
import { isApiError } from '@/utils/api';
import type { ListRequestsQuery, NearbyDonorsQuery } from '@/utils/api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnReconnect: true,
      // Don't retry 4xx (client/auth errors are deterministic); retry 5xx/network.
      retry: (failureCount, error) => {
        if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: 0 },
  },
});

// ── Query keys ────────────────────────────────────────────────────────────────
export const qk = {
  requests: {
    all: ['requests'] as const,
    list: (q: ListRequestsQuery) => ['requests', 'list', q] as const,
    mine: ['requests', 'mine'] as const,
    detail: (id: string) => ['requests', 'detail', id] as const,
  },
  donations: {
    history: ['donations', 'history'] as const,
  },
  profiles: {
    nearby: (q: NearbyDonorsQuery) => ['profiles', 'nearby', q] as const,
  },
  stats: {
    community: ['stats', 'community'] as const,
    leaderboard: ['stats', 'leaderboard'] as const,
    availability: ['stats', 'availability'] as const,
  },
} as const;
