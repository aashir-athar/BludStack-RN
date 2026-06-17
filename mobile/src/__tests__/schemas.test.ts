// The zod schemas are the client-side mirror of the server contract. These tests
// lock the validation that users feel directly: the email/OTP gates, the donor
// age window (18-65, recipients exempt), and the post-request bounds.
import { describe, it, expect } from '@jest/globals';
import {
  emailSchema,
  otpSchema,
  requestSchema,
  onboardingSchema,
} from '@/schemas';

// Build a YYYY-MM-DD date-of-birth for someone of a given age, using a mid-year
// day so it never sits on a birthday boundary regardless of when the test runs.
function dobForAge(age: number): string {
  const year = new Date().getFullYear() - age;
  return `${year}-06-15`;
}

const baseProfile = {
  full_name: 'Imran Qureshi',
  gender: 'Male' as const,
  blood_group: 'O-' as const,
  phone: '+92 300 1234567',
  whatsapp_available: true,
  medical_conditions: [],
  share_medical_history: false,
  is_available_to_donate: true,
};

describe('emailSchema', () => {
  it('accepts a valid email and trims it', () => {
    const r = emailSchema.safeParse({ email: '  donor@bludstack.app ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('donor@bludstack.app');
  });
  it('rejects a malformed email', () => {
    expect(emailSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
  });
});

describe('otpSchema', () => {
  it('accepts exactly six digits', () => {
    expect(otpSchema.safeParse({ code: '123456' }).success).toBe(true);
  });
  it.each(['12345', '1234567', '12 34 56', 'abcdef'])('rejects %p', (code) => {
    expect(otpSchema.safeParse({ code }).success).toBe(false);
  });
});

describe('onboardingSchema donor age gate', () => {
  it('lets a recipient onboard with no date of birth', () => {
    const r = onboardingSchema.safeParse({
      ...baseProfile,
      role: 'recipient',
      date_of_birth: null,
    });
    expect(r.success).toBe(true);
  });

  it('accepts a donor inside the 18-65 window', () => {
    const r = onboardingSchema.safeParse({
      ...baseProfile,
      role: 'donor',
      date_of_birth: dobForAge(30),
    });
    expect(r.success).toBe(true);
  });

  it.each([10, 17, 66, 80])('rejects a donor aged %i', (age) => {
    const r = onboardingSchema.safeParse({
      ...baseProfile,
      role: 'donor',
      date_of_birth: dobForAge(age),
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('date_of_birth'))).toBe(true);
    }
  });

  it('clears an empty phone to null', () => {
    const r = onboardingSchema.safeParse({
      ...baseProfile,
      role: 'recipient',
      date_of_birth: null,
      phone: '   ',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBeNull();
  });
});

describe('requestSchema', () => {
  const valid = {
    blood_group: 'A+' as const,
    urgency: 'critical' as const,
    units_needed: 2,
    hospital_name: 'Shaukat Khanum',
    hospital_address: 'Johar Town, Lahore',
    latitude: 31.46,
    longitude: 74.26,
    notes: 'Surgery at 6pm.',
  };

  it('accepts a well-formed request', () => {
    expect(requestSchema.safeParse(valid).success).toBe(true);
  });

  it.each([0, 11, -1])('rejects units_needed = %i', (units_needed) => {
    expect(requestSchema.safeParse({ ...valid, units_needed }).success).toBe(false);
  });

  it('rejects a note longer than 280 chars', () => {
    expect(requestSchema.safeParse({ ...valid, notes: 'x'.repeat(281) }).success).toBe(false);
  });

  it('requires a hospital name', () => {
    expect(requestSchema.safeParse({ ...valid, hospital_name: '' }).success).toBe(false);
  });
});
