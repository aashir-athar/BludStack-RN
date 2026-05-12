// utils/api.ts
// Centralized API service — calls backend when available, falls back to Supabase directly.
// Backend: https://bludstack-rn-production.up.railway.app

import { supabase } from './supabase';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://bludstack-rn-production.up.railway.app/api/v1';

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

async function backendPost<T>(path: string, body: object): Promise<T | null> {
  try {
    const headers = await getAuthHeader();
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn(`[api] POST ${path} → ${res.status}:`, err?.error ?? res.statusText);
      return null;
    }
    const data = await res.json();
    return data?.data ?? data;
  } catch (e: any) {
    console.warn(`[api] POST ${path} failed:`, e.message);
    return null;
  }
}

async function backendPatch<T>(path: string, body: object): Promise<T | null> {
  try {
    const headers = await getAuthHeader();
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data ?? data;
  } catch (e: any) {
    console.warn(`[api] PATCH ${path} failed:`, e.message);
    return null;
  }
}

// ── POST /requests → triggers geo-fencing on backend ─────────────────────────
export async function apiCreateRequest(payload: {
  blood_group: string; urgency: string; units_needed: number;
  hospital_name: string; hospital_address: string;
  latitude: number; longitude: number; notes?: string;
}) {
  return backendPost('/requests', payload);
}

// ── POST /donations/accept → validates 90-day, sends notifications ─────────────
export async function apiAcceptRequest(requestId: string) {
  return backendPost('/donations/accept', { requestId });
}

// ── POST /donations/decline ───────────────────────────────────────────────────
export async function apiDeclineRequest(requestId: string) {
  return backendPost('/donations/decline', { requestId });
}

// ── POST /donations/complete → updates donor stats in DB ─────────────────────
export async function apiCompleteDonation(requestId: string, donorId: string) {
  return backendPost('/donations/complete', { requestId, donorId });
}

// ── PATCH /profiles/me/location ───────────────────────────────────────────────
export async function apiUpdateLocation(latitude: number, longitude: number) {
  // Try backend first, fall back to direct Supabase
  const result = await backendPatch('/profiles/me/location', { latitude, longitude });
  if (!result) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      await supabase.from('profiles').update({ latitude, longitude }).eq('id', session.user.id);
    }
  }
}

// ── PUT /notifications/token ──────────────────────────────────────────────────
export async function apiRegisterPushToken(token: string) {
  return backendPatch('/notifications/token', { token });
}

export { BACKEND_URL };
