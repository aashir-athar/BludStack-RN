// utils/api.ts
// ─────────────────────────────────────────────────────────────────────────────
// Centralised backend client.
//
// After the production-hardening pass, the mobile app is FORBIDDEN from doing
// these things directly against Supabase (RLS will reject them):
//   • Reading or writing other users' push_token, latitude, longitude
//   • Inserting into blood_requests
//   • Inserting / updating request_responses
//   • Mutating its own total_donations, last_donation_date, role, is_verified
// All of those operations now go through the backend API, which uses the
// service_role key and runs server-side validation + atomic RPCs.
//
// Mobile still uses Supabase directly for:
//   • Auth (signInWithOtp, verifyOtp, getSession)
//   • Realtime subscriptions on its OWN profile + own blood_requests + own
//     request_responses (RLS allows the SELECTs)
//   • Reading public_profiles view for leaderboards
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase';

export const BACKEND_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://bludstack-rn-production.up.railway.app/api/v1';

// We deliberately do NOT extend Error here. React Native / Hermes has a long-
// standing Babel `wrapNativeSuper` bug that breaks `class X extends Error` at
// construction time. Using a plain class with a discriminator avoids it.
export class ApiError {
  readonly isApiError = true as const;
  readonly name = 'ApiError';
  readonly message: string;
  readonly status: number;
  readonly data?: unknown;
  constructor(message: string, status: number, data?: unknown) {
    this.message = message;
    this.status  = status;
    this.data    = data;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return !!err && typeof err === 'object' && (err as ApiError).isApiError === true;
}

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

type RequestOpts = { signal?: AbortSignal };

// The backend wraps successful responses as { success, data, message } and errors
// as { error } / { message }. Some endpoints return the payload directly, so every
// field is optional and the unwrap below handles both shapes.
type ResponseEnvelope = { data?: unknown; error?: string; message?: string };

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: object,
  opts: RequestOpts = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await authHeader()),
  };

  const res = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: opts.signal,
  });

  let json: ResponseEnvelope | null = null;
  try { json = (await res.json()) as ResponseEnvelope; } catch { /* empty body */ }

  if (!res.ok) {
    const message = json?.error ?? json?.message ?? `Request failed (${res.status})`;
    throw new ApiError(message, res.status, json);
  }

  // Backend wraps successful responses as { success: true, data, message }.
  // Some endpoints return data directly - handle both.
  return (json?.data ?? json) as T;
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export const apiGetMe = () => request<unknown>('GET', '/auth/me');

export type RegisterPayload = {
  full_name: string;
  blood_group: string;
  gender?: string;
  date_of_birth?: string | null;
  phone?: string | null;
  whatsapp_available?: boolean;
  medical_conditions?: string[];
  share_medical_history?: boolean;
  is_available_to_donate?: boolean;
  role?: 'donor' | 'recipient' | 'both';
};
export const apiRegister = (payload: RegisterPayload) =>
  request<{ profile: unknown; downgraded: boolean }>('POST', '/auth/register', payload);

export const apiLogout = () => request<null>('POST', '/auth/logout');

// ── Profile ──────────────────────────────────────────────────────────────────
export type ProfilePatch = Partial<{
  full_name: string;
  gender: string;
  date_of_birth: string | null;
  avatar_url: string | null;
  blood_group: string;
  medical_conditions: string[];
  share_medical_history: boolean;
  is_available_to_donate: boolean;
  address: string | null;
  phone: string | null;
  whatsapp_available: boolean;
  role: 'donor' | 'recipient' | 'both';
}>;
export const apiUpdateProfile = (patch: ProfilePatch) =>
  request<unknown>('PATCH', '/profiles/me', patch);

export const apiUpdateLocation = (latitude: number, longitude: number) =>
  request<unknown>('PATCH', '/profiles/me/location', { latitude, longitude });

export const apiGetProfile = (id: string) => request<unknown>('GET', `/profiles/${id}`);

export type NearbyDonorsQuery = { lat: number; lon: number; radiusKm?: number; bloodGroup?: string };
export const apiNearbyDonors = (q: NearbyDonorsQuery) => {
  const qs = new URLSearchParams({
    lat: String(q.lat), lon: String(q.lon),
    ...(q.radiusKm   ? { radiusKm:   String(q.radiusKm)  } : {}),
    ...(q.bloodGroup ? { bloodGroup: q.bloodGroup        } : {}),
  });
  return request<{ donors: unknown[]; count: number; radiusKm: number }>('GET', `/profiles/nearby-donors?${qs}`);
};

// ── Blood Requests ───────────────────────────────────────────────────────────
export type CreateRequestPayload = {
  blood_group: string;
  urgency: 'critical' | 'urgent' | 'standard';
  units_needed: number;
  hospital_name: string;
  hospital_address: string;
  latitude: number;
  longitude: number;
  notes?: string;
};
export const apiCreateRequest = (payload: CreateRequestPayload) =>
  request<unknown>('POST', '/requests', payload);

export type ListRequestsQuery = {
  lat?: number; lon?: number; radiusKm?: number;
  bloodGroup?: string; urgency?: string;
  page?: number; limit?: number;
};
export const apiListRequests = (q: ListRequestsQuery = {}) => {
  const qs = new URLSearchParams();
  if (q.lat !== undefined)        qs.set('lat',        String(q.lat));
  if (q.lon !== undefined)        qs.set('lon',        String(q.lon));
  if (q.radiusKm !== undefined)   qs.set('radiusKm',   String(q.radiusKm));
  if (q.bloodGroup)               qs.set('bloodGroup', q.bloodGroup);
  if (q.urgency)                  qs.set('urgency',    q.urgency);
  if (q.page !== undefined)       qs.set('page',       String(q.page));
  if (q.limit !== undefined)      qs.set('limit',      String(q.limit));
  const suffix = qs.toString() ? `?${qs}` : '';
  return request<{ requests: unknown[]; pagination: unknown }>('GET', `/requests${suffix}`);
};

export const apiGetRequest = (id: string) => request<unknown>('GET', `/requests/${id}`);
export const apiGetMyRequests = () => request<unknown[]>('GET', '/requests/my');
export const apiCancelRequest = (id: string) =>
  request<unknown>('PATCH', `/requests/${id}/status`, { status: 'cancelled' });
export const apiDeleteRequest = (id: string) => request<null>('DELETE', `/requests/${id}`);

// ── Donations ────────────────────────────────────────────────────────────────
export const apiAcceptRequest = (requestId: string) =>
  request<{ responseId: string; request: unknown }>('POST', '/donations/accept', { requestId });

export const apiDeclineRequest = (requestId: string) =>
  request<null>('POST', '/donations/decline', { requestId });

export const apiCompleteDonation = (requestId: string, donorId: string) =>
  request<{ requestId: string; donorId: string; totalDonations: number }>(
    'POST', '/donations/complete', { requestId, donorId },
  );

export const apiDonationHistory = () => request<unknown[]>('GET', '/donations/history');

export const apiDonationHeartbeat = (requestId: string, latitude: number, longitude: number) =>
  request<{ ok: true }>('POST', '/donations/heartbeat', { requestId, latitude, longitude });

// ── Notifications ────────────────────────────────────────────────────────────
export const apiRegisterPushToken = (token: string) =>
  request<unknown>('PUT', '/notifications/token', { token });

export const apiRemovePushToken = () =>
  request<null>('DELETE', '/notifications/token');

export const apiSendTestNotification = () =>
  request<unknown>('POST', '/notifications/test', {});

// ── Stats ────────────────────────────────────────────────────────────────────
export const apiCommunityStats   = () => request<unknown>('GET', '/stats/community');
export const apiLeaderboard      = () => request<unknown[]>('GET', '/stats/leaderboard');
export const apiBloodAvailability = () => request<unknown>('GET', '/stats/blood-availability');
