# BludStack Web

The web companion to the BludStack mobile app - the same blood-donation network,
the same backend, the same design language, in the browser. It is a fully
client-rendered SPA: email OTP sign-in, onboarding, the request feed, posting a
request on a map, accepting and completing donations, a live tracking map,
realtime chat, donor profiles, and the reputation program.

## Stack

- Next.js 16 (App Router, React 19) - static export, no server runtime
- Tailwind CSS v4 with the app's exact palette (crimson / onyx / bone)
- TanStack Query + react-hook-form + zod (ported from the app)
- Supabase JS (auth, realtime) + the shared Express backend over fetch
- MapLibre GL JS over free OpenStreetMap / CARTO tiles (no Google Maps, no key)
- lucide-react icons and the real blood-drop logo (no emojis anywhere)

## Setup

```bash
npm ci
cp .env.example .env.local
# Fill in the same Supabase project + backend the mobile app uses:
#   NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
```

## Develop

```bash
npm run dev      # http://localhost:3000
```

If you ever see a Turbopack "React Client Manifest" error, it is a stale build
cache: stop the dev server, `rm -rf .next`, and start it again.

## Build

```bash
npm run build    # static export to ./out
```

The whole app prerenders to static HTML. There are no dynamic server routes: the
detail screens use query params (`/request?id=...`, `/donor?id=...`,
`/map?id=...&role=...`, `/chat?id=...&with=...`) so a static host can serve any id.

## Deploy to GitHub Pages

A workflow is included at `.github/workflows/deploy-web-pages.yml`.

1. In the repo: Settings -> Pages -> Source = "GitHub Actions".
2. Settings -> Secrets and variables -> Actions, add:
   `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Push to `master` (or run the workflow manually). It builds `web/` and publishes
   `out/` to Pages.

The workflow sets `NEXT_PUBLIC_BASE_PATH=/BludStack` because GitHub project pages
serve under `https://<user>.github.io/<repo>`. For a custom domain or a
`<user>.github.io` repo, set that to an empty string.

## Structure

```
web/
├── app/
│   ├── page.tsx              # marketing landing
│   ├── signin/ onboarding/   # auth + profile setup
│   ├── (app)/                # the authed app (guarded, responsive shell)
│   │   ├── feed/ post/ donors/ my-requests/ history/ profile/ profile/edit/
│   │   ├── request/ donor/   # detail screens (read id from query string)
│   │   ├── map/ chat/        # live tracking + realtime chat
│   │   ├── layout.tsx        # auth guard + top nav + mobile bottom tabs
│   │   └── loading.tsx       # skeleton route loading
│   ├── global-error.tsx not-found.tsx  # branded error states
│   └── globals.css           # design tokens (ported from the app palette)
├── components/               # brand, nav, footer, UI kit, map, cards
├── lib/                      # supabase, api, schemas, blood-data, geo, age,
│                             # reputation, auth, toast, queries (ported)
└── public/logo.png           # the real blood-drop logo
```
