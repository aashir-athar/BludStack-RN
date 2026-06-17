// lib/reputation.ts
// ─────────────────────────────────────────────────────────────────────────────
// Donor reputation program. A pure mapping from completed-donation count to a
// named tier, plus the "how close to the next tier" math the UI uses for a
// goal-gradient nudge. total_donations is server-managed (incremented only by
// the complete_blood_donation RPC), so this layer is trustworthy by construction
// and needs no extra backend surface.
//
// Kept dependency-free (no RN / theme imports) so it is unit-testable and can be
// shared by any surface. The UI maps `tone` -> theme colour and `icon` -> an
// Ionicons glyph.
// ─────────────────────────────────────────────────────────────────────────────

export type ReputationTone = 'muted' | 'brand' | 'warning' | 'success';

export interface ReputationTier {
  key: 'new' | 'lifesaver' | 'regular' | 'champion' | 'guardian' | 'legend';
  label: string;
  /** Lowest donation count that earns this tier. */
  min: number;
  /** Ionicons glyph name the badge renders. */
  icon: string;
  tone: ReputationTone;
  /** One-line meaning, used on the donor's own profile. */
  blurb: string;
}

// Ordered low to high. Thresholds chosen so the early tiers feel reachable
// (the first donation matters most) and the top tiers stay rare.
export const REPUTATION_TIERS: readonly ReputationTier[] = [
  { key: 'new',       label: 'New donor', min: 0,  icon: 'water-outline',    tone: 'muted',   blurb: 'Welcome. Your first donation is the hardest and the most needed.' },
  { key: 'lifesaver', label: 'Lifesaver', min: 1,  icon: 'heart',            tone: 'brand',   blurb: 'You have given blood. One donation can help up to three people.' },
  { key: 'regular',   label: 'Regular',   min: 3,  icon: 'heart-circle',     tone: 'brand',   blurb: 'A dependable donor. Recipients can count on you.' },
  { key: 'champion',  label: 'Champion',  min: 10, icon: 'ribbon',           tone: 'warning', blurb: 'Ten donations and counting. You show up when it matters.' },
  { key: 'guardian',  label: 'Guardian',  min: 25, icon: 'shield-checkmark', tone: 'success', blurb: 'A pillar of the community. Twenty-five lives of impact and more.' },
  { key: 'legend',    label: 'Legend',    min: 50, icon: 'trophy',           tone: 'success', blurb: 'Fifty donations. The rarest, most trusted tier there is.' },
] as const;

// Each whole-blood donation can help up to three patients (red cells, plasma,
// platelets). A grounded, widely-cited figure - not a fabricated number.
export const LIVES_PER_DONATION = 3;

/** The highest tier earned for a given completed-donation count. */
export function getReputationTier(totalDonations: number): ReputationTier {
  const n = Number.isFinite(totalDonations) ? Math.max(0, Math.floor(totalDonations)) : 0;
  let tier = REPUTATION_TIERS[0];
  for (const t of REPUTATION_TIERS) {
    if (n >= t.min) tier = t;
    else break;
  }
  return tier;
}

/** The next tier up, or null if already at the top. */
export function nextReputationTier(totalDonations: number): ReputationTier | null {
  const current = getReputationTier(totalDonations);
  const idx = REPUTATION_TIERS.findIndex((t) => t.key === current.key);
  return REPUTATION_TIERS[idx + 1] ?? null;
}

export interface ReputationProgress {
  current: ReputationTier;
  next: ReputationTier | null;
  /** Donations still needed to reach `next` (0 when maxed). */
  remaining: number;
  /** Progress through the current band in [0, 1] (1 when maxed). */
  fraction: number;
}

/** Goal-gradient math: how far into the current tier, and what is left to the next. */
export function reputationProgress(totalDonations: number): ReputationProgress {
  const n = Number.isFinite(totalDonations) ? Math.max(0, Math.floor(totalDonations)) : 0;
  const current = getReputationTier(n);
  const next = nextReputationTier(n);
  if (!next) {
    return { current, next: null, remaining: 0, fraction: 1 };
  }
  const span = next.min - current.min;
  const done = n - current.min;
  return {
    current,
    next,
    remaining: Math.max(0, next.min - n),
    fraction: span > 0 ? Math.min(1, Math.max(0, done / span)) : 0,
  };
}

/** Estimated lives a donor has helped, for a motivational stat line. */
export function livesHelped(totalDonations: number): number {
  const n = Number.isFinite(totalDonations) ? Math.max(0, Math.floor(totalDonations)) : 0;
  return n * LIVES_PER_DONATION;
}
