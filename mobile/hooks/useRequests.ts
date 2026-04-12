// hooks/useRequests.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { BloodGroup, UrgencyLevel } from '@/constants/BloodData';

export interface BloodRequest {
  id: string;
  recipient_id: string;
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
    full_name: string;
    email: string;
    blood_group: string;
    avatar_url: string | null;
    total_donations: number;
    is_verified: boolean;
  };
}

// ─────────────────────────────────────────────────────────────
// Helper: generate a guaranteed-unique channel name per mount.
// This is the ONLY way to avoid the "cannot add postgres_changes
// callbacks after subscribe()" error when React / Expo Router
// mounts a component twice (Strict Mode, tab focus, etc.)
// ─────────────────────────────────────────────────────────────
function uniqueChannel(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

// ─────────────────────────────────────────────────────────────
// useMyRequests
// ─────────────────────────────────────────────────────────────
export function useMyRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  // Stable ref so fetch function never changes identity
  const userIdRef = useRef(user?.id);
  useEffect(() => { userIdRef.current = user?.id; }, [user?.id]);

  const fetchRequests = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('blood_requests')
        .select('*')
        .eq('recipient_id', uid)
        .order('created_at', { ascending: false });
      if (err) throw err;
      setRequests((data as BloodRequest[]) ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []); // no deps — stable forever

  useEffect(() => {
    const uid = user?.id;
    if (!uid) { setLoading(false); return; }

    // Fetch immediately
    fetchRequests();

    // Unique name per mount — prevents ANY channel reuse collision
    const channelName = uniqueChannel('my_req');

    // Build the full subscription chain THEN call subscribe — never split
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'blood_requests', filter: `recipient_id=eq.${uid}` },
        () => fetchRequests(),
      )
      .subscribe();

    return () => {
      // removeChannel is more thorough than unsubscribe() alone —
      // it fully clears the channel from the Supabase client registry
      supabase.removeChannel(channel);
    };
  }, [user?.id]); // re-run only when user changes, not on every render

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
    const uid = userIdRef.current;
    if (!uid) throw new Error('Not authenticated');
    const { data, error: err } = await supabase
      .from('blood_requests')
      .insert({ ...payload, recipient_id: uid, status: 'active' })
      .select()
      .single();
    if (err) throw err;
    fetchRequests();
    return data as BloodRequest;
  }, [fetchRequests]);

  const cancelRequest = useCallback(async (requestId: string) => {
    const uid = userIdRef.current;
    if (!uid) return;
    const { error: err } = await supabase
      .from('blood_requests')
      .update({ status: 'cancelled' })
      .eq('id', requestId)
      .eq('recipient_id', uid);
    if (err) throw err;
    fetchRequests();
  }, [fetchRequests]);

  return { requests, loading, error, refetch: fetchRequests, createRequest, cancelRequest };
}

// ─────────────────────────────────────────────────────────────
// useNearbyRequests
// ─────────────────────────────────────────────────────────────
export function useNearbyRequests(lat: number | null, lon: number | null) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [loading, setLoading]   = useState(true);

  const userIdRef = useRef(user?.id);
  useEffect(() => { userIdRef.current = user?.id; }, [user?.id]);

  const fetchNearby = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('blood_requests')
        .select(`*, recipient:profiles!recipient_id (full_name, email, avatar_url)`)
        .eq('status', 'active')
        .neq('recipient_id', uid)
        .order('created_at', { ascending: false })
        .limit(50);
      if (err) throw err;
      setRequests((data as BloodRequest[]) ?? []);
    } catch (e: any) {
      console.warn('[useNearbyRequests]', e.message);
    } finally {
      setLoading(false);
    }
  }, []); // stable

  useEffect(() => {
    const uid = user?.id;
    if (!uid) { setLoading(false); return; }

    fetchNearby();

    const channelName = uniqueChannel('nearby_req');

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'blood_requests' }, () => fetchNearby())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'blood_requests' }, () => fetchNearby())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return { requests, loading, refetch: fetchNearby };
}
