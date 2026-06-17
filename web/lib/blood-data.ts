// lib/blood-data.ts
// Ported 1:1 from the app (mobile/src/constants/BloodData.ts). The compatibility
// matrices are the one thing that must never drift between web, app, and server.

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

// Who a given donor group can give to.
export const COMPATIBILITY_MAP: Record<BloodGroup, BloodGroup[]> = {
  "A+": ["A+", "AB+"],
  "A-": ["A+", "A-", "AB+", "AB-"],
  "B+": ["B+", "AB+"],
  "B-": ["B+", "B-", "AB+", "AB-"],
  "AB+": ["AB+"],
  "AB-": ["AB+", "AB-"],
  "O+": ["A+", "B+", "AB+", "O+"],
  "O-": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
};

// Who can donate to a given recipient group.
export const DONOR_FOR_RECIPIENT: Record<BloodGroup, BloodGroup[]> = {
  "A+": ["A+", "A-", "O+", "O-"],
  "A-": ["A-", "O-"],
  "B+": ["B+", "B-", "O+", "O-"],
  "B-": ["B-", "O-"],
  "AB+": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
  "AB-": ["A-", "B-", "AB-", "O-"],
  "O+": ["O+", "O-"],
  "O-": ["O-"],
};

export const GEO_FENCE_RADII_KM = [1, 5, 15, 30, 50] as const;

export const URGENCY_LEVELS = ["critical", "urgent", "standard"] as const;
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

// Tone maps to a theme token in the UI rather than a raw hex.
export const URGENCY_CONFIG: Record<
  UrgencyLevel,
  { label: string; tone: "danger" | "warning" | "success"; minutes: number }
> = {
  critical: { label: "Critical", tone: "danger", minutes: 30 },
  urgent: { label: "Urgent", tone: "warning", minutes: 120 },
  standard: { label: "Standard", tone: "success", minutes: 720 },
};

export const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"] as const;

export const MEDICAL_CONDITIONS = [
  "Hepatitis B",
  "Hepatitis C",
  "HIV/AIDS",
  "Diabetes",
  "Hypertension",
  "Heart Disease",
  "Malaria (recent)",
  "Tuberculosis",
  "Anemia",
  "Sickle Cell",
  "Epilepsy",
  "Blood Thinners",
  "Recent Surgery",
  "Pregnancy",
] as const;

export const MIN_DONATION_GAP_DAYS = 90; // 3 months between donations

export const APP_NAME = "BludStack";
export const APP_TAGLINE = "Every drop counts. Every second matters.";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
