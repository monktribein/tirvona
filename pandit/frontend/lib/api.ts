import axios from "axios";

declare module "axios" {
  export interface AxiosRequestConfig {
    skipToast?: boolean;
  }
}

export const API_BASE_URL = "";

export const TOKEN_KEY = "ab_token";

const api = axios.create({
  baseURL: "/api",
  timeout: 20_000,
  headers: { Accept: "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const sessionKey = "tirvona_session_id";
    let sessionId = localStorage.getItem(sessionKey);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem(sessionKey, sessionId);
    }
    if (config.headers) {
      config.headers["X-Session-Id"] = sessionId;
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (
      typeof window !== "undefined" &&
      error?.response?.status === 401 &&
      localStorage.getItem(TOKEN_KEY)
    ) {
      localStorage.removeItem(TOKEN_KEY);
      delete api.defaults.headers.common.Authorization;
      window.dispatchEvent(new Event("tirvona:unauthorized"));
    }
    return Promise.reject(error);
  },
);

export const getErrorMessage = (
  err: unknown,
  fallback = "Something went wrong. Please try again.",
) => {
  if (axios.isAxiosError(err)) {
    const message = err.response?.data?.message || err.message || fallback;
    return Array.isArray(message) ? message.join(" · ") : String(message);
  }
  return fallback;
};

export default api;
