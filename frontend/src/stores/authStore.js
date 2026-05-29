import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Tokens no longer live here — they're in httpOnly cookies the server controls.
// The store only tracks who is logged in for UI gating.
export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,

      setAuth: (user) => {
        set({ user, isAuthenticated: true });
      },

      updateUser: (userData) => {
        set({ user: { ...get().user, ...userData } });
      },

      logout: () => {
        set({ user: null, isAuthenticated: false });
        // Nuke any other persisted store state on logout.
        localStorage.clear();
      },

      getUser: () => get().user
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);
