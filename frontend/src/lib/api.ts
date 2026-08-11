import axios from "axios";
import { toast } from "./toast";
import { tUi } from "../contexts/LanguageContext";

declare module "axios" {
  export interface AxiosRequestConfig {
    /**
     * Suppress the automatic success/error toast for this request.
     *
     * A request-config flag rather than an HTTP header: whether the UI shows a
     * toast is no business of the server's, and sending it as `X-Skip-Toast`
     * meant every such call had to be named in the API's CORS
     * `Access-Control-Allow-Headers` or the browser rejected the preflight.
     * Use it for background polling and live re-pricing, where a transient
     * failure is not something to interrupt anyone over.
     */
    skipToast?: boolean;
  }
}

// Single source of truth for the API base URL.
export const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
)
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

export const TOKEN_KEY = "ab_token";

// Shared axios instance. All app requests go through this so auth headers,
// base URL, and error handling live in one place.
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 20_000,
  headers: { Accept: "application/json" },
});

// Attach the bearer token (if present) to every request.
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
  return config;
});

// On 401 (expired/invalid token) clear the session so the app can redirect to login.
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

      // A reservation hold or gateway order is not a confirmed booking. Never
      // present either intermediate step as a completed or successful payment.
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
    if (error?.response?.status === 401 && localStorage.getItem(TOKEN_KEY)) {
      localStorage.removeItem(TOKEN_KEY);
      delete api.defaults.headers.common.Authorization;
      window.dispatchEvent(new Event("tirvona:unauthorized"));
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

// Normalise an axios error into a human-readable message.
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
