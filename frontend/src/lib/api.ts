import axios from "axios";
import { toast } from "./toast";
import { tUi } from "../contexts/LanguageContext";

declare module "axios" {
  export interface AxiosRequestConfig {
    skipToast?: boolean;
  }
}

export const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
)
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

export const TOKEN_KEY = "ab_token";

/** The bearer token a request went out with, if any. */
const sentToken = (config: any): string | null => {
  const headers = config?.headers;
  const value =
    typeof headers?.get === "function"
      ? headers.get("Authorization")
      : headers?.Authorization;
  const match = typeof value === "string" ? /^Bearer\s+(.+)$/i.exec(value) : null;
  return match ? match[1] : null;
};

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 20_000,
  headers: { Accept: "application/json" },
});

api.interceptors.request.use((config) => {
  const sessionKey = "tirvona_session_id";
  let sessionId = localStorage.getItem(sessionKey);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(sessionKey, sessionId);
  }
  config.headers = config.headers || {};
  config.headers["X-Session-Id"] = sessionId;
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const method = config.method?.toLowerCase();
  if (method && ["post", "put", "patch", "delete"].includes(method)) {
    if (!config.headers["Idempotency-Key"] && !config.headers["idempotency-key"]) {
      config.headers["Idempotency-Key"] =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `idemp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${Math.random().toString(36).slice(2, 10)}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const method = response.config.method?.toLowerCase();
    const skipToast = response.config.skipToast === true;
    if (!skipToast && method && ["post", "put", "patch", "delete"].includes(method)) {
      const message = response.data?.message;
      const requestUrl = response.config.url || "";
      const normalizedMessage =
        typeof message === "string" ? message.trim().toLowerCase() : "";
      const isPaymentSetup = /\/payment\/order(?:\?|$)/.test(requestUrl);
      const isPendingPayment =
        /\b(held|hold|complete payment|awaiting payment|payment pending)\b/.test(
          normalizedMessage,
        );

      if (!isPaymentSetup && typeof message === "string" && message.trim()) {
        if (isPendingPayment) {
          toast.info(message, { title: "Payment required" });
        } else {
          toast.success(message);
        }
      }
    }
    return response;
  },
  (error) => {
    if (error?.response?.status === 401) {
      const saved = localStorage.getItem(TOKEN_KEY);
      if (!saved) {
        // No saved login at all (another tab signed out or its session
        // expired). A tab still showing an account must drop it, or it keeps
        // polling with no token and gets a 401 every time.
        window.dispatchEvent(new Event("tirvona:session-ended"));
      } else if (sentToken(error.config) === saved) {
        localStorage.removeItem(TOKEN_KEY);
        delete api.defaults.headers.common.Authorization;
        window.dispatchEvent(new Event("tirvona:unauthorized"));
      }
      // Otherwise the request went out before a newer login was saved; that
      // newer login must not be thrown away.
    }
    const skipToast = error?.config?.skipToast === true;
    if (!skipToast && error?.code !== "ERR_CANCELED") {
      const message =
        error?.response?.data?.message ||
        (error?.code === "ECONNABORTED"
          ? "The request took too long. Please try again."
          : error?.message === "Network Error"
            ? "Unable to connect to Tirvona. Check your connection and try again."
            : "Something went wrong. Please try again.");
      toast.error(Array.isArray(message) ? message.join(" · ") : String(message));
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
    return Array.isArray(message)
      ? message.map((item) => tUi(String(item))).join(" · ")
      : tUi(String(message));
  }
  return tUi(fallback);
};

export default api;
