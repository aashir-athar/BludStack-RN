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

// Beyond 50 km: switch to country-wide search (never cross borders)
export const COUNTRY_SEARCH_THRESHOLD_KM = 50;

// Approximate bounding boxes per country code
export const COUNTRY_BOUNDS: Record<string, {
  latMin: number; latMax: number; lonMin: number; lonMax: number; name: string;
}> = {
  PK: { latMin: 23.5, latMax: 37.1, lonMin: 60.8, lonMax: 77.8,  name: 'Pakistan' },
  IN: { latMin: 8.0,  latMax: 37.1, lonMin: 68.0, lonMax: 97.4,  name: 'India' },
  BD: { latMin: 20.6, latMax: 26.6, lonMin: 88.0, lonMax: 92.7,  name: 'Bangladesh' },
  US: { latMin: 24.4, latMax: 49.4, lonMin:-125.0, lonMax:-66.9, name: 'United States' },
  GB: { latMin: 49.9, latMax: 60.9, lonMin: -8.6,  lonMax:  1.8, name: 'United Kingdom' },
  SA: { latMin: 16.3, latMax: 32.2, lonMin: 36.4,  lonMax: 55.7, name: 'Saudi Arabia' },
  AE: { latMin: 22.6, latMax: 26.1, lonMin: 51.5,  lonMax: 56.4, name: 'UAE' },
  NG: { latMin:  4.2, latMax: 13.9, lonMin:  2.7,  lonMax: 14.7, name: 'Nigeria' },
  EG: { latMin: 22.0, latMax: 31.7, lonMin: 24.7,  lonMax: 37.2, name: 'Egypt' },
  ZA: { latMin:-34.8, latMax:-22.1, lonMin: 16.4,  lonMax: 32.9, name: 'South Africa' },
};

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
