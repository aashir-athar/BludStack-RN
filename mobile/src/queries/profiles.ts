// queries/profiles.ts
// A single public profile by id (for the donor detail screen).
import { useQuery } from '@tanstack/react-query';
import { apiGetProfile } from '@/utils/api';

export function useProfileById(id: string | undefined) {
  return useQuery({
    queryKey: ['profiles', 'detail', id ?? ''],
    queryFn: () => apiGetProfile(id as string),
    enabled: !!id,
  });
}
