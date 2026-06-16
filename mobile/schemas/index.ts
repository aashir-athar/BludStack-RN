// schemas/index.ts
// Zod schemas + inferred types for every form (react-hook-form resolvers). Client
// validation mirrors the server contract; the server stays authoritative. Donor
// age gate (18-65) is enforced here AND in the backend RPC.
import { z } from 'zod';
import { BLOOD_GROUPS, GENDER_OPTIONS, URGENCY_LEVELS } from '@/constants/BloodData';
import { computeAge, DONOR_MIN_AGE, DONOR_MAX_AGE } from '@/utils/age';

// ── Auth ──────────────────────────────────────────────────────────────────────
export const emailSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
});
export type EmailForm = z.infer<typeof emailSchema>;

export const otpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});
export type OtpForm = z.infer<typeof otpSchema>;

// ── Role / profile ──────────────────────────────────────────────────────────
export const roleSchema = z.enum(['donor', 'recipient', 'both']);
export type Role = z.infer<typeof roleSchema>;

const profileShape = {
  role: roleSchema,
  full_name: z.string().trim().min(2, 'Tell us your name'),
  gender: z.enum(GENDER_OPTIONS),
  date_of_birth: z.string().nullable(),
  blood_group: z.enum(BLOOD_GROUPS),
  // Empty / whitespace means "no phone" -> null (clearing the field is valid);
  // a non-empty value must look like a phone number.
  phone: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().min(7, 'Enter a valid phone number').nullable(),
  ),
  whatsapp_available: z.boolean(),
  medical_conditions: z.array(z.string()),
  share_medical_history: z.boolean(),
  is_available_to_donate: z.boolean(),
};

// Donor / both must have an age in the 18-65 window. Recipients have no age gate.
function donorAgeOk(d: { role: Role; date_of_birth: string | null }): boolean {
  if (d.role === 'recipient') return true;
  const age = computeAge(d.date_of_birth);
  return age !== null && age >= DONOR_MIN_AGE && age <= DONOR_MAX_AGE;
}
const ageGate = {
  message: `Donors must be between ${DONOR_MIN_AGE} and ${DONOR_MAX_AGE}`,
  path: ['date_of_birth'],
};

export const onboardingSchema = z.object(profileShape).refine(donorAgeOk, ageGate);
export type OnboardingForm = z.infer<typeof onboardingSchema>;

export const editProfileSchema = z.object(profileShape).refine(donorAgeOk, ageGate);
export type EditProfileForm = z.infer<typeof editProfileSchema>;

// ── Blood request ─────────────────────────────────────────────────────────────
export const requestSchema = z.object({
  blood_group: z.enum(BLOOD_GROUPS),
  urgency: z.enum(URGENCY_LEVELS),
  units_needed: z.number().int().min(1, 'At least one unit').max(10, 'Up to 10 units'),
  hospital_name: z.string().trim().min(2, 'Where is the hospital?'),
  hospital_address: z.string().trim().min(2, 'Add the hospital address'),
  latitude: z.number(),
  longitude: z.number(),
  notes: z.string().trim().max(280, 'Keep the note short').optional(),
});
export type RequestForm = z.infer<typeof requestSchema>;
