# Zero to deploy

A fresh-clone to running-in-production walkthrough for BludStack. Follow it top to
bottom the first time; after that you only revisit the section you are changing.

Prerequisites: Node 20 (`.nvmrc`), Git, a Supabase project, an Expo account, and -
for device builds - the EAS CLI (`npm i -g eas-cli`). The app icons are already in
`mobile/assets/`, so icon generation is not part of this guide.

---

## 1. Clone and install

```bash
git clone https://github.com/aashir-athar/BludStack.git
cd BludStack

# Mobile
cd mobile && npm ci && cd ..

# Backend
cd backend && npm ci && cd ..

# Root tooling (husky pre-commit guard)
npm ci
```

`npm ci` honours the committed lockfiles and `mobile/.npmrc` (legacy-peer-deps),
so the install is deterministic.

---

## 2. Provision Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run the whole of `supabase_schema.sql`. It is
   idempotent - safe to re-run after edits.
3. Apply any files in `migrations/` that are newer than your last run. The
   `2026-06-16-cooldown-in-rpc.sql` migration moves the 90-day cooldown into the
   `accept_blood_request` RPC; apply it if you provisioned from an older schema.
4. Run `verify_schema.sql` and confirm every row reports `PASS`.
5. Under **Database -> Replication**, confirm the `supabase_realtime` publication
   includes `profiles`, `blood_requests`, `request_responses`, and `messages`
   (the schema adds them automatically).
6. Grab from **Project Settings -> API**: the project URL, the `anon` key, and the
   `service_role` key (server-side only - never ship it to the client).

---

## 3. Configure and run the backend

```bash
cd backend
cp .env.example .env
```

Fill in `.env`:

| Key | Value |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `EXPO_ACCESS_TOKEN` | Expo dashboard -> Access Tokens (for push) |
| `CRON_SECRET` | A long random string (required - cron endpoints fail closed without it) |
| `PORT` | `3000` (local) |

Run it:

```bash
npm run lint     # eslint
npm test         # geo units + supertest boot smoke
npm run dev      # nodemon on http://localhost:3000  (GET /health to verify)
```

Deploy when ready:

- **Railway**: connect the repo, set the same env vars, start command `npm start`.
- **Vercel**: `vercel --prod`. `vercel.json` declares the function and the cron
  schedule; set `CRON_SECRET` and the Supabase vars in the Vercel dashboard.

The geo-fence escalation runs as a node-cron worker locally and via Vercel Cron in
serverless. Each cron endpoint requires the `CRON_SECRET` bearer.

---

## 4. Configure and run the mobile app

```bash
cd mobile
cp .env.example .env
```

Fill in `.env`:

| Key | Value |
|---|---|
| `EXPO_PUBLIC_API_URL` | Your backend URL, including `/api/v1` |
| `EXPO_PUBLIC_SUPABASE_URL` | Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | anon key |

Verify, then run:

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # expo lint
npm test             # jest: blood-compat, geo, zod schemas
npx expo-doctor      # native dependency health
npx expo start       # Expo Go for fast iteration
```

> Push notifications and the persistent background-location service are native
> modules. They do not run in Expo Go - build a development client (next step) to
> exercise the live-map heartbeat and killed-state pushes.

---

## 5. Build with EAS

```bash
# One-time: link the project (writes the EAS projectId into app.json)
eas init

# Development client (push + background location work here)
eas build --profile development --platform android
eas build --profile development --platform ios

# Production
eas build --profile production --platform all
```

`eas.json` defines the `development`, `preview`, and `production` profiles.
Install the dev build on a device and smoke the critical flows:

1. Email OTP sign-in.
2. Onboarding (donor age gate, blood grid).
3. Post a request (map pin, urgency, units).
4. Accept on a second device -> watch the live heartbeat move on `/map/live`.
5. Chat between the two parties.
6. Kill the donor app mid-trip and confirm the foreground-service notification
   keeps the heartbeat alive.
7. Toggle dark / light and confirm contrast.

---

## 6. Submit to the stores

```bash
eas submit --platform android --latest
eas submit --platform ios --latest
```

Push over-the-air updates for JS-only changes:

```bash
eas update --branch production --message "copy + layout tweaks"
```

---

## 7. CI/CD (GitHub Actions)

The workflows in `.github/workflows/` run automatically on push / PR:

- **mobile-ci** - typecheck, lint, jest, expo-doctor, Metro export.
- **backend-ci** - lint + jest.
- **schema-check** - applies the schema against Postgres and runs `verify_schema.sql`.
- **eas-build** - owner-triggered (tag `v*` or manual). Add an `EXPO_TOKEN` repo
  secret (Settings -> Secrets -> Actions) before using it.

---

## Owner action items checklist

- [ ] Apply `supabase_schema.sql` (+ migrations) in Supabase Studio; `verify_schema.sql` all PASS.
- [ ] Set backend env vars (incl. `CRON_SECRET`) on Railway / Vercel.
- [ ] Set `EXPO_PUBLIC_*` env vars for the mobile build.
- [ ] Add the `EXPO_TOKEN` GitHub secret for the eas-build workflow.
- [ ] Run the EAS development build and smoke the critical flows on a device.
- [ ] Run the production build + submit.
