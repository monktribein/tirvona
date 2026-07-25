import axios from 'axios';

// Single source of truth for the API base URL.
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const TOKEN_KEY = 'ab_token';

// Shared axios instance. All app requests go through this so auth headers,
// base URL, and error handling live in one place.
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
});

// Attach the bearer token (if present) to every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401 (expired/invalid token) clear the session so the app can redirect to login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      delete api.defaults.headers.common.Authorization;
    }
    return Promise.reject(error);
  }
);

// Normalise an axios error into a human-readable message.
export const getErrorMessage = (err: unknown, fallback = 'Something went wrong. Please try again.') => {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.message || err.message || fallback;
  }
  return fallback;
};

export default api;
