// contexts/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  blood_group: string;
  gender: string;
  date_of_birth: string | null;
  avatar_url: string | null;
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

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
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
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();          // maybeSingle → returns null (not error) if row missing

      if (error) {
        // Log but don't crash — RLS might block if profile not yet created
        console.warn('Profile fetch warning:', error.message, error.code);
        return;
      }
      setProfile(data as UserProfile | null);
    } catch (e: any) {
      console.warn('Profile fetch exception:', e?.message);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) await fetchProfile(session.user.id);
  }, [session, fetchProfile]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!session?.user?.id) return;
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', session.user.id);
    if (!error) {
      setProfile((prev) => (prev ? { ...prev, ...updates } : prev));
    } else {
      throw error;
    }
  }, [session]);

  useEffect(() => {
    // Initial session load
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user?.id) {
        fetchProfile(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user?.id) {
        fetchProfile(s.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({ session, user: session?.user ?? null, profile, loading, signOut, refreshProfile, updateProfile }),
    [session, profile, loading, signOut, refreshProfile, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
