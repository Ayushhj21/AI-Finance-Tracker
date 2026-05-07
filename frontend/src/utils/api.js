import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
//this will create http requests to backend
// In dev, leave VITE_API_URL unset and the Vite proxy handles forwarding /api -> backend.
// In prod, Vercel provides VITE_API_URL=https://<your-backend>.onrender.com/api
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(" REQUEST INTERCEPTOR - Outgoing Request");
    console.log("  URL:", config.method.toUpperCase(), config.baseURL + config.url);
    const token = useAuthStore.getState().getToken();
    console.log("  Access Token:", token ? `${token.substring(0, 20)}...` : "NO TOKEN");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log("  Authorization header added");
    } else {
      console.log("  No token available, request will be unauthenticated");
    }
    return config;
  },
  (error) => {
    console.error("REQUEST INTERCEPTOR ERROR:", error);
    return Promise.reject(error);
  }
);

//originalRequest._retry = true; this is used to avoid infinite loops
// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log("RESPONSE INTERCEPTOR - Success");
    console.log("  URL:", response.config.method.toUpperCase(), response.config.url);
    console.log("  Status:", response.status);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    console.log("RESPONSE INTERCEPTOR - Error Detected");
    console.log("  URL:", originalRequest?.method?.toUpperCase(), originalRequest?.url);
    console.log("  Status:", error.response?.status);

    // Skip the refresh-and-redirect dance for auth endpoints — their 401s mean
    // "wrong credentials / bad refresh token", not "your session expired".
    // Letting those bubble up to the page lets toast.error('...') actually render.
    if (error.response?.status === 401
        && !originalRequest._retry
        && !originalRequest.url?.includes('/auth/')) {
      console.log(" 401 Unauthorized - Attempting token refresh...");
      originalRequest._retry = true;

      try {
        const refreshToken = useAuthStore.getState().getRefreshToken();
        
        if (!refreshToken) {
          console.log(" No refresh token available, logging out");
          useAuthStore.getState().logout();
          window.location.href = '/login';
          return Promise.reject(error);
        }

        console.log("  Refresh Token:", refreshToken.substring(0, 20) + "...");
        console.log("  Sending refresh request to /api/auth/refresh");
        const response = await axios.post(
          `${import.meta.env.VITE_API_URL || '/api'}/auth/refresh`,
          { refreshToken }
        );
        
        console.log("  Refresh successful!");
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;
        console.log("   New Access Token:", accessToken.substring(0, 20) + "...");
        console.log("   New Refresh Token:", newRefreshToken.substring(0, 20) + "...");
        
        useAuthStore.getState().setAuth(
          useAuthStore.getState().user,
          accessToken,
          newRefreshToken
        );
        console.log("   Tokens updated in store");

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        console.log("   Retrying original request...");
        return api(originalRequest);
      } catch (refreshError) {
        console.log("   Refresh token failed:", refreshError.response?.data?.message);
        console.log("   Logging out and redirecting to login");
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    console.log("  Error not handled by interceptor, passing through");
    return Promise.reject(error);
  }
);

export default api;