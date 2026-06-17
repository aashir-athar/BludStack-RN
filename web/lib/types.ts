// lib/types.ts - shared domain shapes for the web app.
import type { BloodGroup, UrgencyLevel } from "./blood-data";
import type { Role } from "./schemas";

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string;
  role: Role;
  gender: string | null;
  date_of_birth: string | null;
  avatar_url: string | null;
  blood_group: BloodGroup;
  phone: string | null;
  whatsapp_available: boolean;
  address: string | null;
  medical_conditions: string[];
  share_medical_history: boolean;
  is_available_to_donate: boolean;
  last_donation_date: string | null;
  total_donations: number;
  is_verified: boolean;
}

export type RequestStatus = "active" | "fulfilled" | "cancelled" | "expired";

export interface BloodRequest {
  id: string;
  recipient_id: string;
  blood_group: BloodGroup;
  urgency: UrgencyLevel;
  units_needed: number;
  units_fulfilled?: number;
  hospital_name: string;
  hospital_address: string;
  latitude: number;
  longitude: number;
  notes: string | null;
  status: RequestStatus;
  created_at: string;
  distanceKm?: number;
}

export type ResponseStatus = "pending" | "accepted" | "declined" | "completed";

export interface RequestResponse {
  id: string;
  request_id: string;
  donor_id: string;
  status: ResponseStatus;
  donor_lat: number | null;
  donor_lon: number | null;
  donor_location_updated_at: string | null;
  donor?: Pick<UserProfile, "id" | "full_name" | "blood_group" | "is_verified" | "total_donations">;
}
