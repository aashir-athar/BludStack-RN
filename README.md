# 🩸 BludStack

> **Every drop counts. Every second matters.**

BludStack is a full-stack blood donation platform that connects people in need of blood with nearby eligible donors in real time. When a blood request is posted, the system automatically expands outward in geo-fenced rings — notifying donors 1 km away first, then 5 km, 15 km, 30 km, 50 km, and finally country-wide — until a donor accepts.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Features](#features)
- [Geo-Fencing Algorithm](#geo-fencing-algorithm)
- [Blood Compatibility Logic](#blood-compatibility-logic)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Backend Setup](#backend-setup)
- [Mobile App Setup](#mobile-app-setup)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Cron Jobs](#cron-jobs)
- [Push Notifications](#push-notifications)
- [Security](#security)

---

## Overview

BludStack has two main parts:

- **`backend/`** — A Node.js/Express REST API (`bludstack-backend`) that handles authentication, blood requests, donor matching, donation lifecycle, geo-fencing, push notifications, and statistics.
- **`mobile/`** — A React Native app (`bludstack`) built with Expo SDK 54 and Expo Router, providing the full donor and recipient experience on iOS and Android.

Both parts share Supabase as the database and real-time layer. The backend uses the Supabase **service role** key for privileged operations; the mobile app uses the **anon key** with Supabase Row-Level Security (RLS).

---

## Architecture

```
┌────────────────────────────┐        ┌──────────────────────────────┐
│       Mobile App           │        │        Backend API            │
│  React Native + Expo 54    │◄──────►│  Node.js + Express           │
│  Expo Router (file-based)  │  REST  │  Port 4000                   │
│  Supabase JS (anon key)    │        │  Supabase JS (service role)  │
└────────────┬───────────────┘        └──────────────┬───────────────┘
             │                                        │
             │            ┌───────────────────────────┘
             └───────────►│         Supabase           │
                          │  PostgreSQL + Realtime     │
                          │  Auth (OTP / magic link)   │
                          │  Row-Level Security        │
                          └───────────────────────────┘
```

**Request lifecycle:**
1. Recipient posts a blood request via the mobile app → hits `POST /api/v1/requests`.
2. Backend saves the request, then immediately fires `startGeoFencing()` in the background.
3. Geo-fencing service queries all eligible donors, filters by radius ring, and dispatches push notifications via Expo Push Service in batches of 50.
4. Each notified donor appears in `request_responses` with status `pending`.
5. A donor taps the notification, reviews the request, and calls `POST /api/v1/donations/accept`.
6. The geo-fencing expansion is cancelled, the recipient receives a push notification, and both parties can open an in-app real-time chat.
7. Once the donation happens at the hospital, the recipient calls `POST /api/v1/donations/complete`, which increments `total_donations` and records `last_donation_date` on the donor's profile.

---

## Tech Stack

### Backend

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 20 |
| Framework | Express 4 |
| Database client | `@supabase/supabase-js` v2 (service role) |
| Auth | Supabase Auth (JWT verification via `auth.getUser`) |
| Push notifications | `expo-server-sdk` |
| Validation | `express-validator` |
| Security | `helmet`, `cors`, `express-rate-limit` |
| Logging | `morgan` |
| Scheduling | `node-cron` |
| Deployment | Railway (Nixpacks, `railway.json`) |

### Mobile

| Layer | Technology |
|---|---|
| Framework | React Native 0.81.5 |
| Toolchain | Expo SDK 54 |
| Navigation | Expo Router 6 (file-based) + React Navigation |
| Database / Realtime | `@supabase/supabase-js` v2 (anon key + RLS) |
| Maps | `react-native-maps` |
| Notifications | `expo-notifications` + `expo-task-manager` |
| Location | `expo-location` |
| Animations | `react-native-reanimated` 4 |
| Lists | `@shopify/flash-list` |
| Storage | `expo-secure-store`, `@react-native-async-storage/async-storage` |
| Language | TypeScript 5.9 |

---

## Project Structure

```
root/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── authController.js         # GET /me, POST /register, POST /logout
│   │   │   ├── donationController.js     # accept, decline, complete, history
│   │   │   ├── notificationController.js # register token, remove token, test
│   │   │   ├── profileController.js      # get profile, update, location, nearby donors
│   │   │   ├── requestController.js      # CRUD for blood requests
│   │   │   └── statsController.js        # community stats, leaderboard, blood availability
│   │   ├── middleware/
│   │   │   ├── auth.js                   # requireAuth / optionalAuth (JWT via Supabase)
│   │   │   ├── errorHandler.js           # global Express error handler
│   │   │   ├── rateLimiter.js            # global + auth + notification limiters
│   │   │   ├── requestLogger.js          # attaches requestId to each request
│   │   │   └── validate.js              # express-validator result check
│   │   ├── routes/
│   │   │   ├── auth.js                   # /api/v1/auth/*
│   │   │   ├── donations.js              # /api/v1/donations/*
│   │   │   ├── notifications.js          # /api/v1/notifications/*
│   │   │   ├── profiles.js              # /api/v1/profiles/*
│   │   │   ├── requests.js              # /api/v1/requests/*
│   │   │   └── stats.js                  # /api/v1/stats/*
│   │   ├── services/
│   │   │   ├── cronService.js            # scheduled jobs (expire requests, clean tokens)
│   │   │   ├── geoFencingService.js      # ring-by-ring donor notification engine
│   │   │   └── notificationService.js    # Expo push notification helpers
│   │   ├── utils/
│   │   │   ├── geo.js                    # haversine distance, radius filter, blood compat
│   │   │   ├── response.js               # success/error response helpers
│   │   │   └── supabaseAdmin.js          # Supabase service-role client singleton
│   │   └── server.js                     # Express app bootstrap
│   ├── .env.example
│   ├── package.json
│   └── railway.json
│
└── mobile/
    ├── app/
    │   ├── _layout.tsx                   # Root navigator, auth guard, splash screen
    │   ├── (auth)/
    │   │   ├── _layout.tsx               # Auth stack layout
    │   │   └── index.tsx                 # OTP login / sign-up screen
    │   ├── (tabs)/
    │   │   ├── _layout.tsx               # Bottom tab bar
    │   │   ├── index.tsx                 # Home — compatible active requests feed
    │   │   ├── donors.tsx                # Nearby donors map/list
    │   │   ├── history.tsx               # Donation history
    │   │   ├── my-requests.tsx           # Recipient's own requests
    │   │   ├── profile.tsx               # User profile + settings
    │   │   └── request.tsx               # Post a new blood request
    │   ├── donor/[id].tsx                # Donor profile modal
    │   ├── map/live.tsx                  # Live map (donor ↔ hospital tracking)
    │   ├── onboarding.tsx                # First-time profile setup
    │   ├── request/[id].tsx              # Blood request detail modal
    │   └── chat.tsx                      # Real-time donor ↔ recipient messaging
    ├── components/
    │   ├── BloodGroupBadge.tsx
    │   ├── Button.tsx
    │   ├── Card.tsx
    │   ├── CustomAlert.tsx
    │   ├── EmptyState.tsx
    │   ├── Input.tsx
    │   ├── LoadingScreen.tsx
    │   ├── ProfileCard.tsx
    │   ├── PressableScale.tsx
    │   ├── RequestCard.tsx
    │   ├── ScreenHeader.tsx
    │   ├── SelectSheet.tsx
    │   ├── StatsBanner.tsx
    │   ├── ToggleSwitch.tsx
    │   └── UrgencyBanner.tsx
    ├── constants/
    │   ├── BloodData.ts                  # Blood groups, compatibility map, geo config
    │   ├── Colors.ts                     # Design system (dark/light palette)
    │   ├── Typography.ts                 # Font sizes, weights, spacing
    │   └── theme.ts                      # Theme tokens
    ├── contexts/
    │   ├── AuthContext.tsx               # Session, profile, realtime subscription
    │   └── ThemeContext.tsx              # Dark/light mode toggle
    ├── hooks/
    │   ├── useLocation.ts                # GPS location with background tracking
    │   ├── useNotifications.ts           # Expo push token registration
    │   └── useRequests.ts                # Blood request CRUD + realtime updates
    └── package.json
```

---

## Features

### For Donors
- **Compatible request feed** — Home screen shows only blood requests that match the donor's blood group (based on full compatibility table, not just exact match).
- **One-tap accept** — Accept a request directly from the feed or the detail modal. Includes a 90-day cooldown guard enforced both client-side and server-side.
- **Live map** — After accepting, both donor and recipient see each other's location on a live map with a drawn polyline route and estimated drive time.
- **In-app chat** — Real-time messaging between donor and recipient tied to a specific request (Supabase Realtime).
- **Donation history** — Full log of accepted, completed, and declined requests.
- **Availability toggle** — Donors can pause their availability at any time from the profile screen.

### For Recipients
- **Post a blood request** — Specify blood group, urgency level (critical / urgent / standard), hospital name and address, GPS coordinates, units needed, and optional notes.
- **Urgency levels:**
  - 🚨 **Critical** — expires after 2 hours
  - ⚠️ **Urgent** — expires after 6 hours
  - 🩸 **Standard** — expires after 24 hours
- **Manage requests** — View, cancel, or mark requests as fulfilled from the My Requests tab.
- **Mark donation complete** — Once the donor arrives and donates, the recipient confirms completion, which updates the donor's total donation count and last donation date.
- **Donor profiles** — View a responding donor's blood group, total donations, verification status, and (optionally) shared medical history.

### Community
- **Nearby donors map** — See available donors near any location, filterable by blood group and radius.
- **Community stats** — Total donors, total donations, active requests across the platform.
- **Leaderboard** — Top donors ranked by total donations.
- **Blood availability** — Count of available donors per blood group.

---

## Geo-Fencing Algorithm

When a blood request is posted, `startGeoFencing()` runs asynchronously and expands outward in concentric rings:

```
Ring 0:  1 km  → immediate (notification on request creation)
Ring 1:  5 km  → +30 seconds
Ring 2: 15 km  → +60 seconds
Ring 3: 30 km  → +90 seconds
Ring 4: 50 km  → +120 seconds
Fallback: country-wide (same country bounding box, never cross-border)
```

The delay between rings is configurable via `GEO_EXPANSION_DELAY_SECONDS` (default: 30 s).

**Eligibility criteria for a donor to be notified:**
- `is_available_to_donate = true`
- Blood group is compatible with the request's required group
- Has a valid Expo push token
- Has known GPS coordinates
- Last donated more than 90 days ago (or never donated)

**De-duplication:** A `Set<donorId>` (`notifiedIds`) ensures each donor is only notified once across all rings.

**Country-wide fallback:** If no donor accepts after all 5 rings are exhausted, the system searches within the request's country (detected from bounding boxes: PK, IN, BD, US, GB, SA, AE, NG, EG, ZA). Cross-border donors are never included.

**Cancellation:** Geo-fencing stops immediately when:
- A donor accepts the request (`cancelGeoFencing(requestId)` called in `acceptRequest`)
- The recipient cancels the request
- The request expires via the cron job

In a multi-instance deployment, `activeJobs` (currently an in-process `Map`) should be replaced with Redis pub/sub.

---

## Blood Compatibility Logic

The platform uses the standard ABO/Rh compatibility table:

| Recipient | Compatible Donors |
|---|---|
| A+ | A+, A−, O+, O− |
| A− | A−, O− |
| B+ | B+, B−, O+, O− |
| B− | B−, O− |
| AB+ | All blood groups (universal recipient) |
| AB− | A−, B−, AB−, O− |
| O+ | O+, O− |
| O− | O− only (universal donor) |

This table is defined identically in both `backend/src/utils/geo.js` (`DONOR_FOR_RECIPIENT`) and `mobile/constants/BloodData.ts` (`DONOR_FOR_RECIPIENT`) to keep client and server in sync.

---

## API Reference

All endpoints are prefixed with `/api/v1`. Every protected endpoint requires a `Bearer <supabase_jwt>` token in the `Authorization` header.

### Health

```
GET  /health
```
Returns service name, version, uptime, and timestamp. No auth required.

---

### Auth — `/api/v1/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/me` | ✅ | Get the authenticated user's profile |
| POST | `/register` | ✅ | Complete first-time profile setup after OTP |
| POST | `/logout` | ✅ | Clear push token and invalidate session |

**POST `/register` body:**
```json
{
  "full_name": "string (2–80 chars, required)",
  "blood_group": "A+|A-|B+|B-|AB+|AB-|O+|O- (required)",
  "gender": "string (optional, max 40)",
  "date_of_birth": "ISO date string (optional)",
  "medical_conditions": ["string"] "(optional array)",
  "share_medical_history": "boolean (default: false)",
  "is_available_to_donate": "boolean (default: true)"
}
```

---

### Profiles — `/api/v1/profiles`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/nearby-donors` | ✅ | List available donors within radius |
| PATCH | `/me` | ✅ | Update own profile fields |
| PATCH | `/me/location` | ✅ | Update GPS coordinates |
| GET | `/:id` | ✅ | Get any user's public profile |

**GET `/nearby-donors` query params:**
```
lat        float  required  -90 to 90
lon        float  required  -180 to 180
radiusKm   float  optional  1–200 (default: 50)
bloodGroup string optional  one of the 8 blood groups
```

---

### Requests — `/api/v1/requests`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/my` | ✅ | List the authenticated user's own requests |
| GET | `/` | ✅ | List active requests (filterable) |
| POST | `/` | ✅ | Create a new blood request |
| GET | `/:id` | ✅ | Get request detail with responses |
| PATCH | `/:id/status` | ✅ | Update status (cancelled / fulfilled) |
| DELETE | `/:id` | ✅ | Hard-delete a cancelled or expired request |

**POST `/` body:**
```json
{
  "blood_group": "A+ (required)",
  "urgency": "critical|urgent|standard (default: urgent)",
  "units_needed": "integer 1–20 (default: 1)",
  "hospital_name": "string 2–200 chars (required)",
  "hospital_address": "string 5–400 chars (required)",
  "latitude": "float -90 to 90 (required)",
  "longitude": "float -180 to 180 (required)",
  "notes": "string max 1000 chars (optional)"
}
```

**GET `/` query params:**
```
lat        float  optional  Filter by proximity
lon        float  optional  Filter by proximity
radiusKm   float  optional  1–200 (default: 50)
bloodGroup string optional
urgency    string optional  critical|urgent|standard
page       int    optional  default: 1
limit      int    optional  1–50 (default: 20)
```

---

### Donations — `/api/v1/donations`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/history` | ✅ | Donor's donation history |
| POST | `/accept` | ✅ | Donor accepts a request |
| POST | `/decline` | ✅ | Donor declines a request |
| POST | `/complete` | ✅ | Recipient marks a donation complete |

**POST `/accept` body:**
```json
{ "requestId": "uuid" }
```

**POST `/complete` body:**
```json
{
  "requestId": "uuid",
  "donorId": "uuid"
}
```

Validations enforced by `acceptRequest`:
- Request must exist and have `status = 'active'`
- Donor cannot donate to their own request
- Donor must not have donated in the last 90 days
- Donor cannot accept the same request twice
- The request must not already have enough accepted donors (`units_needed` cap)

---

### Notifications — `/api/v1/notifications`

| Method | Path | Auth | Description |
|---|---|---|---|
| PUT | `/token` | ✅ | Register or update Expo push token |
| DELETE | `/token` | ✅ | Remove push token (on logout) |
| POST | `/test` | ✅ | Send a test push notification to self |

---

### Stats — `/api/v1/stats`

All stats endpoints are public (no auth required, optional auth for future personalisation).

| Method | Path | Description |
|---|---|---|
| GET | `/community` | Total donors, donations, active requests |
| GET | `/leaderboard` | Top donors by total_donations |
| GET | `/blood-availability` | Available donor count per blood group |

---

## Database Schema

BludStack uses Supabase (PostgreSQL) with the following core tables:

### `profiles`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | Matches `auth.users.id` |
| `email` | text | |
| `full_name` | text | |
| `phone` | text | |
| `whatsapp_available` | boolean | |
| `blood_group` | text | A+, A−, B+, B−, AB+, AB−, O+, O− |
| `gender` | text | |
| `date_of_birth` | date | |
| `avatar_url` | text | |
| `role` | text | donor / recipient / both |
| `is_available_to_donate` | boolean | |
| `last_donation_date` | timestamptz | |
| `total_donations` | integer | |
| `is_verified` | boolean | |
| `latitude` | float8 | |
| `longitude` | float8 | |
| `address` | text | |
| `medical_conditions` | text[] | |
| `share_medical_history` | boolean | |
| `push_token` | text | Expo push token |
| `created_at` | timestamptz | |

### `blood_requests`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `recipient_id` | uuid (FK → profiles) | |
| `blood_group` | text | |
| `urgency` | text | critical / urgent / standard |
| `units_needed` | integer | |
| `hospital_name` | text | |
| `hospital_address` | text | |
| `latitude` | float8 | |
| `longitude` | float8 | |
| `notes` | text | |
| `status` | text | active / fulfilled / cancelled / expired |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `fulfilled_at` | timestamptz | |

### `request_responses`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `request_id` | uuid (FK → blood_requests) | |
| `donor_id` | uuid (FK → profiles) | |
| `status` | text | pending / accepted / declined / completed |
| `created_at` | timestamptz | |
| Unique constraint | `(request_id, donor_id)` | one response per donor per request |

### `messages`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `sender_id` | uuid (FK → profiles) | |
| `receiver_id` | uuid (FK → profiles) | |
| `request_id` | uuid (FK → blood_requests) | |
| `content` | text | |
| `read` | boolean | |
| `created_at` | timestamptz | |

---

## Backend Setup

### Prerequisites
- Node.js ≥ 20
- A Supabase project with the schema above applied

### Installation

```bash
cd backend
npm install
```

### Configuration

```bash
cp .env.example .env
# Fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
```

### Running Locally

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The server starts on `http://localhost:4000` by default. Visit `http://localhost:4000/health` to confirm it's running.

---

## Mobile App Setup

### Prerequisites
- Node.js ≥ 18
- Expo CLI (`npm install -g expo-cli`) or use `npx expo`
- iOS: Xcode 15+ / macOS
- Android: Android Studio with an emulator, or a physical device

### Installation

```bash
cd mobile
npm install
```

### Configuration

Create a `.env` file (or set environment variables) in the `mobile/` directory:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EXPO_PUBLIC_API_URL=http://localhost:4000
```

> ⚠️ Never use the Supabase service role key in the mobile app. Always use the anon key with RLS.

### Running

```bash
# Start Expo dev server
npm start

# Open on iOS simulator
npm run ios

# Open on Android emulator
npm run android

# Open in browser (limited functionality)
npm run web
```

### Push Notifications

Push notifications use Expo's push service. To receive notifications on a physical device:
1. Build a development client: `npx expo run:ios` or `npx expo run:android`
2. The app registers for push permissions on first launch and saves the Expo push token to the backend via `PUT /api/v1/notifications/token`.

> Push notifications do **not** work in the Expo Go app for background delivery. A development build or production build is required.

---

## Environment Variables

### Backend (`.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `4000` | HTTP port |
| `NODE_ENV` | No | `development` | `development` or `production` |
| `SUPABASE_URL` | **Yes** | — | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | — | Service role key (never expose publicly) |
| `ALLOWED_ORIGINS` | No | `*` | Comma-separated CORS origins |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` | Rate limit window (15 min) |
| `RATE_LIMIT_MAX` | No | `100` | Max requests per window |
| `GEO_EXPANSION_DELAY_SECONDS` | No | `30` | Seconds between geo-fence ring expansions |

### Mobile (`.env`)

| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | **Yes** | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Supabase anon key |
| `EXPO_PUBLIC_API_URL` | **Yes** | Backend API base URL |

---

## Deployment

### Backend — Railway

The backend includes a `railway.json` configuration:

```json
{
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "node src/server.js",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 10,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5
  }
}
```

To deploy:
1. Push the `backend/` directory to a GitHub repository.
2. Create a new Railway project and connect the repo.
3. Add the environment variables in the Railway dashboard.
4. Railway will auto-deploy on every push to `main`.

### Mobile — Expo EAS Build

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Build for iOS (TestFlight / App Store)
eas build --platform ios

# Build for Android (Play Store)
eas build --platform android

# Submit to stores
eas submit
```

---

## Cron Jobs

The backend runs three scheduled jobs via `node-cron`:

| Job | Schedule | Description |
|---|---|---|
| `expire-stale-requests` | Every 10 minutes | Marks active requests as `expired` based on urgency window (critical: 2h, urgent: 6h, standard: 24h) |
| `clean-push-tokens` | Sundays at 02:00 UTC | Cleans up invalid/stale Expo push tokens (DeviceNotRegistered are cleaned inline during notification delivery) |
| `health-log` | Every 5 minutes | Logs active geo-fence job count and heap memory usage |

---

## Push Notifications

The platform sends the following push notifications:

| Trigger | Recipient | Content |
|---|---|---|
| New blood request posted | Nearby compatible donors | Blood group needed, urgency, hospital name, distance |
| Geo-fence ring expands | Request owner | Searching X km radius |
| Country-wide fallback activates | Request owner | Nationwide search active |
| Donor accepts request | Request owner | Donor name and blood group |
| Donation marked complete | Donor | Congratulations + new total donation count |
| Test | Self | Test push notification |

Push tokens are managed as follows:
- Registered on app launch via `PUT /api/v1/notifications/token`.
- Cleared on logout via `POST /api/v1/auth/logout`.
- Removed inline when Expo returns `DeviceNotRegistered`.
- Bulk-cleaned weekly by the cron job.

---

## Security

- **Authentication:** All protected routes use `requireAuth` middleware, which calls `supabase.auth.getUser(token)` — tokens are validated by Supabase, not locally.
- **Rate limiting:** Global limiter (100 req / 15 min per IP), stricter limiter on auth routes, and a separate limiter for test notification spam.
- **Helmet:** Sets standard security headers (HSTS, X-Frame-Options, X-Content-Type-Options, etc.).
- **CORS:** Configurable origins; defaults to open (`*`) in development.
- **Input validation:** All request bodies and query parameters are validated with `express-validator` before reaching controllers.
- **Medical history privacy:** A donor's `medical_conditions` array is stripped from responses unless `share_medical_history = true`. Donor GPS coordinates are only exposed to the request owner.
- **Ownership checks:** Status updates and deletions verify `recipient_id === req.userId` before making changes.
- **Service role key:** Only used server-side in the backend. The mobile app exclusively uses the anon key with Supabase RLS policies.
- **Body size limit:** `512 KB` on JSON and URL-encoded bodies to prevent payload-based DoS.

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature`.
3. Commit your changes: `git commit -m 'feat: add your feature'`.
4. Push to the branch: `git push origin feature/your-feature`.
5. Open a Pull Request.

Please run `npm run lint` in both `backend/` and `mobile/` before submitting.

---

## License

This project is private. All rights reserved.
