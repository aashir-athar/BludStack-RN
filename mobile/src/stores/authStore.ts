// stores/authStore.ts
// Identity + session as a Zustand store — replaces AuthContext. Holds the
// Supabase session and the user's own profile, validates a cached session
// against the server on boot, and keeps the profile live via a realtime channel.
// Server data (requests, donations, stats) lives in TanStack Query, not here.
//
//   const { session, profile, loading } = useAuth();
//   const isDonor = useIsDonor();
//   useAuthStore.getState().signOut();
//   // Call initAuth() once at the app root; it returns a cleanup fn.
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase';
import { apiUpdateProfile, type ProfilePatch } from '@/utils/api';
import { errorReporter } from '@/lib/errorReporter';

// Re-exported from the shared pure helper so existing `@/stores/authStore`
// importers keep working.
export { computeAge, canDonateByAge } from '@/utils/age';

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

interface AuthState {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
}
interface AuthActions {
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}
export type AuthStore = AuthState & AuthActions;

function normaliseProfile(data: unknown): UserProfile | null {
  if (!data || typeof data !== 'object') return null;
  const p = data as UserProfile;
  if (!Array.isArray(p.medical_conditions)) p.medical_conditions = [];
  if (!p.role) p.role = 'donor';
  return p;
}

async function fetchProfileInto(userId: string): Promise<void> {
  try {
    // RLS: a user can only SELECT their own profile row (full columns).
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      errorReporter.warn('Profile fetch failed', { action: 'fetchProfile', message: error.message });
      return;
    }
    useAuthStore.setState({ profile: normaliseProfile(data) });
  } catch (e) {
    errorReporter.error(e, { action: 'fetchProfile' });
  }
}

export const useAuthStore = create<AuthStore>()(
  subscribeWithSelector((set, get) => ({
  session: null,
  profile: null,
  loading: true,

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null });
  },

  refreshProfile: async () => {
    const uid = get().session?.user?.id;
    if (uid) await fetchProfileInto(uid);
  },

  // Updates safe profile fields via the backend (PATCH /profiles/me). Server-
  // managed fields are filtered out (RLS rejects them anyway). The server row
  // is the source of truth; we merge the patch first to avoid flicker.
  updateProfile: async (updates) => {
    if (!get().session?.user?.id) return;
    const allowed: (keyof ProfilePatch)[] = [
      'full_name', 'gender', 'date_of_birth', 'avatar_url',
      'blood_group', 'medical_conditions', 'share_medical_history',
      'is_available_to_donate', 'address', 'phone', 'whatsapp_available', 'role',
    ];
    const patch: ProfilePatch = {};
    for (const k of allowed) {
      if (k in updates) {
        (patch as Record<string, unknown>)[k] = (updates as Record<string, unknown>)[k];
      }
    }
    if (Object.keys(patch).length === 0) return;

    const updated = await apiUpdateProfile(patch);
    set((state) => {
      if (!state.profile) return state;
      const merged: UserProfile = { ...state.profile, ...(patch as Partial<UserProfile>) };
      if (updated && typeof updated === 'object') {
        Object.assign(merged, updated as Partial<UserProfile>);
      }
      return { profile: merged };
    });
  },
  })),
);

// ── Bootstrap ─────────────────────────────────────────────────────────────────
// Call ONCE at the app root (returns a cleanup fn). Mirrors the old
// AuthProvider effect: validate cached session, load profile, subscribe to the
// profile realtime channel, and follow auth-state changes.
export function initAuth(): () => void {
  let profileChannel: ReturnType<typeof supabase.channel> | null = null;
  let cancelled = false;

  const subscribeProfile = (userId: string, key: string) => {
    if (profileChannel) supabase.removeChannel(profileChannel);
    profileChannel = supabase
      .channel(key)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}`,
      }, () => { void fetchProfileInto(userId); })
      .subscribe();
  };

  (async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (cancelled) return;

    if (!s?.user?.id) {
      useAuthStore.setState({ session: null, profile: null, loading: false });
      return;
    }

    // Validate the cached session against the server — a stale/expired token or
    // a switched Supabase project must be signed out before any redirect runs.
    const { data: userCheck, error: userErr } = await supabase.auth.getUser();
    if (cancelled) return;

    if (userErr || !userCheck?.user?.id) {
      await supabase.auth.signOut().catch(() => {});
      useAuthStore.setState({ session: null, profile: null, loading: false });
      return;
    }

    useAuthStore.setState({ session: s });
    await fetchProfileInto(s.user.id);
    if (!cancelled) useAuthStore.setState({ loading: false });
    subscribeProfile(s.user.id, `auth_profile_${s.user.id}`);
  })();

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
    useAuthStore.setState({ session: s });
    if (s?.user?.id) {
      void fetchProfileInto(s.user.id);
      subscribeProfile(s.user.id, `auth_profile_${s.user.id}_${s.access_token.slice(-8)}`);
    } else {
      useAuthStore.setState({ profile: null });
      if (profileChannel) { supabase.removeChannel(profileChannel); profileChannel = null; }
    }
  });

  return () => {
    cancelled = true;
    subscription.unsubscribe();
    if (profileChannel) supabase.removeChannel(profileChannel);
  };
}

// ── Selectors ────────────────────────────────────────────────────────────────
export const useSession = () => useAuthStore((s) => s.session);
export const useProfile = () => useAuthStore((s) => s.profile);
export const useAuthLoading = () => useAuthStore((s) => s.loading);
export const useIsDonor = () =>
  useAuthStore((s) => !!s.profile && (s.profile.role === 'donor' || s.profile.role === 'both'));
export const useIsRecipient = () =>
  useAuthStore((s) => !!s.profile && (s.profile.role === 'recipient' || s.profile.role === 'both'));

// Convenience bundle mirroring the old useAuth() shape.
export const useAuth = () =>
  useAuthStore(
    useShallow((s) => ({
      session: s.session,
      user: s.session?.user ?? null as User | null,
      profile: s.profile,
      loading: s.loading,
      isDonor: !!s.profile && (s.profile.role === 'donor' || s.profile.role === 'both'),
      isRecipient: !!s.profile && (s.profile.role === 'recipient' || s.profile.role === 'both'),
      signOut: s.signOut,
      refreshProfile: s.refreshProfile,
      updateProfile: s.updateProfile,
    })),
  );
