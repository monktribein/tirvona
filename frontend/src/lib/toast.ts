import { tUi } from "../contexts/LanguageContext";

export type ToastKind = "success" | "error" | "warning" | "info";

export type ToastOptions = {
  title?: string;
  duration?: number;
};

export type ToastEventDetail = ToastOptions & {
  id: string;
  kind: ToastKind;
  message: string;
};

export const TOAST_EVENT = "tirvona:toast";

const recentByKind = new Map<ToastKind, { id: string; at: number }>();
const OPERATION_DEDUPE_MS = 500;

const publish = (
  kind: ToastKind,
  message: string,
  options: ToastOptions = {},
) => {
  if (typeof window === "undefined" || !message.trim()) return "";

  // API interceptors and page-level handlers can both report the same
  // completed operation with slightly different wording. Treat emissions of
  // the same kind in the same event window as one user-facing toast.
  const recent = recentByKind.get(kind);
  const now = Date.now();
  if (recent && now - recent.at < OPERATION_DEDUPE_MS) return recent.id;

  const id = crypto.randomUUID();
  recentByKind.set(kind, { id, at: now });
  window.dispatchEvent(
    new CustomEvent<ToastEventDetail>(TOAST_EVENT, {
      detail: {
        id,
        kind,
        message: tUi(message.trim()),
        ...options,
        title: options.title ? tUi(options.title) : undefined,
      },
    }),
  );
  return id;
};

export const toast = {
  success: (message: string, options?: ToastOptions) =>
    publish("success", message, options),
  error: (message: string, options?: ToastOptions) =>
    publish("error", message, options),
  warning: (message: string, options?: ToastOptions) =>
    publish("warning", message, options),
  info: (message: string, options?: ToastOptions) =>
    publish("info", message, options),
};
