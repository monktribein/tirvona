import React, { useState, useRef, useEffect } from "react";
import {
  Bell,
  CheckCheck,
  Trash2,
  ShieldCheck,
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
} from "lucide-react";
import {
  useNotifications,
  type Notification,
} from "../../contexts/NotificationContext";
import { Link } from "react-router-dom";

export const NotificationDropdown: React.FC = () => {
  const {
    notifications,
    unreadCount,
    markAllAsRead,
    removeNotification,
    clearNotifications,
  } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />;
      case "warning":
        return <AlertTriangle size={16} className="text-amber-500 shrink-0" />;
      case "error":
        return <AlertCircle size={16} className="text-rose-500 shrink-0" />;
      case "info":
      default:
        return <Info size={16} className="text-[#0A4DA6] shrink-0" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="p-2 rounded-full text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer relative flex items-center justify-center"
        title="Live Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <>
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full flex items-center justify-center text-[8px] font-black text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          </>
        )}
      </button>

      {/* Notification Center Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 rounded-3xl shadow-2xl z-50 overflow-hidden text-left animate-in fade-in zoom-in-95 duration-150">
          {/* Dropdown Header */}
          <div className="p-4 bg-gray-50/80 dark:bg-slate-900/80 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#0A4DA6]/10 text-[#0A4DA6] flex items-center justify-center">
                <Bell size={14} />
              </div>
              <div>
                <h3 className="text-xs font-black text-[#0B192C] dark:text-white uppercase tracking-wider">
                  Notifications
                </h3>
                <p className="text-[10px] text-gray-500 font-bold">
                  {unreadCount > 0
                    ? `${unreadCount} unread updates`
                    : "All caught up"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <>
                  <button
                    onClick={markAllAsRead}
                    className="p-1.5 text-gray-400 hover:text-[#0A4DA6] dark:hover:text-amber-400 transition-colors text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    title="Mark all as read"
                  >
                    <CheckCheck size={14} />
                  </button>
                  <button
                    onClick={clearNotifications}
                    className="p-1.5 text-gray-400 hover:text-rose-500 transition-colors text-[10px] font-bold cursor-pointer"
                    title="Clear all"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-full cursor-pointer ml-1"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800 scrollbar-none">
            {notifications.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-slate-900 text-[#0A4DA6] mx-auto flex items-center justify-center">
                  <ShieldCheck size={20} />
                </div>
                <p className="text-xs font-black text-gray-700 dark:text-gray-300">
                  No new notifications
                </p>
                <p className="text-[11px] text-gray-400 font-medium">
                  You will receive real-time booking and system updates here.
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3.5 flex items-start gap-3 transition-colors hover:bg-gray-50/70 dark:hover:bg-slate-900/60 relative group ${
                    !notif.read ? "bg-blue-50/30 dark:bg-slate-900/40" : ""
                  }`}
                >
                  <div className="mt-0.5">{getIcon(notif.type)}</div>
                  <div className="flex-grow min-w-0 pr-4">
                    <h4 className="text-xs font-extrabold text-[#0B192C] dark:text-white leading-tight">
                      {notif.title}
                    </h4>
                    <p className="text-[11px] text-gray-600 dark:text-gray-300 font-medium mt-0.5 leading-relaxed">
                      {notif.message}
                    </p>
                    <span className="text-[9px] font-bold text-gray-400 mt-1 block">
                      {new Date(notif.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <button
                    onClick={() => removeNotification(notif.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-rose-500 transition-opacity absolute right-2 top-3 cursor-pointer"
                    title="Dismiss"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer Link */}
          <div className="p-2.5 bg-gray-50 dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 text-center">
            <Link
              to="/profile/notifications"
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-extrabold text-[#0A4DA6] dark:text-[#E58C28] hover:underline block"
            >
              View All Notifications Center →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
