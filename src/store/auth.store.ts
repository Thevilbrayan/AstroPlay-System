import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { pb } from '../lib/pocketbase';
import { User } from '../types';

interface AuthState {
  user: User | null;
  isValid: boolean;
  setAuth: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isValid: pb.authStore.isValid,
      setAuth: (user) => set({ user, isValid: true }),
      logout: () => {
        pb.authStore.clear();
        set({ user: null, isValid: false });
      },
    }),
    { name: 'astroplay-auth' }
  )
);