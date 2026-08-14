import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { API_BASE_URL, TOKEN_KEY } from "../lib/api";
import { humanizeLabel } from "../utils/labels";
import { toast } from "../lib/toast";
import {
  loadNotificationSound,
  playNotificationSound,
  primeNotificationSound,
} from "../lib/notificationSound";
import { enterpriseNotificationService } from "../services";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  timestamp: Date;
  read: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (
    title: string,
    message: string,
    type?: Notification["type"],
  ) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  confirmAction: (options: ConfirmDialogOptions) => Promise<boolean>;
  promptAction: (options: PromptDialogOptions) => Promise<string | null>;
}

interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "warning" | "primary";
}

interface PromptDialogOptions extends ConfirmDialogOptions {
  placeholder?: string;
  initialValue?: string;
  required?: boolean;
}

type DialogState =
  | ({ kind: "confirm"; resolve: (value: boolean) => void } & ConfirmDialogOptions)
  | ({ kind: "prompt"; resolve: (value: string | null) => void } & PromptDialogOptions)
  | null;

// Keep one context identity across Vite hot reloads and lazy route chunks.
// Without this, a refreshed ProfileMainPage chunk can import a newly-created
// context while the already-mounted App tree still provides the previous one,
// making the hook incorrectly report that no provider exists.
const notificationContextStore = globalThis as typeof globalThis & {
  __tirvonaNotificationContext?: React.Context<
    NotificationContextType | undefined
  >;
};
const NotificationContext =
  notificationContextStore.__tirvonaNotificationContext ??
  createContext<NotificationContextType | undefined>(undefined);
notificationContextStore.__tirvonaNotificationContext = NotificationContext;

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [promptValue, setPromptValue] = useState("");

  const closeDialog = (confirmed: boolean) => {
    if (!dialog) return;
    if (dialog.kind === "confirm") dialog.resolve(confirmed);
    else dialog.resolve(confirmed ? promptValue.trim() : null);
    setDialog(null);
    setPromptValue("");
  };

  const confirmAction = (options: ConfirmDialogOptions) =>
    new Promise<boolean>((resolve) => {
      setPromptValue("");
      setDialog({ ...options, kind: "confirm", resolve });
    });

  const promptAction = (options: PromptDialogOptions) =>
    new Promise<string | null>((resolve) => {
      setPromptValue(options.initialValue ?? "");
      setDialog({ ...options, kind: "prompt", resolve });
    });

  const addNotification = (
    title: string,
    message: string,
    type?: Notification["type"],
  ) => {
    const notificationTypes: Notification["type"][] = [
      "info",
      "success",
      "warning",
      "error",
    ];
    const usesShortSignature =
      type === undefined &&
      notificationTypes.includes(message as Notification["type"]);
    const resolvedType: Notification["type"] = usesShortSignature
      ? (message as Notification["type"])
      : type || "info";
    const resolvedMessage = usesShortSignature ? title : message;
    const resolvedTitle = usesShortSignature
      ? {
          success: "Success",
          error: "Something went wrong",
          warning: "Please note",
          info: "Tirvona",
        }[resolvedType]
      : title;

    const newNotif: Notification = {
      id: Math.random().toString(36).substring(7),
      title: resolvedTitle,
      message: resolvedMessage,
      type: resolvedType,
      timestamp: new Date(),
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);
    toast[resolvedType](resolvedMessage, { title: resolvedTitle });
    // Every bell notification is also an audible alert, using the one tone the
    // Super Admin configured for the whole platform. No-ops when unconfigured.
    playNotificationSound();
  };

  // Seed a welcome notification when a user logs in.
  useEffect(() => {
    if (user) {
      setNotifications([
        {
          id: "init-1",
          title: "Welcome to Tirvona",
          message: `Namaste ${user.name}, your account is active as an official ${user.role === "customer" ? "Pilgrim" : humanizeLabel(user.role)}.`,
          type: "success",
          timestamp: new Date(),
          read: false,
        },
      ]);
    } else {
      setNotifications([]);
    }
  }, [user]);

  // The alert tone is one platform-wide setting, so it is read once per app
  // load rather than per dashboard. Autoplay stays blocked until the user has
  // interacted with the page, so the first real gesture buys that permission.
  useEffect(() => {
    void loadNotificationSound();
    const prime = () => primeNotificationSound();
    const options = { once: true, passive: true } as const;
    window.addEventListener("pointerdown", prime, options);
    window.addEventListener("keydown", prime, options);
    return () => {
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown", prime);
    };
  }, []);

  // Server-side notifications reach the bell too.
  //
  // The bell used to hold only what this provider created locally — the
  // welcome line and socket booking events — so anything the backend wrote to
  // the `notifications` collection (approvals, volunteer applications, refund
  // updates) never appeared and never toasted. This polls the same endpoint
  // the Notification Center reads, which is scoped server-side to the caller's
  // id and role, so it is correct for every role on every dashboard.
  const addNotificationRef = useRef(addNotification);
  addNotificationRef.current = addNotification;
  useEffect(() => {
    if (!user) return;
    // Ids already surfaced. Seeded from the first response so signing in does
    // not fire a toast for every unread notification in the backlog.
    const seen = new Set<string>();
    let primed = false;
    let cancelled = false;

    const severityToType = (severity?: string): Notification["type"] => {
      switch (String(severity || "").toLowerCase()) {
        case "critical":
        case "emergency":
        case "security":
          return "error";
        case "warning":
          return "warning";
        case "success":
          return "success";
        default:
          return "info";
      }
    };

    const poll = async () => {
      if (document.hidden) return;
      try {
        const res = await enterpriseNotificationService.getNotifications({
          isRead: "false",
          limit: 20,
        });
        if (cancelled || !res.data?.success) return;
        const rows: any[] = res.data.data || [];
        // Oldest first, so a burst arrives in the order it happened.
        for (const row of [...rows].reverse()) {
          const id = String(row._id ?? "");
          if (!id || seen.has(id)) continue;
          seen.add(id);
          if (!primed) continue;
          addNotificationRef.current(
            row.title || "Notification",
            row.message || "",
            severityToType(row.severity),
          );
        }
        primed = true;
      } catch {
        // A dashboard must not break because the feed is briefly unreachable.
      }
    };

    void poll();
    const timer = window.setInterval(poll, 20_000);
    const onVisible = () => void poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user]);

  // Establish a real-time Socket.io connection scoped to the logged-in user.
  useEffect(() => {
    if (!user) return;

    // M3: authenticate the socket so the server scopes the private room to this
    // verified user (the server ignores any client-sent id).
    const token = localStorage.getItem(TOKEN_KEY);
    const socket = io(`${API_BASE_URL}/notifications`, {
      // Polling-first gives Socket.IO a stable handshake before upgrading to
      // WebSocket. `autoConnect: false` also prevents React Strict Mode's
      // discarded development mount from opening and immediately closing a
      // half-established WebSocket.
      transports: ["polling", "websocket"],
      autoConnect: false,
      auth: { token },
    });
    socketRef.current = socket;
    const connectTimer = window.setTimeout(() => socket.connect(), 50);

    // The NestJS gateway authenticates the handshake and joins the user's
    // private room; the browser cannot select another user's room.
    const lifecycleEvents = [
      "booking_confirmed",
      "checked_in",
      "checked_out",
      "cancelled",
      "volunteer_application_submitted",
      "volunteer_application_updated",
    ];
    const onLifecycleEvent = (
      event: string,
      payload: { title?: string; message?: string },
    ) => {
      const labels: Record<
        string,
        { title: string; type: Notification["type"] }
      > = {
        booking_confirmed: { title: "Booking Confirmed", type: "success" },
        checked_in: { title: "Guest Checked In", type: "info" },
        checked_out: { title: "Guest Checked Out", type: "info" },
        cancelled: { title: "Booking Cancelled", type: "warning" },
        volunteer_application_submitted: {
          title: "Application Submitted",
          type: "success",
        },
        volunteer_application_updated: {
          title: "Application Updated",
          type: "info",
        },
      };
      const meta = labels[event] || {
        title: payload.title || "Booking Update",
        type: "info" as const,
      };
      addNotification(
        payload.title || meta.title,
        payload.message || "Your booking was updated.",
        meta.type,
      );
    };
    lifecycleEvents.forEach((event) =>
      socket.on(event, (payload) => onLifecycleEvent(event, payload)),
    );

    return () => {
      window.clearTimeout(connectTimer);
      lifecycleEvents.forEach((event) => socket.off(event));
      if (socket.connected || socket.active) socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  const markAllAsRead = () => {
    setNotifications([]);
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAllAsRead,
        removeNotification,
        clearNotifications,
        confirmAction,
        promptAction,
      }}
    >
      {children}
      {dialog && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#07111f]/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[24px] border border-[#E58C28]/35 bg-white p-6 text-left shadow-2xl dark:bg-[#0B192C]">
            <h3 className="text-base font-black text-[#0B192C] dark:text-white">
              {dialog.title}
            </h3>
            <p className="mt-2 whitespace-pre-line text-xs leading-5 text-gray-500 dark:text-gray-300">
              {dialog.message}
            </p>
            {dialog.kind === "prompt" && (
              <input
                autoFocus
                value={promptValue}
                onChange={(event) => setPromptValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (!dialog.required || promptValue.trim()))
                    closeDialog(true);
                }}
                placeholder={dialog.placeholder}
                className="mt-4 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-[#0A4DA6] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => closeDialog(false)}
                className="rounded-full bg-gray-100 px-5 py-2.5 text-xs font-bold text-gray-700 dark:bg-slate-800 dark:text-gray-200"
              >
                {dialog.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="button"
                disabled={dialog.kind === "prompt" && dialog.required && !promptValue.trim()}
                onClick={() => closeDialog(true)}
                className={`rounded-full px-5 py-2.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                  dialog.tone === "danger"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : dialog.tone === "warning"
                      ? "bg-[#E58C28] hover:bg-[#c97618]"
                      : "bg-[#0A4DA6] hover:bg-[#083b80]"
                }`}
              >
                {dialog.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider",
    );
  }
  return context;
};
