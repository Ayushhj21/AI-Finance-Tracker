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
      // csrfToken is delivered in the response body of login/register/refresh/me
      // because the cross-site cookie set by the backend (Render) isn't readable
      // by JS on the frontend origin (Vercel). The axios request interceptor
      // pulls it from here and attaches it as X-CSRF-Token.
      csrfToken: null,

      setAuth: (user) => {
        set({ user, isAuthenticated: true });
      },

      setCsrfToken: (csrfToken) => {
        set({ csrfToken });
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
        set({ user: null, isAuthenticated: false, csrfToken: null });
        localStorage.clear();
      },

      getUser: () => get().user
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        csrfToken: state.csrfToken
      })
    }
  )
);
