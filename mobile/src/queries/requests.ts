// queries/requests.ts
// Blood-request queries + mutations. Return types inherit from utils/api.ts
// (no new `any`); Phase D tightens domain types where the UI consumes them.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  apiListRequests, apiGetRequest, apiGetMyRequests, apiCreateRequest,
  apiCancelRequest, apiDeleteRequest,
  type ListRequestsQuery, type CreateRequestPayload,
} from '@/utils/api';
import { qk } from './client';

export function useRequests(query: ListRequestsQuery = {}, enabled = true) {
  return useQuery({
    queryKey: qk.requests.list(query),
    queryFn: () => apiListRequests(query),
    enabled,
  });
}

export function useRequest(id: string | undefined) {
  return useQuery({
    queryKey: qk.requests.detail(id ?? ''),
    queryFn: () => apiGetRequest(id as string),
    enabled: !!id,
  });
}

export function useMyRequests(enabled = true) {
  return useQuery({
    queryKey: qk.requests.mine,
    queryFn: () => apiGetMyRequests(),
    enabled,
  });
}

export function useCreateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRequestPayload) => apiCreateRequest(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.requests.mine });
      qc.invalidateQueries({ queryKey: qk.requests.all });
    },
  });
}

export function useCancelRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiCancelRequest(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: qk.requests.mine });
      qc.invalidateQueries({ queryKey: qk.requests.detail(id) });
    },
  });
}

export function useDeleteRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDeleteRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.requests.mine }),
  });
}
