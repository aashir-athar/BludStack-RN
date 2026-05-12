# 🩸 BludStack Backend API

Express.js REST API for BludStack — the community blood-donation matching app.

---

## Architecture

```
bludstack-backend/
├── src/
│   ├── server.js                    ← Entry point
│   ├── routes/
│   │   ├── auth.js                  ← POST /register, GET /me, POST /logout
│   │   ├── profiles.js              ← GET/PATCH profile, location, nearby donors
│   │   ├── requests.js              ← CRUD blood requests
│   │   ├── donations.js             ← Accept / decline / complete donations
│   │   ├── notifications.js         ← Push token registration + test
│   │   └── stats.js                 ← Community stats, leaderboard, blood availability
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── profileController.js
│   │   ├── requestController.js
│   │   ├── donationController.js
│   │   ├── notificationController.js
│   │   └── statsController.js
│   ├── middleware/
│   │   ├── auth.js                  ← JWT verification via Supabase
│   │   ├── rateLimiter.js           ← Global + per-endpoint rate limiting
│   │   ├── validate.js              ← express-validator error formatter
│   │   ├── errorHandler.js          ← Global error handler
│   │   └── requestLogger.js         ← Request ID injection
│   ├── services/
│   │   ├── geoFencingService.js     ← Uber-surge ring expansion logic 🔑
│   │   ├── notificationService.js   ← Expo push notification sender
│   │   └── cronService.js           ← Background jobs (expire requests, etc.)
│   └── utils/
│       ├── supabaseAdmin.js         ← Service-role Supabase client
│       ├── geo.js                   ← Haversine + radius filter + compatibility
│       └── response.js              ← Standardised JSON response helpers
├── .env.example
├── Procfile
├── railway.json
└── render.yaml
```

---

## Prerequisites

- Node.js 20+
- A running Supabase project (schema from `../supabase_schema.sql`)
- Supabase **service role** key (NOT the anon key)

---

## Local Development

```bash
cd bludstack-backend

# Install dependencies
npm install

# Copy and fill in env vars
cp .env.example .env
# → Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

# Start with auto-reload
npm run dev

# Or start without nodemon
npm start
```

Server starts on **http://localhost:4000**

Test it:
```bash
curl http://localhost:4000/health
# → { "status": "ok", "service": "bludstack-api", ... }
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: 4000) |
| `NODE_ENV` | No | `development` or `production` |
| `SUPABASE_URL` | ✅ | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key — bypasses RLS. **Keep secret.** |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins (default: `*`) |
| `RATE_LIMIT_WINDOW_MS` | No | Rate limit window in ms (default: 900000 = 15 min) |
| `RATE_LIMIT_MAX` | No | Max requests per window per IP (default: 100) |
| `GEO_EXPANSION_DELAY_SECONDS` | No | Seconds between geo-fence ring expansions (default: 30) |

---

## API Reference

All endpoints are prefixed with `/api/v1`.
Protected endpoints require: `Authorization: Bearer <supabase_access_token>`

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | None | Server health check |

---

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/auth/me` | ✅ | Get your profile |
| POST | `/auth/register` | ✅ | Create profile after first OTP login |
| POST | `/auth/logout` | ✅ | Clear push token + invalidate session |

**POST /auth/register** body:
```json
{
  "full_name": "Muhammad Ali",
  "blood_group": "O+",
  "gender": "Male",
  "medical_conditions": ["Diabetes"],
  "share_medical_history": false,
  "is_available_to_donate": true
}
```

---

### Profiles

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/profiles/:id` | ✅ | Get a user's public profile |
| PATCH | `/profiles/me` | ✅ | Update your profile |
| PATCH | `/profiles/me/location` | ✅ | Update your GPS location |
| GET | `/profiles/nearby-donors` | ✅ | Find available donors near a point |

**GET /profiles/nearby-donors** query params:
```
lat=31.5204&lon=74.3587&radiusKm=10&bloodGroup=O+
```

---

### Blood Requests

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/requests` | ✅ | List active requests (with optional geo filter) |
| POST | `/requests` | ✅ | Post a new blood request → triggers geo-fencing |
| GET | `/requests/my` | ✅ | Your own requests |
| GET | `/requests/:id` | ✅ | Get request detail with responses |
| PATCH | `/requests/:id/status` | ✅ | Cancel or mark fulfilled (recipient only) |
| DELETE | `/requests/:id` | ✅ | Delete a cancelled/expired request |

**POST /requests** body:
```json
{
  "blood_group": "A+",
  "urgency": "critical",
  "units_needed": 2,
  "hospital_name": "Services Hospital",
  "hospital_address": "Jail Road, Lahore",
  "latitude": 31.5558,
  "longitude": 74.3241,
  "notes": "Patient: Ahmed, Ward 3B"
}
```

---

### Donations

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/donations/accept` | ✅ | Donor accepts a request → notifies recipient |
| POST | `/donations/decline` | ✅ | Donor declines a request |
| POST | `/donations/complete` | ✅ | Recipient marks donation done → updates donor stats |
| GET | `/donations/history` | ✅ | Your full donation history as a donor |

**POST /donations/accept** body:
```json
{ "requestId": "uuid-of-request" }
```

**POST /donations/complete** body:
```json
{ "requestId": "uuid-of-request", "donorId": "uuid-of-donor" }
```

---

### Notifications

| Method | Path | Auth | Description |
|---|---|---|---|
| PUT | `/notifications/token` | ✅ | Register Expo push token |
| DELETE | `/notifications/token` | ✅ | Remove push token (opt-out) |
| POST | `/notifications/test` | ✅ | Send yourself a test notification |

**PUT /notifications/token** body:
```json
{ "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" }
```

---

### Stats (public)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/stats/community` | None | Total donations, active donors, lives helped |
| GET | `/stats/leaderboard` | None | Top 10 donors by donation count |
| GET | `/stats/blood-availability` | None | Available donors per blood group with scarcity |

---

## Geo-Fencing Logic

When a blood request is posted, `geoFencingService.startGeoFencing()` runs:

```
POST /requests received
       │
       ▼
Fetch all eligible donors globally (compatible blood group,
       available, has push token, 90-day cooldown passed)
       │
       ▼
Ring 0: notify donors within 1 km → wait 30s
       │
Ring 1: notify NEW donors within 5 km → wait 30s
       │
Ring 2: notify NEW donors within 15 km → wait 30s
       │
Ring 3: notify NEW donors within 30 km → wait 30s
       │
Ring 4: notify NEW donors within 50 km → done
       │
       ▼
(Expansion stops early when a donor accepts → cancelGeoFencing())
```

Each ring only notifies donors not already notified by a previous ring.
Donor response records (`request_responses`) are upserted as `pending` when notified.

---

## Background Jobs (Cron)

| Job | Schedule | Action |
|---|---|---|
| `expire-stale-requests` | Every 10 min | Marks old unfulfilled requests as `expired` |
| `clean-push-tokens` | Sundays 02:00 UTC | Placeholder for stale token cleanup |
| `health-log` | Every 5 min | Logs active geo-fence job count + memory usage |

Expiry windows by urgency:
- `critical` → 2 hours
- `urgent` → 6 hours
- `standard` → 24 hours

---

## Deployment

> **Geo-fence frequency differs by host.**
> - On **Railway / Render / self-hosted** the `startWorker()` in `src/server.js` runs an in-process `setInterval` that ticks every **5 seconds**.
> - On **Vercel** there is no in-process worker (functions are short-lived). The tick logic is exposed as HTTP endpoints (`api/cron/tick-geofence.js`, `api/cron/expire-requests.js`) and **must be triggered by an external scheduler** — Vercel Hobby is daily-only, Pro starts at 1 minute. See the Vercel section below for free schedulers that go down to 1 minute.
> - Rate-limit state is in-memory (express-rate-limit default). On Vercel each cold start has its own bucket — for production-grade rate limiting on Vercel, swap in `rate-limit-redis` with Upstash.

### Option A — Vercel (serverless, $0)

1. Push this folder to a GitHub repo
2. [vercel.com](https://vercel.com) → Add New → Project → import the repo
3. Set the **Root Directory** to `backend/`
4. Set environment variables in Project Settings → Environment Variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NODE_ENV=production`
   - `ALLOWED_ORIGINS=https://your-app-domain.com`
   - `TRUST_PROXY=1`
   - `CRON_SECRET=<generate a long random string>` — used to auth scheduler calls
5. Deploy. `vercel.json` wires up:
   - `/api/v1/*` → Express app (via `api/index.js`)
   - `/health` → Express app
   - `/api/cron/*` → scheduled handlers (called externally, see below)

Your API will be at: `https://<your-project>.vercel.app/api/v1/...`

#### Wiring an external scheduler (free, ≥1-minute interval)

You need two scheduled HTTP GETs:

| Endpoint | Recommended interval | Effect |
|---|---|---|
| `/api/cron/tick-geofence?secret=<CRON_SECRET>` | every 1 min | Drives ring expansion |
| `/api/cron/expire-requests?secret=<CRON_SECRET>` | every 10 min | Marks stale requests expired |

Pick one:

- **cron-job.org** (free, 1-min minimum, simplest)
  1. Sign up → Create cronjob → URL `https://<your-vercel-project>.vercel.app/api/cron/tick-geofence?secret=<CRON_SECRET>` → Schedule "every 1 minute" → Save.
  2. Repeat for `/api/cron/expire-requests` at 10-minute interval.
- **Upstash QStash** (free 500 msg/day, very reliable)
  ```bash
  curl -X POST "https://qstash.upstash.io/v2/schedules/https://<your-vercel-project>.vercel.app/api/cron/tick-geofence" \
    -H "Authorization: Bearer <QSTASH_TOKEN>" \
    -H "Upstash-Cron: */1 * * * *" \
    -H "Upstash-Forward-Authorization: Bearer <CRON_SECRET>"
  ```
- **Supabase pg_cron** (zero extra services, runs inside Postgres)
  ```sql
  -- Once: install + grant
  create extension if not exists pg_cron;
  -- Schedule the tick every minute
  select cron.schedule(
    'bludstack-tick',
    '* * * * *',
    $$ select net.http_get(
         url := 'https://<your-vercel-project>.vercel.app/api/cron/tick-geofence?secret=<CRON_SECRET>'
       ); $$
  );
  ```
  Requires the `pg_net` extension in Supabase (enabled by default on Pro; on Free, Database → Extensions → enable `pg_net`).

> Geo-fence ring delay defaults to **30 s** (`GEO_EXPANSION_DELAY_SECONDS`). On a 1-minute external tick, the effective ring cadence is 60 s — slightly slower than the 30 s on Railway but still responsive.

### Option B — Railway (recommended, free hobby tier)

1. Push this folder to a GitHub repo
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repo / `bludstack-backend` folder
4. Add environment variables in the Railway dashboard:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NODE_ENV=production`
   - `ALLOWED_ORIGINS=https://your-app-domain.com`
5. Railway auto-detects `railway.json` and deploys

Your API will be at: `https://bludstack-api.up.railway.app`

### Option C — Render (free tier with spin-down)

1. Push to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your repo, set root directory to `bludstack-backend`
4. Set environment variables in the Render dashboard
5. Deploy

> **Note:** Render free tier spins down after 15 min of inactivity. First request after spin-down takes ~30s. Use Railway for always-on free hosting.

### Option D — Self-hosted (VPS / DigitalOcean)

```bash
# On your server
git clone your-repo && cd bludstack-backend
npm install --production
cp .env.example .env && nano .env   # fill in values

# Install PM2 for process management
npm install -g pm2
pm2 start src/server.js --name bludstack-api
pm2 save
pm2 startup
```

---

## Connecting the Frontend

In your Expo app's `.env.local`, add:

```env
EXPO_PUBLIC_API_URL=https://your-backend-url.com/api/v1
```

Then in frontend API calls, pass the Supabase access token:

```typescript
const { data: { session } } = await supabase.auth.getSession();

const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/requests`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token}`,
  },
  body: JSON.stringify({ blood_group: 'O+', ... }),
});
```

---

## Security Notes

- The `SUPABASE_SERVICE_ROLE_KEY` bypasses all Row Level Security — **never** expose it to clients
- All mutating endpoints require a valid Supabase JWT
- Rate limiting is applied globally (100 req/15 min) and strictly on auth endpoints (10 req/15 min)
- Medical history is masked in all responses unless `share_medical_history = true`
- Exact GPS coordinates are never returned to arbitrary callers — only to matched parties
