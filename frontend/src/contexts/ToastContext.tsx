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

const styles: Record<ToastKind, { icon: typeof Info; iconBox: string; label: string }> = {
  success: {
    icon: CheckCircle2,
    iconBox: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400",
    label: "Success",
  },
  error: {
    icon: AlertCircle,
    iconBox: "bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400",
    label: "Something went wrong",
  },
  warning: {
    icon: TriangleAlert,
    iconBox: "bg-orange-50 text-[#D97706] dark:bg-orange-950/60 dark:text-orange-400",
    label: "Please note",
  },
  info: {
    icon: Info,
    iconBox: "bg-blue-50 text-[#0A4DA6] dark:bg-blue-950/60 dark:text-blue-400",
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
            className="pointer-events-none fixed inset-x-0 top-3 z-[9999] flex flex-col items-center gap-2 px-3 sm:top-5"
            aria-live="polite"
            aria-atomic="false"
          >
            <AnimatePresence initial={false} mode="popLayout">
              {items.map((item) => {
                const style = styles[item.kind];
                const Icon = style.icon;
                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: -34, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -18, scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 430, damping: 32 }}
                    role={item.kind === "error" ? "alert" : "status"}
                    className="pointer-events-auto relative w-fit min-w-[280px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-[24px] border border-slate-200 bg-white/95 shadow-[0_8px_24px_rgba(11,25,44,0.12)] backdrop-blur-xl sm:min-w-[320px] sm:max-w-[430px] dark:border-slate-700 dark:bg-[#0B192C]/95"
                  >
                    <div className="flex items-center gap-2.5 px-4 py-2.5">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.iconBox}`}>
                        <Icon size={17} strokeWidth={2.3} />
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="text-[13px] font-extrabold leading-5 text-[#0B192C] dark:text-white">
                          {item.title || style.label}
                        </p>
                        <p className="mt-0.5 text-xs font-medium leading-5 text-slate-600 dark:text-slate-300">
                          {item.message}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => dismiss(item.id)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                        aria-label="Dismiss notification"
                      >
                        <X size={15} />
                      </button>
                    </div>
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
