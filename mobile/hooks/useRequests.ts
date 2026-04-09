// hooks/useRequests.ts
import { useState, useEffect, useCallback } from 'react';
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
  // joined
  recipient?: {
    full_name: string;
    phone: string;
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
    phone: string;
    blood_group: string;
    avatar_url: string | null;
    total_donations: number;
    is_verified: boolean;
  };
}

export function useMyRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('blood_requests')
        .select('*')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false });

      if (err) throw err;
      setRequests((data as BloodRequest[]) ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRequests();
    if (!user?.id) return;

    const sub = supabase
      .channel('my_requests')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'blood_requests',
        filter: `recipient_id=eq.${user.id}`,
      }, fetchRequests)
      .subscribe();

    return () => { sub.unsubscribe(); };
  }, [user, fetchRequests]);

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
    if (!user?.id) throw new Error('Not authenticated');
    const { data, error: err } = await supabase
      .from('blood_requests')
      .insert({ ...payload, recipient_id: user.id, status: 'active' })
      .select()
      .single();
    if (err) throw err;
    await fetchRequests();
    return data as BloodRequest;
  }, [user, fetchRequests]);

  const cancelRequest = useCallback(async (requestId: string) => {
    const { error: err } = await supabase
      .from('blood_requests')
      .update({ status: 'cancelled' })
      .eq('id', requestId)
      .eq('recipient_id', user?.id);
    if (err) throw err;
    await fetchRequests();
  }, [user, fetchRequests]);

  return { requests, loading, error, refetch: fetchRequests, createRequest, cancelRequest };
}

export function useNearbyRequests(lat: number | null, lon: number | null) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNearby = useCallback(async () => {
    if (!lat || !lon || !user?.id) return;
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('blood_requests')
        .select(`
          *,
          recipient:profiles!recipient_id (full_name, phone, avatar_url)
        `)
        .eq('status', 'active')
        .neq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (err) throw err;
      setRequests((data as BloodRequest[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, [lat, lon, user]);

  useEffect(() => {
    fetchNearby();
    const sub = supabase
      .channel('nearby_requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blood_requests' }, fetchNearby)
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [fetchNearby]);

  return { requests, loading, refetch: fetchNearby };
}
