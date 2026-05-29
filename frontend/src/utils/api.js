import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

// Auth tokens now live in httpOnly cookies the server sets on login/register/refresh.
// We never touch them from JS. Three things changed vs the previous Bearer-token flow:
//   1. withCredentials: true — tells axios to send/receive cookies cross-origin.
//   2. We no longer attach Authorization headers; the browser sends accessToken
//      automatically on every API request and refreshToken only on /auth/refresh.
//   3. On state-changing methods we attach X-CSRF-Token, read from the non-httpOnly
//      csrfToken cookie. This is the "double-submit" defense — a cross-site
//      attacker can fire requests but can't read our csrf cookie, so they can't
//      construct the matching header.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true
});

const STATE_CHANGING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

const readCsrfCookie = () => {
  const match = document.cookie.match(/(?:^|;\s*)csrfToken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

api.interceptors.request.use((config) => {
  if (STATE_CHANGING_METHODS.has(config.method?.toLowerCase())) {
    const csrf = readCsrfCookie();
    if (csrf) config.headers['X-CSRF-Token'] = csrf;
  }
  return config;
});

// Coalesce concurrent 401s into a single refresh call. Otherwise every in-flight
// request races to /auth/refresh and rotation invalidates all but the first.
let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
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
          .finally(() => { refreshPromise = null; });

        await refreshPromise;
        // Server rotated cookies including csrfToken; re-read it for the retried request.
        if (STATE_CHANGING_METHODS.has(originalRequest.method?.toLowerCase())) {
          const csrf = readCsrfCookie();
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
