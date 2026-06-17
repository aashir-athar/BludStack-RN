// lib/age.ts - pure age helpers shared by the auth store and zod schemas.

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

export const DONOR_MIN_AGE = 18;
export const DONOR_MAX_AGE = 65;

export function isDonorAgeEligible(dob: string | null | undefined): boolean {
  const age = computeAge(dob);
  return age !== null && age >= DONOR_MIN_AGE && age <= DONOR_MAX_AGE;
}
