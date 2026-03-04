import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { pb } from '../lib/pocketbase';
import { User } from '../types';

// Limpiar el token de PocketBase al iniciar la app → fuerza login siempre.
pb.authStore.clear();

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
      isValid: false, // Siempre inicia en false; no se persiste.
      setAuth: (user) => set({ user, isValid: true }),
      logout: () => {
        pb.authStore.clear();
        set({ user: null, isValid: false });
      },
    }),
    {
      name: 'astroplay-auth',
      partialize: (state) => ({ user: state.user }), // Solo persiste user, nunca isValid.
      onRehydrateStorage: () => (state) => {
        // Garantía de seguridad: isValid SIEMPRE arranca en false incluso si
        // localStorage tiene datos viejos con isValid:true (bug de Zustand v5).
        // El usuario debe iniciar sesión explícitamente en cada apertura de la app.
        if (state) state.isValid = false;
      },
    }
  )
);