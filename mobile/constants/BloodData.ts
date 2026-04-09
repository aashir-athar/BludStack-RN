// constants/BloodData.ts

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export type BloodGroup = typeof BLOOD_GROUPS[number];

// Who can donate to whom
export const COMPATIBILITY_MAP: Record<BloodGroup, BloodGroup[]> = {
  'A+':  ['A+', 'AB+'],
  'A-':  ['A+', 'A-', 'AB+', 'AB-'],
  'B+':  ['B+', 'AB+'],
  'B-':  ['B+', 'B-', 'AB+', 'AB-'],
  'AB+': ['AB+'],
  'AB-': ['AB+', 'AB-'],
  'O+':  ['A+', 'B+', 'AB+', 'O+'],
  'O-':  ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
};

// Who can donate to a given recipient
export const DONOR_FOR_RECIPIENT: Record<BloodGroup, BloodGroup[]> = {
  'A+':  ['A+', 'A-', 'O+', 'O-'],
  'A-':  ['A-', 'O-'],
  'B+':  ['B+', 'B-', 'O+', 'O-'],
  'B-':  ['B-', 'O-'],
  'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  'AB-': ['A-', 'B-', 'AB-', 'O-'],
  'O+':  ['O+', 'O-'],
  'O-':  ['O-'],
};

export const GEO_FENCE_RADII_KM = [1, 5, 15, 30, 50] as const;
export const GEO_FENCE_EXPANSION_DELAY_MS = 30_000; // 30 seconds per ring

export const URGENCY_LEVELS = ['critical', 'urgent', 'standard'] as const;
export type UrgencyLevel = typeof URGENCY_LEVELS[number];

export const URGENCY_CONFIG = {
  critical: { label: 'Critical', color: '#FF2D55', icon: '🚨', minutes: 30 },
  urgent:   { label: 'Urgent',   color: '#FFB300', icon: '⚠️', minutes: 120 },
  standard: { label: 'Standard', color: '#00C853', icon: '🩸', minutes: 720 },
};

export const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'] as const;

export const MEDICAL_CONDITIONS = [
  'Hepatitis B',
  'Hepatitis C',
  'HIV/AIDS',
  'Diabetes',
  'Hypertension',
  'Heart Disease',
  'Malaria (recent)',
  'Tuberculosis',
  'Anemia',
  'Sickle Cell',
  'Epilepsy',
  'Blood Thinners',
  'Recent Surgery',
  'Pregnancy',
] as const;

export const MIN_DONATION_GAP_DAYS = 90; // 3 months between donations

export const APP_NAME = 'BludStack';
export const APP_TAGLINE = 'Every drop counts. Every second matters.';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
