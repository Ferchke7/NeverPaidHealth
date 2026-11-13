import { create } from 'zustand';
import { UserProfile, UnitPreference } from './types.ts';
import { apiClient } from '../../../shared/api/client.ts';
import { queryClient } from '../../../app/providers/QueryProvider.tsx';

// Clean up legacy localStorage auth token if present
try {
  localStorage.removeItem('neverpaid_auth_v1');
} catch {}

interface AuthState {
  accessToken: string | null;
  user: UserProfile | null;
  unitPreference: UnitPreference;
  isAuthenticated: boolean;
  isInitializing: boolean;
  setAuth: (token: string, user: UserProfile) => void;
  setUnitPreference: (unit: UnitPreference) => void;
  updateUserStats: (stats: Partial<UserProfile>) => void;
  checkSession: () => Promise<boolean>;
  clearSession: () => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  unitPreference: 'kg',
  isAuthenticated: false,
  isInitializing: true,

  setAuth: (token, user) => {
    queryClient.clear();
    set({
      accessToken: token,
      user,
      unitPreference: user.unit_preference || 'kg',
      isAuthenticated: true,
      isInitializing: false,
    });
  },

  setUnitPreference: (unit) =>
    set((state) => ({
      unitPreference: unit,
      user: state.user ? { ...state.user, unit_preference: unit } : null,
    })),

  updateUserStats: (stats) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...stats } : null,
    })),

  checkSession: async () => {
    try {
      const user = await apiClient<UserProfile>('/me');
      set({
        user,
        unitPreference: user.unit_preference || 'kg',
        isAuthenticated: true,
        isInitializing: false,
      });
      return true;
    } catch {
      set({
        user: null,
        isAuthenticated: false,
        isInitializing: false,
      });
      return false;
    }
  },

  clearSession: () => {
    queryClient.clear();
    set({ accessToken: null, user: null, isAuthenticated: false, isInitializing: false });
  },

  logout: async () => {
    try {
      await apiClient('/auth/logout', { method: 'POST' });
    } catch {
      // Local sign-out must also work offline.
    } finally {
      get().clearSession();
    }
  },
}));
