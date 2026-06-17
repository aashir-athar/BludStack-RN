// lib/supabase.ts - browser Supabase client. Auth (OTP), realtime subscriptions,
// and public reads go through this; privileged writes go through the backend API.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./blood-data";

// Static export prerenders client modules at build time, so createClient must not
// throw when the public env is absent (createClient rejects an empty url). Fall
// back to a syntactically valid placeholder; the real values are inlined at build
// via NEXT_PUBLIC_* when the deploy secrets exist. Without secrets the site builds
// and loads, but API/auth calls will fail until they are set.
const url = SUPABASE_URL || "https://placeholder.supabase.co";
const anonKey = SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createClient(url, anonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
