// contexts/AuthContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase';
import { apiUpdateProfile, ProfilePatch } from '@/utils/api';

export type UserRole = 'donor' | 'recipient' | 'both';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  whatsapp_available: boolean;
  blood_group: string;
  gender: string;
  date_of_birth: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_available_to_donate: boolean;
  last_donation_date: string | null;
  total_donations: number;
  is_verified: boolean;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  medical_conditions: string[];
  share_medical_history: boolean;
  push_token: string | null;
  created_at: string;
}

export function computeAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function canDonateByAge(dob: string | null): boolean {
  const age = computeAge(dob);
  return age !== null && age >= 18;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isDonor: boolean;
  isRecipient: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      // RLS: a user can only SELECT their own profile row (full columns).
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Profile fetch warning:', error.message);
        return;
      }
      if (data && !Array.isArray(data.medical_conditions)) data.medical_conditions = [];
      if (data && !data.role) data.role = 'donor';
      setProfile(data as UserProfile | null);
    } catch (e: any) {
      console.warn('Profile fetch exception:', e?.message);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) await fetchProfile(session.user.id);
  }, [session, fetchProfile]);

  /**
   * Updates safe profile fields via backend (PATCH /profiles/me).
   * Server-managed fields (push_token, role, total_donations, last_donation_date,
   * is_verified) are filtered out — RLS would reject them anyway.
   */
  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!session?.user?.id) return;
    const patch: ProfilePatch = {};
    const allowed: (keyof ProfilePatch)[] = [
      'full_name', 'gender', 'date_of_birth', 'avatar_url',
      'blood_group', 'medical_conditions', 'share_medical_history',
      'is_available_to_donate', 'address',
      'phone', 'whatsapp_available', 'role',
    ];
    for (const k of allowed) {
      if (k in updates) (patch as any)[k] = (updates as any)[k];
    }
    if (Object.keys(patch).length === 0) return;

    // Use the server-returned row as the source of truth. The backend may
    // normalise (e.g. role downgrade on age fail, trimmed strings). Merging
    // patch into local first prevents flicker if the server response is slow.
    const updated = await apiUpdateProfile(patch);
    setProfile(prev => {
      if (!prev) return prev;
      const merged: UserProfile = { ...prev, ...(patch as Partial<UserProfile>) };
      if (updated && typeof updated === 'object') {
        Object.assign(merged, updated as Partial<UserProfile>);
      }
      return merged;
    });
  }, [session]);

  useEffect(() => {
    let profileChannel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // 1. Read cached session from storage.
    // 2. Validate it against the server with getUser() — if the token is
    //    expired, the user no longer exists, or we switched Supabase projects,
    //    the cached session is bogus and must be signed out before any
    //    redirect runs. This is the actual fix for "not authenticated still
    //    routes to onboarding".
    (async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!s?.user?.id) {
        setSession(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      const { data: userCheck, error: userErr } = await supabase.auth.getUser();
      if (cancelled) return;

      if (userErr || !userCheck?.user?.id) {
        // Cached session is stale — wipe it locally so /(auth) is reachable.
        await supabase.auth.signOut().catch(() => {});
        setSession(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setSession(s);
      await fetchProfile(s.user.id);
      if (!cancelled) setLoading(false);

      profileChannel = supabase
        .channel(`profile_${s.user.id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${s.user.id}`,
        }, () => fetchProfile(s.user.id))
        .subscribe();
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user?.id) {
        fetchProfile(s.user.id);
        if (profileChannel) supabase.removeChannel(profileChannel);
        profileChannel = supabase
          .channel(`profile_${s.user.id}_${Date.now()}`)
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${s.user.id}`,
          }, () => fetchProfile(s.user.id))
          .subscribe();
      } else {
        setProfile(null);
        if (profileChannel) {
          supabase.removeChannel(profileChannel);
          profileChannel = null;
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      if (profileChannel) supabase.removeChannel(profileChannel);
    };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const isDonor     = !!(profile && (profile.role === 'donor'     || profile.role === 'both'));
  const isRecipient = !!(profile && (profile.role === 'recipient' || profile.role === 'both'));

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    profile,
    loading,
    isDonor,
    isRecipient,
    signOut,
    refreshProfile,
    updateProfile,
  }), [session, profile, loading, isDonor, isRecipient, signOut, refreshProfile, updateProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
