import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

// Auth tokens live in httpOnly cookies the server sets on login/register/refresh.
// We never touch them from JS. Notes on the cross-site setup (Vercel <-> Render):
//   1. withCredentials: true — tells axios to send/receive cookies cross-origin.
//   2. No Authorization header — the browser sends accessToken automatically and
//      refreshToken only on /auth/refresh (path-scoped cookie).
//   3. CSRF token is delivered to JS via the response body (login/register/
//      refresh/me return it), NOT read from document.cookie. The csrf cookie
//      is owned by the backend origin (Render), so JS on the Vercel origin
//      can't see it. The cookie still flows back to the backend on requests
//      (withCredentials), so the server-side double-submit check works.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true
});

const STATE_CHANGING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

api.interceptors.request.use((config) => {
  if (STATE_CHANGING_METHODS.has(config.method?.toLowerCase())) {
    const csrf = useAuthStore.getState().csrfToken;
    if (csrf) config.headers['X-CSRF-Token'] = csrf;
  }
  return config;
});

// Coalesce concurrent 401s into a single refresh call. Otherwise every in-flight
// request races to /auth/refresh and rotation invalidates all but the first.
let refreshPromise = null;

// Any auth response that ships a fresh csrfToken (login/register/refresh/me)
// updates the store so subsequent state-changing requests can echo it.
const syncCsrf = (response) => {
  const token = response?.data?.csrfToken;
  if (token) useAuthStore.getState().setCsrfToken(token);
};

api.interceptors.response.use(
  (response) => {
    syncCsrf(response);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Skip the refresh-and-redirect dance for auth endpoints — their 401s mean
    // "wrong credentials / bad refresh token", not "session expired".
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/')
    ) {
      originalRequest._retry = true;

      try {
        refreshPromise ??= axios
          .post(`${import.meta.env.VITE_API_URL || '/api'}/auth/refresh`, {}, { withCredentials: true })
          .then((res) => { syncCsrf(res); return res; })
          .finally(() => { refreshPromise = null; });

        await refreshPromise;
        // Server rotated csrf; re-read from the store (just populated above).
        if (STATE_CHANGING_METHODS.has(originalRequest.method?.toLowerCase())) {
          const csrf = useAuthStore.getState().csrfToken;
          if (csrf) originalRequest.headers['X-CSRF-Token'] = csrf;
        }
        return api(originalRequest);
      } catch (refreshError) {
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
