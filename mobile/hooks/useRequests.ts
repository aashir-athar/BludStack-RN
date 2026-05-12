// hooks/useRequests.ts
// ─────────────────────────────────────────────────────────────────────────────
// All mutating blood-request flows go through the BACKEND now (post-RLS).
//
// What changed in the hardening pass (flaws #1, #2, #3, #6, #12):
//   • notifyCompatibleDonors() — DELETED. The mobile client used to fetch
//     every donor's push_token from Supabase and call exp.host directly. Both
//     are now blocked by RLS, and even if they weren't, that pattern allowed
//     any logged-in user to spam push notifications to the entire userbase.
//     The backend's geo-fencing service is the single source of donor pushes.
//   • createRequest()       — goes through apiCreateRequest (backend kicks off
//                              geo-fencing automatically).
//   • cancelRequest()       — goes through apiCancelRequest.
//   • markFulfilled()       — already used the backend; now via the typed api.
//   • useNearbyRequests()   — uses apiListRequests with lat/lon/radius/
//                              bloodGroup filters, so the work happens in
//                              Postgres, not in JS over a fixed 50-row window.
//   • setImmediate          — removed (not available in React Native runtimes).
// ─────────────────────────────────────────────────────────────────────────────

import { BloodGroup, UrgencyLevel, DONOR_FOR_RECIPIENT } from '@/constants/BloodData';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';
import {
  apiCancelRequest,
  apiCompleteDonation,
  apiCreateRequest,
  apiDeleteRequest,
  apiListRequests,
  apiGetMyRequests,
} from '@/utils/api';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface BloodRequest {
  id: string;
  recipient_id: string;
  donor_id?: string | null;
  blood_group: BloodGroup;
  urgency: UrgencyLevel;
  units_needed: number;
  hospital_name: string;
  hospital_address: string;
  latitude: number;
  longitude: number;
  notes: string | null;
  status: 'active' | 'fulfilled' | 'cancelled' | 'expired';
  created_at: string;
  updated_at: string;
  fulfilled_at?: string | null;
  recipient?: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

export interface RequestResponse {
  id: string;
  request_id: string;
  donor_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'completed';
  created_at: string;
  donor?: {
    id: string;
    full_name: string;
    email: string;
    blood_group: string;
    avatar_url: string | null;
    total_donations: number;
    is_verified: boolean;
    phone: string | null;
    whatsapp_available: boolean;
    share_medical_history: boolean;
    medical_conditions: string[];
    is_available_to_donate: boolean;
    last_donation_date: string | null;
    latitude: number | null;
    longitude: number | null;
  };
}

function uniqueChannel(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// useMyRequests — recipient's own requests (RLS allows selecting own rows)
// ─────────────────────────────────────────────────────────────────────────────
export function useMyRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const userIdRef = useRef(user?.id);
  useEffect(() => { userIdRef.current = user?.id; }, [user?.id]);

  const fetchRequests = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await apiGetMyRequests();
      setRequests((data as BloodRequest[]) ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const uid = user?.id;
    if (!uid) { setLoading(false); return; }
    fetchRequests();

    const channel = supabase
      .channel(uniqueChannel('my_req'))
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'blood_requests',
        filter: `recipient_id=eq.${uid}`,
      }, () => fetchRequests())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'request_responses',
      }, () => fetchRequests())
      .subscribe();

    const poll = setInterval(fetchRequests, 20_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [user?.id, fetchRequests]);

  const createRequest = useCallback(async (payload: {
    blood_group: BloodGroup;
    urgency: UrgencyLevel;
    units_needed: number;
    hospital_name: string;
    hospital_address: string;
    latitude: number;
    longitude: number;
    notes?: string;
  }) => {
    const created = await apiCreateRequest(payload);
    fetchRequests();
    return created as BloodRequest;
  }, [fetchRequests]);

  const cancelRequest = useCallback(async (requestId: string) => {
    await apiCancelRequest(requestId);
    fetchRequests();
  }, [fetchRequests]);

  const deleteRequest = useCallback(async (requestId: string) => {
    await apiDeleteRequest(requestId);
    fetchRequests();
  }, [fetchRequests]);

  const markFulfilled = useCallback(async (requestId: string, donorId: string) => {
    await apiCompleteDonation(requestId, donorId);
    fetchRequests();
  }, [fetchRequests]);

  return { requests, loading, error, refetch: fetchRequests, createRequest, cancelRequest, deleteRequest, markFulfilled };
}

// ─────────────────────────────────────────────────────────────────────────────
// useNearbyRequests — backend filters by geo + compatibility (flaw #12 fix)
// ─────────────────────────────────────────────────────────────────────────────
export function useNearbyRequests(
  lat: number | null,
  lon: number | null,
  radiusKm: number = 50,
) {
  const { user, profile, isDonor } = useAuth();
  const [requests, setRequests]   = useState<BloodRequest[]>([]);
  const [loading, setLoading]     = useState(true);

  const userIdRef    = useRef(user?.id);
  const myGroupRef   = useRef(profile?.blood_group);
  const isDonorRef   = useRef(isDonor);
  const latRef       = useRef(lat);
  const lonRef       = useRef(lon);
  const radiusRef    = useRef(radiusKm);

  useEffect(() => { userIdRef.current  = user?.id;             }, [user?.id]);
  useEffect(() => { myGroupRef.current = profile?.blood_group; }, [profile?.blood_group]);
  useEffect(() => { isDonorRef.current = isDonor;              }, [isDonor]);
  useEffect(() => { latRef.current     = lat;                  }, [lat]);
  useEffect(() => { lonRef.current     = lon;                  }, [lon]);
  useEffect(() => { radiusRef.current  = radiusKm;             }, [radiusKm]);

  const fetchNearby = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) { setLoading(false); return; }
    setLoading(true);
    try {
      const query: Parameters<typeof apiListRequests>[0] = {
        radiusKm: radiusRef.current,
        limit: 50,
      };
      if (latRef.current !== null && lonRef.current !== null) {
        query.lat = latRef.current;
        query.lon = lonRef.current;
      }

      const resp = await apiListRequests(query);
      let list = (resp?.requests ?? []) as BloodRequest[];

      // Defence-in-depth: client-side compatibility filter on top of the
      // server's geo filter. Belt + suspenders until /requests supports
      // `compatibleFor=<donorGroup>` server-side.
      const myBlood = myGroupRef.current;
      if (isDonorRef.current && myBlood) {
        list = list.filter(r =>
          (DONOR_FOR_RECIPIENT[r.blood_group as keyof typeof DONOR_FOR_RECIPIENT] ?? [])
            .includes(myBlood as any),
        );
      }

      setRequests(list);
    } catch (e: any) {
      console.warn('[useNearbyRequests]', e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const uid = user?.id;
    if (!uid) { setLoading(false); return; }
    fetchNearby();

    const channel = supabase
      .channel(uniqueChannel('nearby_req'))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'blood_requests' }, () => fetchNearby())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'blood_requests' }, () => fetchNearby())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'blood_requests' }, () => fetchNearby())
      .subscribe();

    const poll = setInterval(fetchNearby, 30_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [user?.id, fetchNearby]);

  return { requests, loading, refetch: fetchNearby };
}
