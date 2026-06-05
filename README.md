<div align="center">

<img src="https://raw.githubusercontent.com/aashir-athar/BludStack-RN/master/mobile/assets/images/icon.png" alt="BludStack app icon" width="120" />

# 🩸 BludStack

**The fastest way to find a blood donor — a real-time, geo-fenced blood donation network built with React Native, Expo & Supabase.**

[![Stars](https://img.shields.io/github/stars/aashir-athar/BludStack-RN?style=for-the-badge&logo=github&color=FFD33D)](https://github.com/aashir-athar/BludStack-RN/stargazers)
[![License](https://img.shields.io/github/license/aashir-athar/BludStack-RN?style=for-the-badge&color=blue)](./LICENSE)
[![Last commit](https://img.shields.io/github/last-commit/aashir-athar/BludStack-RN?style=for-the-badge)](https://github.com/aashir-athar/BludStack-RN/commits)
[![Top language](https://img.shields.io/github/languages/top/aashir-athar/BludStack-RN?style=for-the-badge&logo=typescript&logoColor=white)](https://github.com/aashir-athar/BludStack-RN)
[![Repo size](https://img.shields.io/github/repo-size/aashir-athar/BludStack-RN?style=for-the-badge)](https://github.com/aashir-athar/BludStack-RN)

<a href="https://github.com/aashir-athar/BludStack-RN/issues"><strong>🐛 Report Bug</strong></a> ·
<a href="https://github.com/aashir-athar/BludStack-RN/issues"><strong>✨ Request Feature</strong></a> ·
<a href="#-roadmap"><strong>🗺️ Roadmap</strong></a>

</div>

---

**BludStack** is a real-time **blood donation app** for **iOS and Android**, built as a TypeScript monorepo with **React Native, Expo SDK 54, and Supabase**. When a recipient posts a blood request, the backend expands outward in geo-fenced rings — notifying compatible, eligible **donors 1 km away first, then 5 km, 15 km, 30 km, 50 km, and finally country-wide** — until a donor accepts. Think Uber, but for the most important ride of someone's life.

> In emergencies the bottleneck isn't blood supply — it's the **time it takes to reach a compatible donor nearby**. BludStack pages only matching donors, in priority order, in real time.

---

## ✨ Features

| | Feature | Description |
|---|---|---|
| 📡 | **Real-time ring escalation** | Compatible donors in widening geo-rings (1 → 5 → 15 → 30 → 50 km → country-wide) are paged in priority order until the request is filled. |
| 🔒 | **Atomic accept & complete RPCs** | `SECURITY DEFINER` PostgreSQL functions enforce capacity, cooldown, age, and the N-donors rule in a single transaction — no race conditions, no double-accepts. |
| 🛰️ | **Live donor heartbeat** | Once a donor accepts, foreground GPS streams their location so the recipient watches them approach on a live map, Uber-driver style. |
| 🧬 | **Blood compatibility matrix** | Donor matching follows the full ABO/Rh compatibility table server-side, with defensive client-side filtering. |
| 🛡️ | **Row-level security everywhere** | Every table has RLS policies; recipient phone numbers stay hidden until a donor commits. |
| 🔔 | **Killed-state push** | `expo-notifications` + Expo Push wake the app from any state on Android and iOS, with per-OEM channel tuning. |
| 🎨 | **Tri-state theme & 120 FPS target** | System / dark / light tokens, Reanimated v4 worklets, and FlashList v2 target buttery scrolling on mid-tier Android. |

---

## 🚧 Project Status

> **Active development.** The mobile client is distributed via EAS builds (no public store listing yet). Clone and run it locally with the steps below.

---

## 🛠️ Tech Stack

<div align="center">

![Expo](https://img.shields.io/badge/Expo_SDK_54-000020?style=for-the-badge&logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native_0.81-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Node.js](https://img.shields.io/badge/Node_20-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000?style=for-the-badge&logo=express&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000?style=for-the-badge&logo=vercel&logoColor=white)

</div>

| Layer | Choice |
|---|---|
| **Mobile** | Expo SDK 54, React Native 0.81, React 19, TypeScript (strict), Expo Router v6 |
| **UI / motion** | Reanimated v4 worklets, `@shopify/flash-list` v2, `expo-image`, `react-native-maps`, Ionicons |
| **State** | React Context (Auth · Theme · Toast) + Supabase Realtime as cache invalidation |
| **Backend** | Node 20 + Express on Vercel Serverless, with Vercel Cron for escalation & expiry |
| **Database** | Supabase Postgres with RLS, atomic RPCs, and `postgres_changes` realtime |
| **Auth** | Supabase Auth — passwordless email OTP |
| **Notifications** | `expo-notifications` + Expo Push API (APNs / FCM) |
| **Storage** | `@react-native-async-storage/async-storage` + `expo-secure-store` |

---

## 🚀 Getting Started

This is a monorepo with two apps: `backend/` (Express API) and `mobile/` (Expo client).

### Prerequisites

- **Node.js** >= 20
- **npm** (lockfiles are committed)
- A **Supabase** project (Postgres + Auth) and an **Expo** account for push & EAS builds

### 1. Clone

```bash
git clone https://github.com/aashir-athar/BludStack-RN.git
cd BludStack-RN
```

### 2. Backend (Express API)

```bash
cd backend
npm install
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, EXPO_ACCESS_TOKEN

# Apply the schema (single source of truth)
psql "$SUPABASE_DB_URL" < ../supabase_schema.sql

npm run dev
```

### 3. Mobile (Expo app)

```bash
cd ../mobile
npm install
cp .env.example .env
# Fill in EXPO_PUBLIC_API_URL, EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY

npx expo start
```

> ⚠️ Push notifications are **not** delivered to Expo Go on Android since SDK 53. Build a dev client (`npx eas build --profile development`) to test pushes.

---

## 📖 Usage

A request flows through the platform like this:

1. **Recipient posts a request** — blood group, units needed, hospital location, and urgency.
2. **Geo-fence escalation begins** — `nearby_compatible_donors(req_id, radius_km)` filters by the compatibility matrix and eligibility (age, cooldown, availability), then Expo Push pages the cohort ring by ring.
3. **A donor accepts** — an atomic `accept_blood_request` RPC reserves a slot and starts the **live GPS heartbeat**.
4. **Donation completes** — `complete_blood_donation` increments the donor's history and checks fulfillment. A request for **N units needs N distinct donors** before it flips to `fulfilled`.

<details>
<summary><strong>🧬 Blood compatibility matrix</strong></summary>

| Recipient | Can receive from |
|---|---|
| **O−** | O− |
| **O+** | O−, O+ |
| **A−** | O−, A− |
| **A+** | O−, O+, A−, A+ |
| **B−** | O−, B− |
| **B+** | O−, O+, B−, B+ |
| **AB−** | O−, A−, B−, AB− |
| **AB+** | All groups (universal recipient) |

`DONOR_FOR_RECIPIENT` in `constants/BloodData.ts` is the canonical mapping; the backend filters by it server-side.

</details>

<details>
<summary><strong>🌍 Geo-fence escalation rings</strong></summary>

```text
Request posted
  → Ring 1 km   (~30 s)
  → Ring 5 km   (~60 s)
  → Ring 15 km  (~90 s)
  → Ring 30 km  (~2 min)
  → Ring 50 km  (~3 min)
  → Country-wide
```

Each ring claim is DB-persisted with compare-and-set (CAS) semantics, so two cron ticks can never double-page the same ring.

</details>

---

## 🗺️ Roadmap

- [x] Real-time geo-fence ring escalation
- [x] Atomic accept / complete RPCs with N-donors rule
- [x] Live donor heartbeat & map tracking
- [x] Passwordless email OTP auth
- [x] Killed-state push notifications (Android + iOS)
- [ ] Public app store releases (Google Play / App Store)
- [ ] Donor reputation & verified-badge program
- [ ] In-app analytics for hospitals & blood banks

---

## 🤝 Contributing

Contributions are welcome and appreciated. For major changes, please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create a branch (`git checkout -b feat/your-feature`)
3. Commit your changes
4. Push the branch and open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See [LICENSE](./LICENSE) for details.

---

## 👤 Author

**Aashir Athar**

[![GitHub](https://img.shields.io/badge/GitHub-aashir--athar-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/aashir-athar)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-aashirathar-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/aashirathar/)
[![X](https://img.shields.io/badge/X_(Twitter)-aashirathar-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/aashirathar)

---

<div align="center">

### ⭐ If BludStack could help save a life, consider starring the repo.

<sub>Built with React Native, Expo & Supabase by <a href="https://github.com/aashir-athar">aashir-athar</a></sub>

<br /><br />

<sub><strong>Keywords:</strong> blood donation app · React Native · Expo SDK 54 · Supabase · blood bank · donor matching · geofencing · real-time healthcare app · TypeScript · iOS · Android · cross-platform mobile app</sub>

</div>
