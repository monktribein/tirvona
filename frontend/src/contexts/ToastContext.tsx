import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  TOAST_EVENT,
  toast,
  type ToastEventDetail,
  type ToastKind,
  type ToastOptions,
} from "../lib/toast";

type ToastItem = ToastEventDetail & { createdAt: number };

type ToastContextValue = {
  show: (kind: ToastKind, message: string, options?: ToastOptions) => string;
  success: typeof toast.success;
  error: typeof toast.error;
  warning: typeof toast.warning;
  info: typeof toast.info;
  dismiss: (id: string) => void;
  clear: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const styles: Record<ToastKind, { icon: typeof Info; iconBox: string; iconColor: string; accent: string; label: string }> = {
  success: {
    icon: CheckCircle2,
    iconBox: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    accent: "border-emerald-200 border-l-emerald-500 dark:border-emerald-900 dark:border-l-emerald-500",
    label: "Success",
  },
  error: {
    icon: AlertCircle,
    iconBox: "bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400",
    iconColor: "text-red-600 dark:text-red-400",
    accent: "border-red-200 border-l-red-500 dark:border-red-900 dark:border-l-red-500",
    label: "Something went wrong",
  },
  warning: {
    icon: TriangleAlert,
    iconBox: "bg-orange-50 text-[#D97706] dark:bg-orange-950/60 dark:text-orange-400",
    iconColor: "text-[#D97706] dark:text-orange-400",
    accent: "border-orange-200 border-l-[#D97706] dark:border-orange-900 dark:border-l-orange-500",
    label: "Please note",
  },
  info: {
    icon: Info,
    iconBox: "bg-blue-50 text-[#F28C28] dark:bg-blue-950/60 dark:text-amber-400",
    iconColor: "text-[#F28C28] dark:text-amber-400",
    accent: "border-amber-200 border-l-[#F28C28] dark:border-slate-700 dark:border-l-[#F28C28]",
    label: "Tirvona",
  },
};

const MAX_VISIBLE = 4;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const clear = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current.clear();
    setItems([]);
  }, []);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastEventDetail>).detail;
      if (!detail?.message) return;

      setItems((current) => {
        const duplicate = current.find(
          (item) => item.kind === detail.kind && item.message === detail.message,
        );
        if (duplicate && Date.now() - duplicate.createdAt < 1200) return current;
        return [...current, { ...detail, createdAt: Date.now() }].slice(-MAX_VISIBLE);
      });

      const duration = Math.max(2000, detail.duration ?? (detail.kind === "error" ? 6000 : 4200));
      timers.current.set(
        detail.id,
        window.setTimeout(() => dismiss(detail.id), duration),
      );
    };

    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      timers.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, [dismiss]);

  const value = useMemo<ToastContextValue>(
    () => ({
      show: (kind, message, options) => toast[kind](message, options),
      success: toast.success,
      error: toast.error,
      warning: toast.warning,
      info: toast.info,
      dismiss,
      clear,
    }),
    [clear, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div
            className="pointer-events-none fixed right-3 top-3 z-[9999] flex flex-col items-end gap-1.5 sm:right-5 sm:top-5"
            aria-live="polite"
            aria-atomic="false"
          >
            <AnimatePresence initial={false} mode="popLayout">
              {items.map((item) => {
                const style = styles[item.kind];
                const Icon = style.icon;
                // Only the headline: the title when there is one, otherwise the message itself.
                const headline = item.title || item.message || style.label;
                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: 40, scale: 0.97 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 40, scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 430, damping: 32 }}
                    role={item.kind === "error" ? "alert" : "status"}
                    title={item.title ? item.message : undefined}
                    className={`pointer-events-auto flex w-fit max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-lg border border-l-4 bg-white py-1.5 pl-2.5 pr-1.5 shadow-[0_6px_18px_rgba(11,25,44,0.16)] sm:max-w-[360px] dark:bg-[#0B192C] ${style.accent}`}
                  >
                    <Icon size={16} strokeWidth={2.4} className={`shrink-0 ${style.iconColor}`} />
                    <p className="min-w-0 truncate text-[13px] font-bold leading-5 text-[#0B192C] dark:text-white">
                      {headline}
                    </p>
                    <button
                      type="button"
                      onClick={() => dismiss(item.id)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                      aria-label="Dismiss notification"
                    >
                      <X size={13} />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
};
