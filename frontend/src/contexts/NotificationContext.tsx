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
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);

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

  // Establish a real-time Socket.io connection scoped to the logged-in user.
  useEffect(() => {
    if (!user) return;

    // M3: authenticate the socket so the server scopes the private room to this
    // verified user (the server ignores any client-sent id).
    const token = localStorage.getItem(TOKEN_KEY);
    const socket = io(`${API_BASE_URL}/notifications`, {
      transports: ["websocket", "polling"],
      auth: { token },
    });
    socketRef.current = socket;

    // The NestJS gateway authenticates the handshake and joins the user's
    // private room; the browser cannot select another user's room.
    const lifecycleEvents = [
      "booking_confirmed",
      "checked_in",
      "checked_out",
      "cancelled",
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
      lifecycleEvents.forEach((event) => socket.off(event));
      socket.disconnect();
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
      }}
    >
      {children}
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
