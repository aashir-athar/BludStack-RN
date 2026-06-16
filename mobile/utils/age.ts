// utils/age.ts
// Pure age helpers shared by the auth store and zod schemas (no RN/Supabase deps).

/** Whole years from a date-of-birth string, or null if absent/invalid. */
export function computeAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/** Donor eligibility window (server-enforced): 18-65 inclusive. */
export const DONOR_MIN_AGE = 18;
export const DONOR_MAX_AGE = 65;

export function isDonorAgeEligible(dob: string | null | undefined): boolean {
  const age = computeAge(dob);
  return age !== null && age >= DONOR_MIN_AGE && age <= DONOR_MAX_AGE;
}

/** Legacy helper name kept for the donor-age gate (>= 18). */
export function canDonateByAge(dob: string | null | undefined): boolean {
  const age = computeAge(dob);
  return age !== null && age >= DONOR_MIN_AGE;
}
