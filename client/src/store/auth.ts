import { create } from 'zustand';
import type { AuthUser } from '../lib/auth';
import { clearAllOptimisticFromStorage } from '@/features/incidents/useFeedIncidents';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  error: null,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  logout: () => {
    // Clear optimistic incidents from sessionStorage on logout
    clearAllOptimisticFromStorage();
    set({ user: null });
  },
}));
