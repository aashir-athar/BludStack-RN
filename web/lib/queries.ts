"use client";

// TanStack Query hooks over the backend client - the web analogue of the app's
// queries layer. Views call these; the API client stays the single HTTP surface.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  apiListRequests,
  apiGetRequest,
  apiGetMyRequests,
  apiCreateRequest,
  apiCancelRequest,
  apiDonationHistory,
  apiNearbyDonors,
  apiGetProfile,
  apiAcceptRequest,
  apiDeclineRequest,
  apiCompleteDonation,
  type ListRequestsQuery,
  type CreateRequestPayload,
  type NearbyDonorsQuery,
} from "./api";
import { qk } from "./query-client";
import type { BloodRequest, UserProfile } from "./types";

export function useRequests(query: ListRequestsQuery = {}) {
  return useQuery({
    queryKey: qk.requests(query),
    queryFn: async () => {
      const res = await apiListRequests(query);
      return (res.requests as BloodRequest[]) ?? [];
    },
  });
}

export function useRequest(id: string | undefined) {
  return useQuery({
    queryKey: qk.request(id ?? ""),
    queryFn: () => apiGetRequest(id as string) as Promise<BloodRequest & { responses?: unknown[] }>,
    enabled: !!id,
  });
}

export function useMyRequests() {
  return useQuery({
    queryKey: qk.myRequests(),
    queryFn: () => apiGetMyRequests() as Promise<BloodRequest[]>,
  });
}

export function useDonationHistory() {
  return useQuery({
    queryKey: qk.donations(),
    queryFn: () => apiDonationHistory() as Promise<unknown[]>,
  });
}

export function useNearbyDonors(query: NearbyDonorsQuery | null) {
  return useQuery({
    queryKey: qk.nearbyDonors(query ?? {}),
    queryFn: async () => {
      const res = await apiNearbyDonors(query as NearbyDonorsQuery);
      return { donors: (res.donors as UserProfile[]) ?? [], count: res.count };
    },
    enabled: !!query,
  });
}

export function useProfileById(id: string | undefined) {
  return useQuery({
    queryKey: qk.profile(id ?? ""),
    queryFn: () => apiGetProfile(id as string) as Promise<UserProfile>,
    enabled: !!id,
  });
}

export function useCreateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRequestPayload) => apiCreateRequest(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requests"] });
    },
  });
}

export function useCancelRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiCancelRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requests"] }),
  });
}

export function useAcceptRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => apiAcceptRequest(requestId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requests"] }),
  });
}

export function useDeclineRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => apiDeclineRequest(requestId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requests"] }),
  });
}

export function useCompleteDonation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, donorId }: { requestId: string; donorId: string }) =>
      apiCompleteDonation(requestId, donorId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requests"] }),
  });
}
