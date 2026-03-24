import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, token, refreshToken) => {
        set({
          user,
          token,
          refreshToken,
          isAuthenticated: true
        });
      },

      updateUser: (userData) => {
        set({ user: { ...get().user, ...userData } });
      },

      logout: () => {
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false
        });
        localStorage.clear();
      },

      getUser: () => get().user,
      getToken: () => get().token,
      getRefreshToken: () => get().refreshToken
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ //fields which is given here will be stored in the local-storage
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);