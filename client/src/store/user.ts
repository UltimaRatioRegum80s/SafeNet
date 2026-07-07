import { create } from 'zustand';
import { UserRole } from '../types';

interface UserState {
  currentRole: UserRole | null;
  setCurrentRole: (role: UserRole) => void;
}

export const useUserStore = create<UserState>((set) => ({
  currentRole: null,
  setCurrentRole: (role) => set({ currentRole: role }),
}));
