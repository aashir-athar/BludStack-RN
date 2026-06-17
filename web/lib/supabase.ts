// lib/supabase.ts - browser Supabase client. Auth (OTP), realtime subscriptions,
// and public reads go through this; privileged writes go through the backend API.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./blood-data";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
