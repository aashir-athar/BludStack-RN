// queries/donations.ts
// Donation history query + accept/decline/complete mutations. Each mutation
// invalidates the request detail, the requests list, history, and stats so the
// recipient + donor views stay consistent without manual refetch.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  apiDonationHistory, apiAcceptRequest, apiDeclineRequest, apiCompleteDonation,
} from '@/utils/api';
import { qk } from './client';

export function useDonationHistory(enabled = true) {
  return useQuery({
    queryKey: qk.donations.history,
    queryFn: () => apiDonationHistory(),
    enabled,
  });
}

export function useAcceptRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => apiAcceptRequest(requestId),
    onSuccess: (_data, requestId) => {
      qc.invalidateQueries({ queryKey: qk.requests.detail(requestId) });
      qc.invalidateQueries({ queryKey: qk.requests.all });
      qc.invalidateQueries({ queryKey: qk.donations.history });
    },
  });
}

export function useDeclineRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => apiDeclineRequest(requestId),
    onSuccess: (_data, requestId) => {
      qc.invalidateQueries({ queryKey: qk.requests.detail(requestId) });
      qc.invalidateQueries({ queryKey: qk.requests.all });
    },
  });
}

export function useCompleteDonation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, donorId }: { requestId: string; donorId: string }) =>
      apiCompleteDonation(requestId, donorId),
    onSuccess: (_data, { requestId }) => {
      qc.invalidateQueries({ queryKey: qk.requests.detail(requestId) });
      qc.invalidateQueries({ queryKey: qk.requests.mine });
      qc.invalidateQueries({ queryKey: qk.donations.history });
      qc.invalidateQueries({ queryKey: qk.stats.community });
    },
  });
}
