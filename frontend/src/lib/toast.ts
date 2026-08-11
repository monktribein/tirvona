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

const publish = (
  kind: ToastKind,
  message: string,
  options: ToastOptions = {},
) => {
  if (typeof window === "undefined" || !message.trim()) return "";

  const id = crypto.randomUUID();
  window.dispatchEvent(
    new CustomEvent<ToastEventDetail>(TOAST_EVENT, {
      detail: { id, kind, message: message.trim(), ...options },
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

