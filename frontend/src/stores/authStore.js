import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI } from '../services/api.service';

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

      logout: async () => {
        // Hit the backend so it can clear cookies, null the refresh-token jti
        // in Mongo, and push the access token's jti onto the revocation list.
        // Swallow errors: a network failure shouldn't strand the user in a
        // "logged in" UI; the cookies/refresh-token will expire on their own.
        try {
          await authAPI.logout();
        } catch (e) {
          // intentionally ignored
        }
        set({ user: null, isAuthenticated: false });
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
