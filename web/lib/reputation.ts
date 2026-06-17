// lib/reputation.ts - donor reputation program, ported 1:1 from the app so web
// and mobile show identical tiers. Pure, dependency-free, server-trustworthy
// (total_donations is incremented only by the complete_blood_donation RPC).

export type ReputationTone = "muted" | "brand" | "warning" | "success";

export interface ReputationTier {
  key: "new" | "lifesaver" | "regular" | "champion" | "guardian" | "legend";
  label: string;
  min: number;
  tone: ReputationTone;
  blurb: string;
}

export const REPUTATION_TIERS: readonly ReputationTier[] = [
  { key: "new", label: "New donor", min: 0, tone: "muted", blurb: "Welcome. Your first donation is the hardest and the most needed." },
  { key: "lifesaver", label: "Lifesaver", min: 1, tone: "brand", blurb: "You have given blood. One donation can help up to three people." },
  { key: "regular", label: "Regular", min: 3, tone: "brand", blurb: "A dependable donor. Recipients can count on you." },
  { key: "champion", label: "Champion", min: 10, tone: "warning", blurb: "Ten donations and counting. You show up when it matters." },
  { key: "guardian", label: "Guardian", min: 25, tone: "success", blurb: "A pillar of the community. Twenty-five lives of impact and more." },
  { key: "legend", label: "Legend", min: 50, tone: "success", blurb: "Fifty donations. The rarest, most trusted tier there is." },
] as const;

export const LIVES_PER_DONATION = 3;

export function getReputationTier(totalDonations: number): ReputationTier {
  const n = Number.isFinite(totalDonations) ? Math.max(0, Math.floor(totalDonations)) : 0;
  let tier = REPUTATION_TIERS[0];
  for (const t of REPUTATION_TIERS) {
    if (n >= t.min) tier = t;
    else break;
  }
  return tier;
}

export function nextReputationTier(totalDonations: number): ReputationTier | null {
  const current = getReputationTier(totalDonations);
  const idx = REPUTATION_TIERS.findIndex((t) => t.key === current.key);
  return REPUTATION_TIERS[idx + 1] ?? null;
}

export interface ReputationProgress {
  current: ReputationTier;
  next: ReputationTier | null;
  remaining: number;
  fraction: number;
}

export function reputationProgress(totalDonations: number): ReputationProgress {
  const n = Number.isFinite(totalDonations) ? Math.max(0, Math.floor(totalDonations)) : 0;
  const current = getReputationTier(n);
  const next = nextReputationTier(n);
  if (!next) return { current, next: null, remaining: 0, fraction: 1 };
  const span = next.min - current.min;
  const done = n - current.min;
  return {
    current,
    next,
    remaining: Math.max(0, next.min - n),
    fraction: span > 0 ? Math.min(1, Math.max(0, done / span)) : 0,
  };
}

export function livesHelped(totalDonations: number): number {
  const n = Number.isFinite(totalDonations) ? Math.max(0, Math.floor(totalDonations)) : 0;
  return n * LIVES_PER_DONATION;
}
