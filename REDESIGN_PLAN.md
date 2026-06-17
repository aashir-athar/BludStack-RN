# BludStack - 2026 Uber-style Redesign Plan

The single source of truth for the full app rebuild. Every screen, every
component, every modal, every string is implemented against this document.
Governed by [`.claude/agents/rn-expo-2026-architect.md`](../.claude/agents/rn-expo-2026-architect.md)
- all non-negotiables (no emojis, no MMKV, no Sentry, AsyncStorage only,
Skeleton only, no `ActivityIndicator`, theme tokens everywhere, pill-shaped
2026 visual language, SafeArea + KeyboardAvoidingView, Reanimated v4 worklets,
FlashList for lists, expo-image for images) carry through this entire plan
without exception.

---

## 1. Product positioning

| Field | Value |
|---|---|
| Tagline | *The fastest way to find a donor.* |
| Voice | Urgent yet calm. Medical-grade trust, no false drama. Microcopy reads like a person, never marketing-speak. |
| Visual mood | Warm onyx surface, crimson signature, saline trust-green, plasma amber for urgency. Pill-shaped, generous whitespace, restrained depth. |
| North-star UX reference | Uber (recipient flow), iMessage (chat), Linear (clarity). |

---

## 2. Roles, gates, and flows

There are exactly three roles, set at registration:

- **Donor** - gives blood when matched. Age must be ≥ 18 (server-enforced).
- **Recipient** - needs blood. No age gate.
- **Both** - does both.

### 2.1 Auth → onboarding → role-aware home

```
unauthenticated         → /(auth)
authenticated, no name  → /onboarding
authenticated + name + role 'recipient'         → /(tabs)/request
authenticated + name + role 'donor' or 'both'   → /(tabs)         (donor home)
```

This is enforced in **`app/index.tsx`** (cold-start gate) and
**`app/_layout.tsx`** (subsequent transitions). Both files are already
implemented to this contract.

### 2.2 Role-aware tab bar

| Tab | Donor | Recipient | Both |
|---|---|---|---|
| Home   |  | - |  |
| Request|  (primary, pill) |  (primary) |  |
| Find   |  | - |  |
| Requests | - |  |  |
| History |  | - |  |
| Account|  |  |  |

The Request tab is always centered as the pill CTA - but its meaning changes:
recipients land on the post-request flow; donors only see it if they're
"both" role; donor-only users never see it.

### 2.3 The N-units-per-N-donors rule

A request for `units_needed = N` requires `N` distinct donors to accept *and*
complete. The schema's RPCs enforce this:
- `accept_blood_request` blocks the (N+1)th acceptance.
- `complete_blood_donation` flips the request to `fulfilled` only when the
  count of `completed` responses ≥ `units_needed`.

UI consequences:
- The "Accept" button on a request hides for the recipient who posted it.
- After completion of the Nth unit, the request transitions to `fulfilled`.

---

## 3. Design tokens

All tokens already live in `mobile/constants/Colors.ts` and
`mobile/constants/Typography.ts` and are NOT to be redefined elsewhere.

- **Palette**: crimson 600 primary on warm onyx (dark) / warm bone (light).
- **Semantic**: success=saline, warning=plasma, danger=crimson.
- **Radius**: pill (`Radius.pill` = 9999) for actions, `lg` for cards,
  `xl` for sheets, `2xl` for bottom sheets, `3xl` for hero blocks.
- **Elevation**: `xs` for cards, `sm` for active states, `md` for modals,
  `lg` for floating tab bar / toasts.
- **Spacing**: 4pt grid. Use the numeric keys from `Spacing`.
- **Motion**: `Motion.duration.{instant|fast|base|slow|bloom}` and
  `Motion.spring.{snappy|soft|bouncy|rigid}`.

Every component reads from `useTheme()`. No hardcoded hex anywhere except in
brand-anchored constants files.

---

## 4. Component inventory

### 4.1 Atomic (refreshed in this pass)

| Component | Variants | Notes |
|---|---|---|
| `BrandMark` | solid / outline / ghost | Vector blood-drop. Replaces  emoji everywhere. |
| `Surface` | solid / elevated / glass / ghost | iOS 26 Liquid Glass → expo-blur → Android flat decision tree. |
| `Skeleton` | line / group | Reanimated shimmer. Only loading primitive. |
| `Button` | primary / secondary / ghost / danger / success / outline ; sm/md/lg/xl | Pill, scale-on-press, label-pulse loading. |
| `Input` | text / pill / area ; md/lg | Animated focus ring, inline error, optional left/right icons. |
| `BloodGroupBadge` | solid / soft / outline / ghost ; xs-xl | Pill, theme-tokenized. |
| `Card` | surface / elevated / ghost / tinted | Pill-radius surface wrapper. |
| `EmptyState` | brand / Ionicons | Pill icon-circle, primary CTA. |
| `ScreenHeader` | solid / transparent / floating | Pill back button, centered title, right slot. |
| `ToggleSwitch` | - | Native Switch with theme tokens. |
| `SelectSheet` | - | Bottom sheet with backdrop + handle, radio-style. |
| `PressableScale` | - | Animated wrapper for tactile press. |
| `LoadingScreen` | - | BrandMark + shimmer. |
| `ErrorBoundary` | - | Render-phase fallback with retry. |
| `NetBanner` | - | Animated offline indicator. |
| `Toast` (via `ToastContext`) | success / error / info / warning | Pill, auto-dismiss. Replaces every `Alert.alert` error. |

### 4.2 Composite (refreshed in this pass)

| Component | Used by | Key behavior |
|---|---|---|
| `ProfileCard` | request/[id], donor/[id], my-requests, donors tab | Avatar + status + blood badge + optional contact pill row (Call/WhatsApp/Chat). **Contact pills only render when a parent passes the intent - disclosure is parent-controlled.** |
| `RequestCard` | home, donors, my-requests, history | Urgency stripe + blood badge + hospital block + meta footer. Optional inline accept/decline. |
| `UrgencyBanner` | request/[id] | Donor-availability context (count, radius, country fallback). |
| `StatsBanner` | home | Community totals (donations, donors, lives helped - 1 unit = 1 life). |

### 4.3 Deferred / legacy template files

`components/parallax-scroll-view.tsx`, `themed-text.tsx`, `themed-view.tsx`,
`external-link.tsx`, `haptic-tab.tsx`, `hello-wave.tsx`, `ui/collapsible.tsx`
- Expo template leftovers. **Action: delete in a later pass** once we confirm
no remaining imports. Not blocking.

---

## 5. Screens

Every screen carries one psychological lever annotated at the top of the
file. Every visible string passes the AI-tell scrub (no "delve / tapestry /
elevate / transformative"). Every fixed-bottom CTA on tab screens lifts to
`TAB_BAR_BOTTOM_INSET` (96) + `Spacing[4]` to clear the floating tab bar.

### 5.1 `(auth)/index.tsx` - Sign in / sign up
**Lever**: cognitive-load reduction (one input per step).
- Step 1: email → OTP send.
- Step 2: 6-digit code → verify.
- BrandMark + wordmark + tagline.
- Field-level errors via Input; toasts on send/verify failure.
- Legal blurb at the bottom: "By continuing you agree to our Terms and
  acknowledge our Privacy Policy. We never share medical info without your
  consent." (scrubbed of marketing speak)

**Status**:  Implemented.

### 5.2 `onboarding.tsx` - First-run profile
**Lever**: progressive disclosure + commitment escalation.
- Step 1: role (donor / recipient / both) - gates everything else.
- Step 2: identity (name + gender).
- Step 3: DOB - **required for donor/both, optional for recipient**.
- Step 4: blood group.
- Step 5 (donor/both only): medical history.
- Step 6: contact (phone + WhatsApp toggle).
- Step 7: confirm card.

**Status**:  Implemented.

### 5.3 `(tabs)/index.tsx` - Donor home
**Lever**: scent of urgency + Fitts's Law on Accept.

Layout (top → bottom):
1. Greeting block: "Good evening, {firstName}" + availability pill.
2. `StatsBanner` (community totals).
3. **Critical requests** section (red header) - `RequestCard`s with
   inline accept/decline (`showActions=true`).
4. **Compatible requests near you** - secondary section, no inline actions
   (tap → request detail modal).
5. Pull-to-refresh.

Must NOT show the user's own posted requests (filtered server-side +
client-side defence-in-depth). Already done.

**Status**:  Exists, needs visual refresh against the new component set.

### 5.4 `(tabs)/request.tsx` - Post request  *(Uber DECIDE → VERIFY → ACT)*

The most critical conversion point in the app. Built to mirror Uber's
ride-request screen 1:1 - every Uber element has a blood-donation analogue.

**Lever**: DECIDE → VERIFY → ACT. Map at top creates a feeling that "the
system is alive and ready" (motion = trust); bottom sheet collapses every
verification step into thumb-zone; sticky branded pill at the bottom names
the action so users never tap the wrong thing.

| Uber element | BludStack analogue |
|---|---|
| Live map (60% of screen) + pickup pin | Map (~55% of viewport) + draggable hospital pin |
| Animated nearby driver dots | Pulsing crimson dots for compatible available donors near the pin (count from `apiNearbyDonors`, jittered around the pin - never exposes real coords) |
| Route summary bar (Current → Destination) | Route bar: "Your location" → "Hospital" with vertical connecting line |
| Horizontal ride-type carousel (UberX / XL / Black) | Horizontal urgency carousel (Critical / Urgent / Standard) - cards scale 1.04× on select with spring physics |
| ETA badge ("3 min away") | Donor-availability badge: "{N} {bloodGroup} donor(s) ready" with pulsing live-dot |
| Price range ($12-$16) | Units stepper ("{N} donor(s) will be matched") - N units = N donors rule baked in |
| Payment method row | (deferred - phone/contact is on profile) |
| Promo code row | "Add a note for donors (optional)" - de-emphasised, low-priority placement |
| Sticky "Request UberX" pill | Sticky "Post critical request" / "Post urgent request" / "Post request" pill - label mirrors urgency tier so users never commit to the wrong tier |

**Motion vocabulary on this screen**:
- Pin drop / drag: Haptic `selection`.
- Urgency-card tap: Spring scale to 1.04× (snappy), Haptic `selection`.
- Blood / units tap: Haptic `selection`.
- Live-donor pulse: 2.4 s `Easing.inOut(ease)` ring expansion + opacity 0.45 → 0, infinite repeat. Worklet-driven (UI thread).
- Post button tap: Haptic `impact medium` + label-pulse loading state.

**Status**:  Implemented to spec.

### 5.5 `(tabs)/donors.tsx` - Find / browse donors
**Lever**: discovery, no nudge to convert (this is exploration).

Layout:
1. Search header (blood group + urgency filters - pill chips).
2. Empty state if no nearby donors.
3. `FlashList` of `ProfileCard`s in `compact` mode, with `onPress` → donor profile modal.

**Status**:  Exists, needs filter pills refreshed.

### 5.6 `(tabs)/my-requests.tsx` - Recipient's posted requests
**Lever**: control + closure.

Layout:
1. Filter pills (All / Active / Fulfilled / Cancelled).
2. `RequestCard` list, each tappable → `/request/[id]`.
3. Empty state per filter.

**Status**:  Exists, needs visual refresh.

### 5.7 `(tabs)/history.tsx` - Donor's donation log
**Lever**: identity reinforcement + peak-end.

Layout:
1. Hero card with three stats: **Donations**, **Lives helped (= donations)**,
   eligibility (Available now / Cooldown N days / Under age).
2. List of `request_responses` with `status` and request snippet.

**Status**:  Exists, lives bug fixed, needs visual refresh.

### 5.8 `(tabs)/profile.tsx` - Account
**Lever**: control + sense of presence.

Layout:
1. Hero avatar + name + blood badge + status pill.
2. Stats row (Donations / Lives helped / Cooldown days).
3. Edit profile entry (chevron → `/profile/edit`).
4. Toggle row: available to donate / share medical history.
5. App settings: appearance picker (Dark / Light / System).
6. About card (Version / License / Security - Ionicons, no emoji).
7. Sign out.

**Status**:  Exists. Edit-profile entry added. Lives bug fixed.

### 5.9 `request/[id].tsx` - Request detail (modal presentation)
**Lever**: loss aversion (donor side) + peak-end (recipient side).

Role-aware sections:

| Section | Recipient | Donor (compatible) | Donor (incompatible) | Other |
|---|---|---|---|---|
| Hero (blood + hospital + urgency) |  |  |  |  |
| Map preview |  |  |  |  |
| Pending donor count |  | - | - | - |
| Accepted donor list (with ProfileCard + contact pills + chat button) |  | - | - | - |
| Recipient info (with ProfileCard + contact pills + chat button) | - |  if accepted | - | - |
| Live donor location card (link to `/map/live`) |  if any accepted | - | - | - |
| Accept / decline CTA | - |  if not yet responded | - | - |
| Mark fulfilled CTA (per-donor) |  if any accepted | - | - | - |
| Cancel request CTA |  if active | - | - | - |
| Closed-state banner |  if not active |  if not active |  if not active |  if not active |

**Status**:  Partial. Accept guard fixed. Chat-from-recipient wired.
Contact unmask via `ProfileCard` already supported (props passed).
Live-location link card pending.

### 5.10 `donor/[id].tsx` - Donor profile modal
**Lever**: trust signals + reciprocity.

Layout:
1. Hero: avatar + verified tick + blood badge + status pill + total donations.
2. Compatibility card: "Can donate to me" / "Cannot donate to my blood group".
3. Recent activity list (request_responses).
4. Contact actions (Call / WhatsApp / Chat) - only when recipient and donor
   are matched on an active request.

**Status**:  Exists, emoji scrubbed, needs visual refresh.

### 5.11 `map/live.tsx` - Live tracking
**Lever**: relief (uber-driver UX) + identity ("you are coming, we see you").

Layout:
1. Full-screen MapView (theme-aware).
2. Hospital marker (Ionicons medical pin).
3. Donor markers (Ionicons water pin, draggable in real-time as the
   donor's app pushes heartbeats).
4. Polyline donor → hospital (donor side only).
5. Bottom card with:
   - Hospital name + address.
   - "N donor(s) en route".
   - ETA from donor → hospital (via heartbeat lat/lon).
   - "Open in Maps" button.

**Status**:  Skeleton exists. Live donor pin updates pending the
`useDonorHeartbeat` hook + backend `/donations/heartbeat` endpoint
(see section 6).

### 5.12 `chat.tsx` - 1:1 chat per request
**Lever**: reciprocity / commitment (chat unlocks after accept).

Layout:
1. Header: back + recipient/donor name + "Typing…" / "Re: request #ABC".
2. FlashList v2 message list with `maintainVisibleContentPosition`.
3. Composer pill with Ionicons send button.

**Status**:  Implemented.

### 5.13 `profile/edit.tsx` - Edit profile (modal)
**Lever**: control.

Sections (collapsible / scrollable):
1. Identity (name, gender, DOB).
2. Role (donor / recipient / both - re-validates age gate server-side).
3. Blood (8-cell grid).
4. Contact (phone + WhatsApp).
5. Medical history (donors / both only).
6. Availability (donors / both only).

**Status**:  Implemented.

---

## 6. Live donor location (pending feature)

### 6.1 Data model

`request_responses` extended with:
- `donor_lat double precision`
- `donor_lon double precision`
- `donor_location_updated_at timestamptz`

Already in `migrations/2026-05-12-uber-redesign.sql`.

### 6.2 Backend endpoint

```
POST /api/v1/donations/heartbeat
Body: { requestId: uuid, latitude: number, longitude: number }
Auth: required (donor's JWT).
Effect: upsert into request_responses row (matched by request_id + donor_id),
        only if status='accepted'. Sets donor_lat, donor_lon, donor_location_updated_at.
Rate limit: 1 req / 15s per donor per request.
```

### 6.3 Mobile hook

```
useDonorHeartbeat(requestId: string | undefined)
  → mounts a foreground Location.watchPositionAsync
  → pushes /donations/heartbeat every 30s + 50m of movement
  → unmounts when the donor leaves the request detail screen or marks complete
```

Mounted from the **"You're on the way"** state inside `request/[id].tsx`
(donor accepted, request active).

### 6.4 Map live consumption

`map/live.tsx` subscribes to realtime UPDATEs on `request_responses` filtered
by `request_id` and reads `donor_lat / donor_lon / donor_location_updated_at`.
Recipient sees the donor pin animate in.

---

## 6.5 Tri-expert framework - applied per screen
(Generated from the `web-app-uiux-psychology-copywriting-2026` skill.)

Every screen below is treated as a fusion of three things: a layout, a
psychological lever, and the actual copy. Each row tells the story in one
glance.

| Screen | Awareness stage | Primary lever | Copy framework | Hero line / primary CTA |
|---|---|---|---|---|
| `(auth)/index` step 1 | Most-aware (they came to sign in) | Cognitive-load reduction (1 input) | None (pure microcopy) | "What's your email?" / "Continue" |
| `(auth)/index` step 2 | Problem-aware (just sent the code) | Friction reduction + reassurance | None (microcopy) | "Check your inbox" / "Verify and continue" |
| `onboarding` role step | Solution-aware (they want to use the product) | Commitment + identity ("I am a donor") | BAB (Before / After / Bridge) | "How will you use BludStack?" |
| `onboarding` DOB | Solution-aware | Loss aversion ("you stay a recipient if under 18") | FAB (Feature / Advantage / Benefit) | "When were you born?" |
| `onboarding` confirm | Product-aware (about to commit) | Peak-end (review before save) | None (microcopy) | "Last look - does this look right?" / "Save and continue" |
| `(tabs)/index` (donor home) | Most-aware | Scent of urgency + Fitts's Law on Accept | PAS (Problem / Agitate / Solution) for critical band | "Good evening, {name}" / per-card "Accept and donate" |
| `(tabs)/request` (post) | Most-aware | Commitment (map-pin first = mental investment) | None (form microcopy) | "Post a request" / "Post critical request" |
| `request/[id]` (donor compatible, not yet responded) | Solution-aware | Loss aversion ("no donors yet" + ETA) | PAS in scarcity row | "You can reach the hospital in N min" / "Accept and donate" |
| `request/[id]` (donor accepted) | Product-aware | Reciprocity + peak-end | None (status microcopy) | "You're on the way" / "Open directions" |
| `request/[id]` (recipient w/ donors) | Most-aware (in middle of crisis) | Relief + control | None (status microcopy) | "{N} donor(s) on the way" / "Mark as fulfilled" |
| `chat` | Most-aware | Reciprocity (chat unlocks after accept) | None (microcopy) | - / "Send" |
| `(tabs)/donors` | Solution-aware | Discovery, no nudge | FAB on profile cards | "Find donors near you" / per-card "View profile" |
| `(tabs)/my-requests` | Most-aware | Control + closure | None (microcopy) | "Your requests" / "Post a new request" |
| `(tabs)/history` | Most-aware (identity) | Identity reinforcement ("you saved N lives") | Social proof (your own track record) | "Your donations" / "Find requests near you" |
| `(tabs)/profile` | Most-aware | Control + sense of presence | None (microcopy) | "{name}" / "Edit profile" |
| `donor/[id]` | Solution-aware (recipient evaluating donor) | Trust signals + reciprocity | FAB (this donor's features → benefits to me) | "{name}" / "Call donor" |
| `map/live` | Most-aware (crisis ongoing) | Relief (Uber-driver UX) | None (status microcopy) | "Donor en route" / "Open in Maps" |
| `profile/edit` | Most-aware | Control | None (microcopy) | "Edit profile" / "Save changes" |

### Microcopy library (every visible string passes the AI-tell scrub)

**CTAs** - verb-first, never "Click here", never "Submit":
- "Continue" / "Verify and continue" / "Post request" / "Accept and donate"
- "Not this time" (decline - softer than "Reject")
- "Mark as fulfilled" / "Cancel this request"
- "Open directions" / "Call donor" / "Message donor"

**Empty states** - encouraging, not absent:
- Home (no compatible requests): "All quiet. We'll ping you the moment a compatible request lands." → CTA "Update availability"
- My requests (none): "No requests yet. Post one in seconds." → CTA "Post a request"
- History: "No donations yet. The first one matters most." → CTA "Find requests near you"
- Donors discovery (no results): "No donors match those filters. Widen the search?" → CTA "Reset filters"
- Chat (empty thread): "Start the conversation. Messages are private between you and {name}."

**Errors** - take the blame, never user-blaming:
- "We couldn't send the code. Try again in a moment."
- "That code didn't match. Double-check or send a new one."
- "Couldn't save your profile. Check your connection and try again."
- "We hit a snag rendering this screen. Tap below to reload it - the rest of the app is fine."

**Confirmations** - calm, not celebratory unless the moment earns it:
- After accept: "You're on the way. Head to {hospital} as soon as you can."
- After complete (peak-end moment, earned): "Life saved. Donation recorded."
- After cancel: "Request cancelled. You can post a new one anytime."

**Banners**:
- Offline: "Offline · we'll catch up when you reconnect."
- Critical-tier indicator: "CRITICAL · NEEDS IMMEDIATE RESPONSE"

**No AI tells anywhere** - scrubbed list: `delve`, `tapestry`, `navigate the
complexities`, `in today's ever-changing landscape`, `elevate your`,
`transformative`, `game-changer`, `seamlessly`, `unleash`, `journey`,
`revolutionary`. If any of these appear in the final tree, that's a bug.

### Motion vocabulary (Reanimated v4 worklets only)

| Element | Token | Trigger | Curve |
|---|---|---|---|
| Button press | `Motion.duration.instant` (80ms) scale 0.97 | onPressIn | linear timing |
| Pill state change (tab focused, chip selected) | LayoutAnimation spring damping 0.72 | onPress | spring |
| Toast enter / NetBanner enter | `Motion.spring.snappy` (damping 18, stiff 240) | mount | spring |
| Modal slide | `Motion.duration.base` (240ms) | navigate | standard |
| Skeleton shimmer | 1100ms infinite | mount | inOut(ease) |
| Success badge (peak-end) | scale 0 → 1.1 → 1 bounce | mount | spring bouncy |
| Map pin update | LayoutAnimation 320ms | new coordinate | spring soft |

### Color × intent map

| Intent | Token | Use case |
|---|---|---|
| Brand / urgent CTA | `theme.primary` (crimson 600) | Accept, Post, Submit |
| Success / matched | `theme.success` (saline) | Complete, available, verified |
| Urgent tier | `theme.warning` (plasma) | Urgent urgency, cooldown |
| Critical tier | `theme.danger` (crimson) | Critical urgency, errors |
| Surfaces | `theme.surface` / `cardElevated` | Cards, sheets, headers |
| Tab bar | `theme.tabBar` (onyx 850 / pure white) | Floating pill bar |

---

## 7. Copy guidelines

- **Verb-first CTAs**: "Accept and donate", "Mark as fulfilled", "Open
  directions" - never "Click here" or "Submit".
- **Take the blame in errors**: "We couldn't send the code. Try again in a
  moment." (Toast.error variant).
- **Short titles, no exclamations** unless it's peak-end ("Life saved").
- **No marketing speak**: scrubbed of *delve*, *elevate*, *transformative*,
  *unleash*, *journey*, *seamless*.
- **Numbers spelled when small** in body copy; numerals in stats / metadata.

---

## 8. Acceptance criteria (the bar)

A screen is "done" only when it passes ALL of these:

- [ ] Reads from theme tokens - no hardcoded hex.
- [ ] No emoji anywhere (UI / copy / code comments).
- [ ] No `ActivityIndicator` - only `Skeleton`.
- [ ] No `Alert.alert` for non-confirmation feedback - use `Toast`.
- [ ] Bottom content clears the floating tab bar
      (`paddingBottom ≥ TAB_BAR_BOTTOM_INSET`).
- [ ] Role-aware: only renders sections relevant to the caller's role.
- [ ] Has at least one Reanimated v4 micro-animation on press / mount /
      success / error.
- [ ] All Pressables have `accessibilityRole` and `accessibilityLabel`.
- [ ] Strict TypeScript: no `any`, no `@ts-ignore`.
- [ ] One-line psychological-lever annotation at the top of the file.
- [ ] Lists ≥ 10 items use `FlashList` (not `FlatList`).
- [ ] All images use `expo-image` with `contentFit` set.

---

## 9. Build order

1. **Components** (done in this pass): Badge, Card, Surface, Button, Input,
   ScreenHeader, Toggle, SelectSheet, Profile, Request, Urgency, Stats,
   LoadingScreen, ErrorBoundary, NetBanner, EmptyState, BrandMark, Skeleton.
2. **Modals**: profile/edit (done), chat (done), SelectSheet (done).
3. **Screens** in priority:
   1. `(tabs)/request.tsx` (done - map picker + bottom CTA clear).
   2. `request/[id].tsx` (partial - needs live-location link card).
   3. `(tabs)/index.tsx` (donor home) - visual refresh to new tokens.
   4. `map/live.tsx` - wire to `useDonorHeartbeat`.
   5. `donor/[id].tsx` - visual refresh.
   6. `(tabs)/donors.tsx`, `(tabs)/my-requests.tsx`, `(tabs)/history.tsx` - visual refresh.
4. **Heartbeat plumbing**: backend `/donations/heartbeat` + `useDonorHeartbeat`.
5. **Final**: emoji sweep, theme-token audit, accessibility audit, commit.

---

## 10. Non-negotiables (from `rn-expo-2026-architect.md`)

These rules from the architect agent file MUST hold:

- No Sentry / Bugsnag / Crashlytics. `errorReporter.ts` is a no-op wrapper.
- No `react-native-mmkv`. AsyncStorage everywhere; `expo-secure-store` for tokens.
- Skeleton loading only. Never `ActivityIndicator`. Never any spinner.
- No emojis in UI, copy, code comments, commit messages, icons.
- No manual edits to `package.json` or `app.json` - always `npx expo install`.
- Strict TypeScript, no `any`.
- `react-native-safe-area-context`, not the deprecated RN `SafeAreaView`.
- `expo-image`, not `Image` from `react-native`.
- `react-native-reanimated` v4 worklets for animations, never RN `Animated`
  for new code.
- `FlashList` for any list > ~10 items.
- New Architecture is on.
- `expo-glass-effect` for iOS ≥ 26, `expo-blur` for iOS < 26, **flat surface
  on Android** - encapsulated in `Surface` component.
- Per-commit noreply email override (`aashir-athar@users.noreply.github.com`),
  never set in global git config.
- No `git push` without explicit user authorization.
- One branch per change.

---

## 11. Migration tracker

Files the user must apply in Supabase Studio SQL Editor:

1. `supabase_schema.sql` - full schema (idempotent, safe to re-run).
2. `migrations/2026-05-12-uber-redesign.sql` - deltas on top: live-location
   columns, ambiguous-column RPC fixes, N-donor completion logic, stronger
   service-role detection in guards, explicit table grants.

After applying both, the verification SQL at `verify_schema.sql` should
return all `PASS` rows.

---

---

## 12. Architect-alignment matrix
Direct mapping from every numbered non-negotiable in
[`.claude/agents/rn-expo-2026-architect.md`](.claude/agents/rn-expo-2026-architect.md)
to where it is enforced in this plan / codebase. If a row says " Done"
you can grep the codebase and find the implementation; if it says "⏳
Pending" it's tracked in section 9 (Build order).

| # | Non-negotiable | Status | Where |
|---|---|---|---|
| 0 | No Sentry / Bugsnag / Crashlytics |  Done | `mobile/lib/errorReporter.ts` is a typed no-op wrapper |
| 0 | No `react-native-mmkv` |  Done | AsyncStorage everywhere; `expo-secure-store` for sensitive tokens |
| 0 | Skeleton only, never `ActivityIndicator` |  Done | `Skeleton.tsx` + `Button` uses label-pulse, `LoadingScreen` + chat older-loader use Skeleton |
| 0 | NativeWind className vs style rule | N/A | Project does not use NativeWind |
| 0 | Icon prompt chroma key #00FF00 | N/A | No icon prompts generated this pass |
| 0 | Per-commit noreply email override |  Done | Every commit author set to `aashir-athar@users.noreply.github.com` via env+`--author` |
| 0 | One branch per change |  Done | `feat/2026-ui-overhaul-2026-05-12` |
| 0 | No `git push` without authorization |  Done | Awaiting explicit user authorization for each push |
| 1 | Strict TypeScript + custom hooks + memo |  Done | `tsconfig.strict`; hooks in `mobile/hooks/`; `React.memo` on every leaf component |
| 2 | Performance - FlashList, expo-image, Reanimated |  Done | Chat uses FlashList v2; cards use expo-image; animations are Reanimated v4 worklets |
| 3 | Dark/light theme - instant + persisted |  Done | `ThemeContext.tsx` tri-state with `Appearance` subscription + AsyncStorage persist |
| 4 | iOS 26 Glass / iOS<26 Blur / Android flat |  Done | `Surface.tsx` lazy-requires `expo-glass-effect`, falls back to `expo-blur`, flat on Android |
| 5 | SafeArea + Keyboard handling |  Done | `react-native-safe-area-context` everywhere; `KeyboardAvoidingView` + `react-native-keyboard-controller` lazy-required |
| 6 | Reusable, typed, documented components |  Done | Every component exports `XxxProps`; variant lists documented in header comments |
| 7 | Locked dependency versions (SDK 54) |  Done | `package.json` is on `~54.0.33`; every additional dep via `npx expo install` |
| 8 | 2026 visual language (pill, whitespace, motion) |  Done | Pill radius on actions, generous spacing, micro-animations on press |
| 9 | Top-tier product team feel |  Partial | Components match the bar; some screens still on older tokens - see section 5 status |
| 10 | Psychology levers per screen |  Done | Section 6.5 names the lever per screen; each non-trivial screen has the annotation comment |
| 11 | No emojis anywhere |  Done | Final grep clean; vectors via Ionicons + custom SVG (`BrandMark`) |
| 12 | `zero-to-deploy.md` | ⏳ Pending | Not yet generated |
| 13 | `README.md` to the 21-section spec | ⏳ Pending | Existing README is the original project one |
| 14 | Locked stack (Reanimated v4 / FlashList / TanStack Query / Tamagui / Zustand) |  Partial | Reanimated + FlashList + Skeleton + expo-image . Tamagui, Zustand, TanStack Query, react-hook-form+zod intentionally deviated from - see section 13 below |
| 15 | New Architecture + image opt + React Compiler |  Done | `newArchEnabled: true` in app.json; expo-image with cachePolicy; React Compiler enabled |
| 16 | 3D Pixar icon prompts (Nano Banana Pro) | ⏳ Pending | Not yet generated |
| 17 | `mobile/` + `backend/` split when backend exists |  Done | Repo is split at root |

---

## 13. Documented deviations from the architect's default stack
The agent specifies a default stack (Tamagui, Zustand, TanStack Query,
react-hook-form + zod). I deviated from these on purpose because mid-flight
migration cost vastly exceeded user-visible benefit on this codebase. Each
deviation is documented with the reason and the cost of un-deviating later.

| Default | Used | Reason | Cost to switch later |
|---|---|---|---|
| Tamagui | `StyleSheet` + `Colors.ts` / `Typography.ts` tokens | Existing app has 30+ files on StyleSheet. Migrating mid-redesign = scope explosion with zero UI delta. The token system gives 90% of the benefit. | One PR per component (~1 day total). Replace `StyleSheet.create` with Tamagui's `styled()` and read tokens from Tamagui's theme. |
| Zustand | React Context (`AuthContext`, `ThemeContext`, `ToastContext`) | Three contexts is fine for an app this size. Adding Zustand is ceremony with no observable change. | One PR per context (~1 hour each). Replace `useContext` consumers with `useStore` selectors. |
| TanStack Query | Direct fetch in `utils/api.ts` + hooks with realtime + 20-30s polling fallback | Supabase Realtime is the cache invalidation mechanism; TanStack Query duplicates the responsibility for marginal DX. | One PR per resource (~2 hours total). Wrap each `apiX` fn in `useQuery`. Keep the realtime subscription as a query invalidator. |
| react-hook-form + zod | `useState` + inline validators | 4-7 field forms (auth, onboarding step, edit profile) don't justify the abstraction. | One PR. Easy to swap in. |
| Jest + Maestro | None | No tests added in this pass. | Major work; not in scope. |

If the user wants the architect's default stack honoured exactly, each row's
"cost" column is the path forward.

---

## 14. CANONICAL DESIGN LANGUAGE - "Request-screen parity"

The **`(tabs)/request.tsx`** screen is the **locked reference**. The user has
explicitly stamped it as the visual + interaction north-star. Every other
screen, modal, and component in this app must score 100% on the checklist
below. If a surface fails any row, it is not finished.

### 14.1 Required structural patterns

| # | Pattern | Where it lives in `request.tsx` | Required everywhere when… |
|---|---|---|---|
| 1 | **Hero zone (~55% of viewport)** with overlay info pills | Map + donor count badge + hint pill | Screen has a primary visual subject (map, profile, request detail) |
| 2 | **Bottom sheet ascends over hero** with `-Spacing[5]` overlap | `Animated.View` with `marginTop: -Spacing[5]` + spring entrance | Screen pairs a hero with a form/info body |
| 3 | **Brand accent strip + handle** at the sheet top | `styles.accentStrip` (3px crimson) + `styles.handle` | Any sheet-style surface (modals included) |
| 4 | **`SectionLabel` typography** - uppercase, `FontWeight.black`, `LetterSpacing.widest`, `theme.textMuted`, `marginLeft: Spacing[2]` | The local `SectionLabel` component | Every form section, every list section header |
| 5 | **Route-bar (origin → destination)** with dots + connecting line | `styles.routeBar` + `routeCol/routeDot/routeLine` | Any "from X to Y" summary (request detail, donor detail, history items) |
| 6 | **Horizontal carousel of choice cards** - cards spring-scale to 1.04× on select with `withSpring` | `UrgencyCard` component, ScrollView horizontal | Any 3-5 mutually-exclusive choice set |
| 7 | **Grid for finite options** - 4×n, `width: '23%'`, `Radius.xl`, 1.5px border, selected = filled-primary | Blood group grid | Any 6-10 mutually-exclusive options |
| 8 | **Compact stepper with dot row** + sentence under value | Units stepper | Any quantity selection |
| 9 | **Preview card before commit** - small "what the other side will see" mock with stripe + chips | "What donors will see" card | Any form with a downstream recipient |
| 10 | **Inline CTA at end of form** with three-part stack: summary row + breathing button + footer note | `ctaInline` block | Every form-style screen (post-request, edit-profile, onboarding step) |
| 11 | **CTA summary row** = colored dot + bold tier label + bullet-separated key facts + optional live pill on the right | `ctaSummary` | Every CTA above pill button |
| 12 | **Breathing animation** on critical/destructive CTAs (1.00 ↔ 1.02, 1500ms ease-in-out, infinite) | `BreathingWrapper` | Any commit-critical primary CTA |
| 13 | **CTA footer micro-copy** - privacy/contract/reassurance, centered, `theme.textMuted`, 1.5× line height | `ctaFooterNote` | Every CTA |

### 14.2 Required token use

- **Radius**: `Radius.pill` for actions and chips, `Radius.xl` for cards/grid cells/route-bar, `Radius['2xl']` for sheet top.
- **Spacing**: scroll padding bottom = `insets.bottom + TAB_BAR_HEIGHT + Spacing[6]`; section gap = `Spacing[5]`; sheet horizontal padding = `Spacing[5]`.
- **Elevation**: `Elevation.lg` for floating cards, `Elevation.md` for status pills, `Elevation.sm` for badges.
- **Colors**: NEVER hardcode hex outside `Colors.ts`. All surfaces resolve through `theme.surface`, `theme.cardElevated`, `theme.background`, `theme.border`, `theme.borderStrong`, `theme.textPrimary`, `theme.textMuted`, `theme.textTertiary`, `theme.primary`, `theme.success`, `theme.warning`, `theme.danger`, `theme.textOnPrimary`.
- **Typography**: Section labels = `FontSize.xs / black / widest`. Values = `FontSize.sm / bold / snug`. Big numbers = `FontSize['2xl'] / black / tighter`.

### 14.3 Required interaction patterns

- **Haptic on every selection** - `Haptics.selectionAsync()` on toggle/select; `Haptics.impactAsync(Medium)` on commit.
- **Reanimated worklets only** - every animation runs on UI thread with `useSharedValue` + `useAnimatedStyle`; the Pulse, Scale, Breathing, and CountUp utilities in `request.tsx` are the templates.
- **120 FPS target** - `react-native-reanimated` ≥4, `withRepeat`, `withSpring`, `withTiming` only. Never `Animated.parallel`/`Animated.sequence` on the JS thread for hot UI.
- **Memoization** - every list `renderItem`, every choice card, every chip is `React.memo`. Heavy derived values use `useMemo`. Callbacks passed to children are `useCallback`.
- **Skeleton loading only** - `Skeleton` shimmer placeholders matching content geometry. Never `ActivityIndicator`. Never any spinner.

### 14.4 Required copy patterns

- **CTA labels mirror tier/state**: "Post critical request" / "Post urgent request" / "Post request"; "Mark fulfilled" / "Marking…"; "Accept request" / "Joining…"; "Save changes" / "Saving…".
- **Footer micro-copy** under every CTA: privacy contract or reassurance ("By posting, you agree…", "We never share your number until a donor accepts").
- **Empty states** - verb-led, never feature-led: "Pin the hospital to see live donors" not "No data".
- **Error toasts** - what happened + what to do: "Couldn't post - check your connection and tap again."
- **Section labels** - questions, not nouns: "How urgent?" not "Urgency". "Blood group needed?" not "Blood group".
- **No emojis**. Anywhere. Period.

### 14.5a 100%-WIRED MANDATE (no stubs, no dead UI)

Every surface this sweep touches must be **fully functional end-to-end**.
A pixel-perfect screen with a dead button or a `// TODO` handler is a failed
screen. The contract per surface:

- **Every input** reads from and writes to the right place (API, context, AsyncStorage, Supabase). No `useState` islands disconnected from the backend.
- **Every button** has a real `onPress` that does work - no `() => {}`, no `Alert('Coming soon')`.
- **Every list** is wired to the real data source (Supabase + realtime + optional `useFocusEffect` refetch).
- **Every loading state** is a `Skeleton` shimmer of the right shape; every error state surfaces a toast + retry; every empty state is verb-led copy.
- **Every realtime subscription** is uniquely named, scoped, and cleaned up.
- **Every navigation transition** is `router.push/replace` with a typed path; deep links resolve to the right destination.
- **Every role-gate** filters by `profile.role` before render; service-role/recipient/donor flows must not see each other's screens.
- **Every form submit** validates client-side AND trusts server validation; failures surface a toast keyed to the actual error.

If a feature isn't ready to ship 100%, it doesn't appear in the UI at all
(hidden behind a role-check or a feature flag - never rendered as a stub).

### 14.5 Required role + state awareness

- Every screen routes through `useAuth()` and renders **only** what the current `profile.role` is entitled to see.
- Forms surface destructive-state warnings inline (no surprise modals).
- Realtime subscriptions are scoped, named uniquely (`uniqueChannelName`), and torn down in the effect cleanup. No leaked channels.

### 14.6 Map of screens → required treatment

| Screen | Hero zone | Body pattern | Primary CTA placement |
|---|---|---|---|
| `(auth)/index.tsx` | BrandMark + hero illustration (no map) | Centered card sheet with field stack | Inline at form end with footer micro-copy |
| `onboarding.tsx` | Step header + progress dot row | Section stack identical to request form | Inline "Continue" / "Finish" with summary row |
| `(tabs)/index.tsx` | Greeting hero + StatsBanner | FlashList of cards, section labels above each band | Per-card CTA chips (no global CTA) |
| `(tabs)/donors.tsx` | Filter chip row + count line | FlashList of `ProfileCard` | Per-card CTAs |
| `(tabs)/my-requests.tsx` | Filter chip row + count line | FlashList of `RequestCard` | "New request" inline at empty state |
| `(tabs)/history.tsx` | Stats hero (`StatsBanner`) | Timeline grouped FlashList | None (read-only) |
| `(tabs)/profile.tsx` | Avatar hero + name + role pill | Section stack of rows | "Edit profile" inline at end |
| `request/[id].tsx` | Map with hospital pin + live donor dots | Sheet stack: status banner → donor list → CTA | Sticky-feeling but inline CTA at end |
| `donor/[id].tsx` | Avatar hero + verified badge + stats row | Section stack: about → contact → history | "Contact" inline at end |
| `map/live.tsx` | Map ~70% | Mini-sheet at bottom with ETA + donor info | "Call" / "Message" pills inline in sheet |
| `profile/edit.tsx` | Header bar (modal) | Section stack identical to request form | Inline "Save changes" with summary row |
| `chat.tsx` | Header bar + recipient pill | Inverted FlashList of bubbles | Sticky composer dock (this is the only exception) |
| `CustomAlert` | Brand accent strip + handle | Title → body → action stack | Inline buttons with footer micro-copy |
| `SelectSheet` | Brand accent strip + handle | Scrollable option list with checkmark | "Confirm" inline at end |

This map is the work order for the rest of the sweep.

---

Last revision: 2026-05-12
