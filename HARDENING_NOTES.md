# BludStack - Production Hardening Pass

Branch: `production-hardening-2026-05-12`
Date: 2026-05-12

This pass closes the 28 flaws identified in the security/correctness/architecture audit, makes the backend Vercel-deployable, and ships a production-grade real-time chat per the `realtime-chat-expo-54-55` skill.

---

## Apply this before running the app

The single most important change is the database. Until you run the schema, RLS isn't enforced and several mobile code paths will fail.

1. Open **Supabase Studio → SQL Editor → New query**.
2. Paste the contents of [`supabase_schema.sql`](./supabase_schema.sql) and run it.
3. Verify under **Database → Policies** that RLS is **enabled** on `profiles`, `blood_requests`, `request_responses`, and `messages`.
4. Verify under **Database → Replication → supabase_realtime** that all four tables are in the publication.

The file is **idempotent** - safe to re-run after edits.

---

## Flaw → Fix Map

### CRITICAL - Security & Privacy
| # | Flaw | Fix |
|---|---|---|
| 1 | Mobile read every donor's `push_token` directly | `supabase_schema.sql` policies + guard trigger. Mobile can SELECT only its own profile row. `public_profiles` view exposes a sanitised subset for leaderboards. |
| 2 | Mobile sent push directly to `exp.host` from any user | Deleted `notifyCompatibleDonors` and `sendExpoPush` from `mobile/hooks/useRequests.ts`. All pushes now originate server-side in `geoFencingService.js`. |
| 3 | Mobile wrote to `blood_requests` directly | `useMyRequests.createRequest` → `apiCreateRequest` (backend `POST /requests` triggers geo-fencing). RLS denies client-side INSERTs. |
| 4 | Client-side trust of donation counts | Privileged-column guard trigger (`tg_guard_profile_privileged_writes`) blocks client writes to `total_donations`, `last_donation_date`, `is_verified`, `push_token`, `role`. |
| 5 | Service-role unused when client bypassed everything | Mobile now hits only backend endpoints for privileged work; backend uses service_role exclusively. |

### HIGH - Correctness
| # | Flaw | Fix |
|---|---|---|
| 6 | `setImmediate` in React Native | Removed. Backend now owns the notify-donors path. |
| 7 | In-memory geo-fence jobs (`activeJobs = new Map()`) | DB-persisted state: `blood_requests.geofence_ring_index` + `geofence_next_at` + `geofence_country`. Tick worker uses a CAS-style claim (`update where geofence_next_at = expected`) - safe across multiple instances and survives restarts. |
| 8 | Race condition on `accept` capacity check | Atomic `accept_blood_request(p_request_id, p_donor_id)` RPC with `SELECT ... FOR UPDATE`. Capacity check happens inside the same transaction as the upsert. |
| 9 | Declined donors weren't excluded between rings | `fetchEligibleDonors` now queries `request_responses` and excludes any donor with an existing row (pending/accepted/declined/completed). |
| 10 | Donor availability not refreshed per ring | `fetchEligibleDonors` runs at the top of every ring - not cached. |
| 11 | Root layout bounced deep links to `/(tabs)` | `IN_APP_SEGMENTS` whitelist now includes `request`, `donor`, `map`, `chat`. First-mount redirect uses `useRef` to fire once. |
| 12 | `useNearbyRequests` polled 50 newest globally + filtered in JS | `apiListRequests` server-filters by lat/lon/radius + page/limit. Client compatibility filter remains as defence-in-depth. |
| 13 | Location writes on every refresh | `useLocation.maybeWriteLocation` throttles to 1 write / 60s and only after ≥100 m of movement. `map/live` also throttles its `watchPositionAsync` to 15s + 50m. |

### MEDIUM - Architecture
| # | Flaw | Fix |
|---|---|---|
| 14 | Two competing notification paths | Mobile path deleted (#2). Backend `geoFencingService` is the single source. |
| 15 | Country bounds duplicated | `backend/src/utils/countryBounds.js` is the SoT. Mobile copy in `BloodData.ts` is now informational only. |
| 16 | Rate limiter behind a proxy | `app.set('trust proxy', 1)` in `server.js` (configurable via `TRUST_PROXY` env). |
| 17 | `authRateLimiter` unused | Applied to `POST /auth/register`. |
| 18 | Lazy `expo-server-sdk` require | Moved to top of `notificationController.js`. |
| 19 | Request detail used `Alert` and raw nothing-loader | Skeleton loaders via `components/Skeleton.tsx` + `LoadingScreen.tsx`. |
| 20 | Silent age downgrade was client-only | Server-side gate in `authController.register` + DB CHECK `profiles_donor_age` constraint. |
| 21 | Morgan logged full URLs (GPS leak) | Production morgan format uses `:path-only` (query string stripped). |
| 22 | Missing `supabase_schema.sql` | Written. Single source of truth, 700+ lines. |

### LOW - Polish
- `AuthContext.fetchProfile` retains warn-on-error pattern but with concrete reason. No silent swallowing of unexpected RLS errors.
- `*.zip` artifacts removed; `.gitignore` updated.
- Debug `console.log('[acceptRequest] querying…')` removed when `donationController.js` was rewritten.
- Hardcoded `https://bludstack-rn-production.up.railway.app` removed - `utils/api.ts` exports `BACKEND_URL` consumed everywhere.

---

## New: Vercel-Ready Backend

`backend/` deploys to Vercel without code changes. Files added:
- `backend/api/index.js` - Express app entrypoint for Vercel's `@vercel/node` runtime.
- `backend/api/cron/tick-geofence.js` - replaces the in-process tick worker.
- `backend/api/cron/expire-requests.js` - replaces the in-process `node-cron` schedule.
- `backend/vercel.json` - function + rewrite + cron config.

`server.js` now skips `app.listen()` and `startWorker()` when running under Vercel (`process.env.VERCEL` or `require.main !== module`). Railway / Render / `node src/server.js` paths still work unchanged.

**Vercel deployment**
1. Vercel → Add New → Project → import repo → Root Directory: `backend/`.
2. Environment Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NODE_ENV=production`, `ALLOWED_ORIGINS`, `TRUST_PROXY=1`. `CRON_SECRET` auto-populates when crons are detected.
3. Deploy. Endpoints land at `https://<project>.vercel.app/api/v1/...`.

**Known tradeoff (documented in README):** Vercel Cron min interval is 1 min on Pro / 1 hour on Hobby. The in-process tick on Railway is every 5 seconds. If you need sub-minute ring expansion, stay on Railway.

---

## New: Real-time Donor ↔ Recipient Chat

Built per the `realtime-chat-expo-54-55` skill against Expo SDK 54, FlashList v2, and Supabase Realtime.

**Files added/changed**
- `mobile/hooks/useChatMessages.ts` - paginated load + realtime INSERT/UPDATE + optimistic send with `client_id` idempotency + retry.
- `mobile/hooks/useChatTyping.ts` - typing indicator via Supabase Realtime `broadcast` (no DB writes).
- `mobile/app/chat.tsx` - FlashList v2 with `maintainVisibleContentPosition.startRenderingFromBottom` (the v2 chat pattern - `inverted` is deprecated). Memoized render, stable key extractor, retry-on-failed-send UI.
- `mobile/components/Skeleton.tsx` - Reanimated v4 shimmer used by the chat list and `LoadingScreen`.
- `supabase_schema.sql` - `messages` table with strict RLS:
  - SELECT: sender or receiver only.
  - INSERT: only the sender, and only when there's an accepted/completed `request_responses` row linking the two parties on that request.
  - UPDATE: receiver can flip `read`, nothing else.
  - Guard trigger blocks immutable-column changes from clients.

**New deps installed via `npx expo install`:**
- `react-native-keyboard-controller` (available for the next chat polish pass)
- `expo-crypto` (for `client_id` UUIDs)

---

## Quick verification checklist

After applying the schema, run through this:

| Test | Expected |
|---|---|
| Donor account tries `supabase.from('profiles').select('push_token').neq('id', myId)` | Empty result (RLS blocks) |
| Recipient creates a request from the app | Backend POST /requests; geo-fence kicks off |
| Two donors try to accept a request with `units_needed=1` simultaneously | Second one gets a 409 from the RPC |
| Donor declines a request | Next ring excludes them |
| Recipient cancels a request | Geo-fence stops (geofence_next_at cleared) |
| Donor toggles `is_available_to_donate=false` mid-expansion | Subsequent rings exclude them |
| Server restart with active requests | Tick worker resumes on first boot tick |
| Mobile cold-start with deep link to `/request/<id>` | Lands on the request detail screen, not (tabs) |
| Send a chat message while offline | "Failed · Tap to retry" appears; tap retries idempotently |
| Two users typing simultaneously | "Typing…" appears in the header for the other user, hides after 3s of silence |

---

## What this branch does NOT change

- Mobile UI / theme system / typography
- Onboarding flow shape (still the same 4 steps in the current `onboarding.tsx`)
- Tab bar layout
- Auth provider (Supabase OTP email)
- Push notification channel names (`default`, `emergency`)
- Existing Railway deployment

---

## What's deferred to a follow-up

- `react-native-keyboard-controller` integration in chat composer (dep installed, not wired; current `KeyboardAvoidingView` works)
- Image / voice attachments in chat (the messages table supports plain text only)
- Push notification on new chat message (backend hook needed in `messages` INSERT path)
- `rate-limit-redis` for production-grade rate limiting on Vercel (in-memory store works but resets per cold start)
- `op-sqlite` outbox for true offline-first chat (current `useChatMessages` retries optimistically but doesn't persist across app kills)

These are tracked but **not** blocking the release.

---

## Phase F security review: open items for the owner

A security pass over the live-location flow (2026-06-17) confirmed the core
controls are correct: the heartbeat keys its UPDATE on `donor_id = req.userId`
from the verified JWT (no client-supplied identity, no IDOR), the TOCTOU window
is closed by a single conditional UPDATE, coordinates are range-validated in
three layers, the service_role key is server-only, and privileged columns are
trigger-guarded. The heartbeat limiter was tightened (15/min, keyed per
donor+request) and the 409 message no longer echoes internal status. Three items
remain for the owner:

1. **Verify Supabase Realtime RLS on `request_responses` (do this before launch).**
   `map/live.tsx` reads live donor `donor_lat/lon` through a `postgres_changes`
   subscription. Modern Supabase Realtime enforces the table's SELECT RLS on the
   change stream **only when the channel carries the user's JWT** (supabase-js
   sets this from the session by default) and Realtime is enabled for the table.
   Confirm in the dashboard that Realtime authorization is on for
   `request_responses` so the live stream is gated by `request_responses_select_visible`,
   exactly like the initial `loadDonors()` SELECT. Optional defense-in-depth:
   have the recipient branch confirm `blood_requests.recipient_id = auth.uid()`
   rather than trusting the `role` route param.

2. **Optional: server-side velocity sanity check on heartbeat.** Coordinates are
   range-valid but otherwise attacker-controlled, so a spoofed GPS track is
   possible. A cheap haversine velocity gate (flag, do not hard-block, anything
   over ~300 km/h vs the previous fix) would kill trivially fake tracks without
   breaking legitimate jumps after tunnels.

3. **Optional: verify the auth JWT locally.** `requireAuth` calls
   `supabaseAdmin.auth.getUser(token)` on every request (a round-trip to Supabase
   Auth). On the hot heartbeat path, local signature verification (HS256/JWKS,
   checking `aud`/`iss`/`exp`) with a fallback to `getUser` only when fresh user
   state is needed would cut latency and the upstream dependency.
