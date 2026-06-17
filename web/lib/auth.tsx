"use client";

// Web auth context - the analogue of the app's authStore. Tracks the Supabase
// session, loads the user's own profile (RLS allows the own-row SELECT), and
// exposes role helpers + sign-out + profile mutation through the backend.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { apiUpdateProfile, type ProfilePatch } from "./api";
import { errorReporter } from "./error-reporter";
import type { UserProfile } from "./types";

interface AuthValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isDonor: boolean;
  isRecipient: boolean;
  onboarded: boolean;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) {
    errorReporter.warn("profile load failed", { message: error.message });
    return null;
  }
  return (data as UserProfile | null) ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadFor = useCallback(async (s: Session | null) => {
    if (s?.user?.id) {
      const p = await fetchProfile(s.user.id);
      setProfile(p);
    } else {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadFor(data.session);
      if (active) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!active) return;
      setSession(s);
      await loadFor(s);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadFor]);

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) setProfile(await fetchProfile(session.user.id));
  }, [session?.user?.id]);

  const updateProfile = useCallback(
    async (patch: ProfilePatch) => {
      const updated = (await apiUpdateProfile(patch)) as UserProfile;
      // The server response is canonical (it may normalise, e.g. role downgrade).
      setProfile((prev) => (prev ? { ...prev, ...updated } : updated));
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const value = useMemo<AuthValue>(() => {
    const role = profile?.role;
    return {
      session,
      user: session?.user ?? null,
      profile,
      loading,
      isDonor: role === "donor" || role === "both",
      isRecipient: role === "recipient" || role === "both",
      onboarded: !!profile?.full_name,
      refreshProfile,
      updateProfile,
      signOut,
    };
  }, [session, profile, loading, refreshProfile, updateProfile, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
