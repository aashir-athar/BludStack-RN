// queries/stats.ts
// Community stats, leaderboard, blood-availability, and nearby-donor discovery.
import { useQuery } from '@tanstack/react-query';
import {
  apiCommunityStats, apiLeaderboard, apiBloodAvailability, apiNearbyDonors,
  type NearbyDonorsQuery,
} from '@/utils/api';
import { qk } from './client';

export function useCommunityStats() {
  return useQuery({
    queryKey: qk.stats.community,
    queryFn: () => apiCommunityStats(),
    staleTime: 60_000,
  });
}

export function useLeaderboard() {
  return useQuery({
    queryKey: qk.stats.leaderboard,
    queryFn: () => apiLeaderboard(),
    staleTime: 60_000,
  });
}

export function useBloodAvailability() {
  return useQuery({
    queryKey: qk.stats.availability,
    queryFn: () => apiBloodAvailability(),
    staleTime: 60_000,
  });
}

export function useNearbyDonors(query: NearbyDonorsQuery | null) {
  return useQuery({
    queryKey: qk.profiles.nearby(query ?? { lat: 0, lon: 0 }),
    queryFn: () => apiNearbyDonors(query as NearbyDonorsQuery),
    enabled: !!query,
  });
}
