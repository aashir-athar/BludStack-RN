"use client";

import { QueryClient } from "@tanstack/react-query";

// One client per browser session. staleTime keeps the feed from refetching on
// every focus; realtime subscriptions drive invalidation where freshness matters.
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

// Query key factory - mirrors the app's keys so the mental model is shared.
export const qk = {
  requests: (q?: unknown) => ["requests", "list", q ?? {}] as const,
  request: (id: string) => ["requests", "detail", id] as const,
  myRequests: () => ["requests", "mine"] as const,
  donations: () => ["donations", "history"] as const,
  nearbyDonors: (q?: unknown) => ["donors", "nearby", q ?? {}] as const,
  profile: (id: string) => ["profiles", "detail", id] as const,
  stats: () => ["stats", "community"] as const,
};
