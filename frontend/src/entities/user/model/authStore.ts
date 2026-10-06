import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserProfile, UnitPreference } from './types.ts';

interface AuthState {
  accessToken: string | null;
  user: UserProfile | null;
  unitPreference: UnitPreference;
  isAuthenticated: boolean;
  setAuth: (token: string, user: UserProfile) => void;
  setUnitPreference: (unit: UnitPreference) => void;
  updateUserStats: (stats: Partial<UserProfile>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      unitPreference: 'kg',
      isAuthenticated: false,

      setAuth: (token, user) =>
        set({
          accessToken: token,
          user,
          unitPreference: user.unit_preference || 'kg',
          isAuthenticated: true,
        }),

      setUnitPreference: (unit) =>
        set((state) => ({
          unitPreference: unit,
          user: state.user ? { ...state.user, unit_preference: unit } : null,
        })),

      updateUserStats: (stats) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...stats } : null,
        })),

      logout: () =>
        set({
          accessToken: null,
          user: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'neverpaid_auth_v1',
    }
  )
);

