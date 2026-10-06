export type UnitPreference = 'kg' | 'lb';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  unit_preference: UnitPreference;
  height_cm?: number;
  weight_kg?: number;
  target_weight_kg?: number;
  gender?: 'male' | 'female';
  birth_year?: number;
  activity_level?: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  expires_in: number;
  user: UserProfile;
}
