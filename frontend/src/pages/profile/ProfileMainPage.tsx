import React, { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "../../utils/format";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  User,
  Calendar,
  Heart,
  CreditCard,
  Package,
  Settings,
  LogOut,
  MapPin,
  CheckCircle2,
  Clock,
  ArrowRight,
  Edit3,
  Phone,
  Mail,
  ChevronRight,
  CircleParking,
  XCircle,
  Loader2,
  Lock,
  Download,
  Trash2,
  Star,
  RefreshCw,
  BookOpen,
  HandHeart,
} from "lucide-react";
import { VisitorArticlesTab } from "./VisitorArticlesTab";
import { VolunteerApplicationsTab } from "./VolunteerApplicationsTab";
import ProfileOrdersPage from "./ProfileOrdersPage";
import { useAuth } from "../../contexts/AuthContext";
import { useNotifications } from "../../contexts/NotificationContext";
import {
  EnterpriseModal,
} from "../../admin/shared";
import { authService, bookingService } from "../../services";
import { parkingBookingService } from "../../modules/parking/services/parking.service";
import { getErrorMessage, TOKEN_KEY } from "../../lib/api";
import useMyBookings, {
  type BookingCategory,
  type UnifiedBooking,
} from "../../hooks/useMyBookings";
import { isParkingRole } from "../../utils/roleRedirect";

const BOOKING_TABS: { key: BookingCategory; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const FALLBACK_IMAGE: Record<string, string> = {
  stay: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E",
  parking:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E",
};

const formatDate = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export const ProfileMainPage: React.FC = () => {
  const { user, logout, refreshUser } = useAuth();
  const { addNotification, confirmAction } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && isParkingRole(user.parkingRoles, user.role, user.email)) {
      navigate("/parking/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const {
    bookings,
    loading: bookingsLoading,
    counts,
    refresh,
  } = useMyBookings(Boolean(user));

  const getTabFromPath = (
    pathname: string,
  ):
    | "overview"
    | "bookings"
    | "volunteer"
    | "articles"
    | "orders"
    | "wishlist"
    | "payments"
    | "settings" => {
    if (
      pathname.includes("/profile/bookings") ||
      pathname.includes("/profile/history")
    )
      return "bookings";
    if (pathname.includes("/profile/volunteer")) return "volunteer";
    if (
      pathname.includes("/profile/articles") ||
      pathname.includes("/profile/blogs")
    )
      return "articles";
    if (pathname.includes("/profile/orders")) return "orders";
    if (pathname.includes("/profile/wishlist")) return "wishlist";
    if (pathname.includes("/profile/payments")) return "payments";
    if (pathname.includes("/profile/settings")) return "settings";
    return "overview";
  };

  const activeTab = getTabFromPath(location.pathname);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState(user?.name || "");
  const [editPhone, setEditPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);

  const [bookingCategoryTab, setBookingCategoryTab] =
    useState<BookingCategory>("upcoming");
  const [kindFilter, setKindFilter] = useState<"all" | "stay" | "parking">(
    "all",
  );
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [wishlistItems, setWishlistItems] = useState([
    {
      id: "ashram-1",
      name: "Swarg Ashram Divine Residency",
      city: "Rishikesh, Uttarakhand",
      image:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E",
      rating: 4.9,
      price: 1200,
    },
    {
      id: "ashram-2",
      name: "Parmarth Niketan Ashram",
      city: "Rishikesh, Uttarakhand",
      image:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E",
      rating: 5.0,
      price: 800,
    },
    {
      id: "ashram-3",
      name: "Kashi Annapurna Heritage Bhavan",
      city: "Varanasi, Uttar Pradesh",
      image:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E",
      rating: 4.8,
      price: 1500,
    },
  ]);

  const transactions = [
    {
      id: "TXN-902181",
      date: "Jul 26, 2026",
      title: "Swarg Ashram Booking",
      amount: 4800,
      method: "UPI / GPay",
      status: "Paid",
    },
    {
      id: "TXN-718293",
      date: "Jul 15, 2026",
      title: "Parmarth Niketan Booking",
      amount: 2400,
      method: "Credit Card",
      status: "Paid",
    },
    {
      id: "TXN-610294",
      date: "Jun 05, 2026",
      title: "Kashi Guest House Cancellation Refund",
      amount: 6200,
      method: "UPI Refund",
      status: "Refunded",
    },
  ];

  useEffect(() => {
    if (user) {
      setEditName(user.name || "");
      setEditPhone(user.phone || "");
    }
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      const res = await authService.updateMe({
        name: editName.trim(),
        phone: editPhone.trim(),
      });

      if (res.data?.success) {
        await refreshUser();
        addNotification(
          "Profile Updated",
          "Your profile details have been saved.",
          "success",
        );
        setIsEditModalOpen(false);
      } else {
        addNotification(
          "Update Failed",
          res.data?.message || "Could not save your profile.",
          "error",
        );
      }
    } catch (err) {
      addNotification(
        "Update Failed",
        getErrorMessage(err, "Could not save your profile."),
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancelBooking = async (booking: UnifiedBooking) => {
    if (cancellingId) return;
    const ok = await confirmAction({
      title: "Cancel booking?",
      message: `${booking.reference} will be cancelled. Any eligible refund will follow this booking's cancellation policy.`,
      confirmLabel: "Cancel Booking",
      tone: "danger",
    });
    if (!ok) return;

    setCancellingId(booking.id);
    try {
      const res =
        booking.kind === "parking"
          ? await parkingBookingService.cancel(
              booking.id,
              "Cancelled from profile",
            )
          : await bookingService.cancel(booking.id, "Cancelled from profile");

      if (res.data?.success) {
        await refresh();
        addNotification(
          "Booking Cancelled",
          `Booking ${booking.reference} was cancelled.`,
          "success",
        );
      } else {
        addNotification(
          "Cancellation Failed",
          res.data?.message || "Could not cancel this booking.",
          "error",
        );
      }
    } catch (err) {
      addNotification(
        "Cancellation Failed",
        getErrorMessage(err, "Could not cancel this booking."),
        "error",
      );
    } finally {
      setCancellingId(null);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changingPassword) return;
    if (newPassword !== confirmPassword) {
      addNotification(
        "Password Mismatch",
        "New passwords do not match.",
        "error",
      );
      return;
    }
    if (newPassword.length < 8) {
      addNotification(
        "Password Too Short",
        "The new password must contain at least 8 characters.",
        "error",
      );
      return;
    }
    setChangingPassword(true);
    try {
      const response = await authService.changePassword(
        currentPassword,
        newPassword,
      );
      if (response.data?.data?.token)
        localStorage.setItem(TOKEN_KEY, response.data.data.token);
      addNotification(
        "Password Changed",
        "Your security password has been updated and other sessions were signed out.",
        "success",
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      addNotification(
        "Password Update Failed",
        getErrorMessage(err, "Could not update your password."),
        "error",
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const handleRemoveWishlist = (id: string) => {
    setWishlistItems((prev) => prev.filter((item) => item.id !== id));
    addNotification(
      "Removed from Wishlist",
      "Ashram removed from saved list.",
      "info",
    );
  };

  const quickStats = [
    {
      label: "Upcoming Bookings",
      count: bookingsLoading ? "—" : String(counts.upcoming),
      to: "/profile/bookings",
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    {
      label: "Completed",
      count: bookingsLoading ? "—" : String(counts.completed),
      to: "/profile/bookings",
      color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Ashram Stays",
      count: bookingsLoading ? "—" : String(counts.stays),
      to: "/profile/bookings",
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    {
      label: "Parking Bookings",
      count: bookingsLoading ? "—" : String(counts.parking),
      to: "/profile/bookings",
      color: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    },
  ];

  const recentActivity = useMemo(
    () =>
      [...bookings]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 5)
        .map((b) => ({
          key: `${b.kind}-${b.id}`,
          title:
            b.kind === "parking"
              ? `Parking at ${b.title}`
              : `${b.status === "cancelled" ? "Cancelled" : "Booked"} ${b.title}`,
          location: b.location || "Tirvona",
          date: new Date(b.createdAt).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
          to:
            b.detailHref ||
            (b.kind === "parking"
              ? `/parking/booking/${b.id}`
              : `/booking/${b.id}`),
          icon:
            b.category === "cancelled" ? (
              <XCircle className="text-rose-500" size={16} />
            ) : b.kind === "parking" ? (
              <CircleParking className="text-[#0A4DA6]" size={16} />
            ) : (
              <CheckCircle2 className="text-emerald-500" size={16} />
            ),
        })),
    [bookings],
  );

  const visibleBookings = useMemo(
    () =>
      bookings.filter(
        (b) =>
          b.category === bookingCategoryTab &&
          (kindFilter === "all" || b.kind === kindFilter),
      ),
    [bookings, bookingCategoryTab, kindFilter],
  );

  const navItems = [
    {
      key: "overview",
      path: "/profile",
      label: "Overview & Activity",
      desc: "Account summary & recent yatras",
      icon: <User size={18} />,
      iconBg: "bg-blue-50 dark:bg-blue-950/40 text-[#0A4DA6]",
    },
    {
      key: "bookings",
      path: "/profile/bookings",
      label: "My Bookings & Stays",
      desc: "Upcoming, completed & cancelled",
      icon: <Calendar size={18} />,
      iconBg: "bg-blue-50 dark:bg-blue-950/40 text-[#0A4DA6]",
      badge: counts.total > 0 ? String(counts.total) : undefined,
    },
    {
      key: "articles",
      path: "/profile/articles",
      label: "My Articles & Blogs",
      desc: "Verified stay experience stories",
      icon: <BookOpen size={18} />,
      iconBg: "bg-amber-50 dark:bg-amber-950/40 text-amber-600",
    },
    {
      key: "volunteer",
      path: "/profile/volunteer",
      label: "My Seva Applications",
      desc: "Volunteer application updates",
      icon: <HandHeart size={18} />,
      iconBg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600",
    },
    {
      key: "orders",
      path: "/profile/orders",
      label: "My Orders",
      desc: "Prasad & marketplace purchases",
      icon: <Package size={18} />,
      iconBg: "bg-blue-50 dark:bg-blue-950/40 text-[#0A4DA6]",
    },
    {
      key: "wishlist",
      path: "/profile/wishlist",
      label: "Wishlist & Saved",
      desc: "Favorite ashrams & stays",
      icon: <Heart size={18} />,
      iconBg: "bg-rose-50 dark:bg-rose-950/40 text-rose-600",
    },
    {
      key: "payments",
      path: "/profile/payments",
      label: "Payment History & Invoices",
      desc: "Transactions & GST receipts",
      icon: <CreditCard size={18} />,
      iconBg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600",
    },
    {
      key: "settings",
      path: "/profile/settings",
      label: "Account Settings",
      desc: "Password & security options",
      icon: <Settings size={18} />,
      iconBg: "bg-purple-50 dark:bg-purple-950/40 text-purple-600",
    },
  ];

  return (
    <div className="min-h-screen pb-24 text-left">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 sm:pt-3 space-y-6">
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 sm:p-7 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#0A4DA6] to-[#E58C28] p-0.5 shadow-md shrink-0">
              <div className="w-full h-full rounded-full bg-white dark:bg-[#0B192C] flex items-center justify-center">
                <User size={28} className="text-[#0A4DA6] dark:text-blue-400" />
              </div>
            </div>

            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-black text-[#0B192C] dark:text-white leading-none">
                {user?.name || "User Profile"}
              </h2>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1">
                  <Mail size={13} className="text-[#0A4DA6]" />{" "}
                  {user?.email || "user@example.com"}
                </span>
                {user?.phone && (
                  <span className="flex items-center gap-1">
                    <Phone size={13} className="text-[#0A4DA6]" /> {user.phone}
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsEditModalOpen(true)}
            className="px-4 py-2 bg-[#F0F5FC] dark:bg-slate-800/80 hover:bg-[#0A4DA6] hover:text-white dark:hover:bg-[#0A4DA6] dark:hover:text-white text-[#0A4DA6] dark:text-blue-300 border border-blue-100 dark:border-slate-700/80 rounded-full text-xs font-extrabold flex items-center gap-2 transition-all shadow-xs cursor-pointer whitespace-nowrap shrink-0"
          >
            <Edit3 size={14} className="shrink-0" />
            <span>Edit Profile</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-3 shadow-lg space-y-1 lg:sticky lg:top-24">
            <div className="px-3 py-2 text-[10px] font-black text-gray-400 tracking-wider">
              Profile Categories
            </div>

            {navItems.map((item) => {
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => navigate(item.path)}
                  className={`w-full p-3 rounded-2xl flex items-center justify-between transition-all cursor-pointer text-left text-xs font-extrabold ${
                    isActive
                      ? "bg-[#0A4DA6] text-white shadow-md"
                      : "text-[#0B192C] dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-xl shrink-0 ${isActive ? "bg-white/15 text-white" : item.iconBg}`}
                    >
                      {item.icon}
                    </div>
                    <div>
                      <span className="block">{item.label}</span>
                      <span
                        className={`text-[10px] font-normal block ${isActive ? "text-blue-100" : "text-gray-400"}`}
                      >
                        {item.desc}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.badge && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-blue-100 text-[#0A4DA6] dark:bg-slate-800 dark:text-blue-300"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight
                      size={16}
                      className={isActive ? "text-white" : "text-gray-400"}
                    />
                  </div>
                </button>
              );
            })}

            <div className="pt-2 border-t border-gray-100 dark:border-slate-800 mt-2">
              <button
                onClick={logout}
                className="w-full p-3 rounded-2xl flex items-center justify-between text-xs font-extrabold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-xl shrink-0">
                    <LogOut size={18} />
                  </div>
                  <div>
                    <span className="block">Sign Out of Tirvona</span>
                    <span className="text-[10px] text-rose-400 font-normal block">
                      Safely end your session
                    </span>
                  </div>
                </div>
                <ArrowRight size={16} className="text-rose-400" />
              </button>
            </div>
          </div>

          <div className="lg:col-span-8 min-w-0 space-y-6">
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-extrabold text-[#0B192C] dark:text-white tracking-wider mb-3">
                    Booking Overview
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {quickStats.map((stat, idx) => (
                      <button
                        key={idx}
                        onClick={() => navigate(stat.to)}
                        className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-4 shadow-md hover:shadow-lg transition-all text-left cursor-pointer group"
                      >
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-black mb-2 ${stat.color}`}
                        >
                          {stat.count}
                        </span>
                        <div className="flex justify-between items-center text-xs font-extrabold text-[#0B192C] dark:text-white">
                          <span>{stat.label}</span>
                          <ChevronRight
                            size={14}
                            className="text-gray-400 group-hover:translate-x-1 transition-transform"
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-extrabold text-[#0B192C] dark:text-white tracking-wider">
                    Recent Yatra Activity
                  </h3>

                  <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-5 shadow-lg space-y-4">
                    {bookingsLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-12 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-xl"
                        />
                      ))
                    ) : recentActivity.length === 0 ? (
                      <div className="text-center py-8 space-y-2">
                        <Clock
                          size={28}
                          className="text-gray-300 dark:text-slate-700 mx-auto"
                        />
                        <p className="text-xs font-bold text-gray-400">
                          No activity yet
                        </p>
                        <p className="text-[10px] text-gray-400 font-medium">
                          Your bookings will appear here once you make one.
                        </p>
                      </div>
                    ) : (
                      recentActivity.map((act) => (
                        <Link
                          key={act.key}
                          to={act.to}
                          className="flex items-start gap-3 pb-3 border-b border-gray-100 dark:border-slate-800 last:border-0 last:pb-0 hover:opacity-80 transition-opacity"
                        >
                          <div className="p-2 bg-gray-50 dark:bg-slate-900 rounded-xl shrink-0">
                            {act.icon}
                          </div>
                          <div className="space-y-0.5 text-xs min-w-0 flex-1">
                            <h4 className="font-extrabold text-[#0B192C] dark:text-white line-clamp-1">
                              {act.title}
                            </h4>
                            <p className="text-[10px] text-gray-400 font-bold flex items-center gap-2">
                              <span>📍 {act.location}</span>
                              <span>• {act.date}</span>
                            </p>
                          </div>
                          <ChevronRight
                            size={16}
                            className="text-gray-400 self-center"
                          />
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "bookings" && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h2 className="text-xl font-black text-[#0B192C] dark:text-white">
                      My Bookings & Stays
                    </h2>
                    <p className="text-xs text-gray-400 font-medium">
                      {" "}
                      Ashram stays and parking reservations tied to your
                      account.
                    </p>
                  </div>

                  <button
                    onClick={() => refresh()}
                    disabled={bookingsLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-full text-xs font-extrabold text-gray-700 dark:text-gray-200 hover:bg-gray-50 cursor-pointer transition-all shadow-xs shrink-0"
                  >
                    <RefreshCw
                      size={12}
                      className={bookingsLoading ? "animate-spin" : ""}
                    />
                    <span>Refresh</span>
                  </button>
                </div>

                <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-2 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs font-extrabold">
                  <div className="flex items-center gap-1">
                    {BOOKING_TABS.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setBookingCategoryTab(tab.key)}
                        className={`px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                          bookingCategoryTab === tab.key
                            ? "bg-[#0A4DA6] text-white shadow-sm"
                            : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {tab.label} ({counts[tab.key]})
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="text-gray-400 font-semibold px-1">
                      Type:
                    </span>
                    {(["all", "stay", "parking"] as const).map((kind) => (
                      <button
                        key={kind}
                        onClick={() => setKindFilter(kind)}
                        className={`px-2.5 py-1 rounded-lg capitalize cursor-pointer transition-all ${
                          kindFilter === kind
                            ? "bg-gray-900 text-white dark:bg-white dark:text-slate-900"
                            : "text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {kind === "all"
                          ? "All"
                          : kind === "stay"
                            ? "Stays"
                            : "Parking"}
                      </button>
                    ))}
                  </div>
                </div>

                {bookingsLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-36 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl animate-pulse"
                      />
                    ))}
                  </div>
                ) : visibleBookings.length === 0 ? (
                  <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-10 text-center space-y-3 shadow-md">
                    <Calendar
                      size={36}
                      className="text-gray-300 dark:text-slate-700 mx-auto"
                    />
                    <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
                      No {bookingCategoryTab} bookings found
                    </h3>
                    <p className="text-xs text-gray-400 max-w-sm mx-auto font-medium">
                      {bookingCategoryTab === "upcoming"
                        ? "Book an ashram stay or reserve parking for your next spiritual yatra."
                        : `No ${bookingCategoryTab} reservations on record.`}
                    </p>
                    <Link
                      to="/search"
                      className="inline-block px-5 py-2.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white rounded-full text-xs font-black transition-all shadow-md mt-2"
                    >
                      Explore Ashrams & Stays
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {visibleBookings.map((b) => {
                      const image =
                        b.image ||
                        FALLBACK_IMAGE[b.kind] ||
                        FALLBACK_IMAGE.stay;
                      return (
                        <div
                          key={`${b.kind}-${b.id}`}
                          className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                        >
                          <div className="flex items-start gap-4 min-w-0">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 bg-gray-100 dark:bg-slate-800">
                              <img
                                src={image}
                                alt={b.title}
                                className="w-full h-full object-cover"
                              />
                            </div>

                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2 py-0.5 bg-blue-50 text-[#0A4DA6] dark:bg-blue-950/40 dark:text-blue-300 rounded-md text-[10px] font-black">
                                  {b.kind === "parking"
                                    ? "Parking"
                                    : "Ashram Stay"}
                                </span>
                                <span className="text-[10px] font-mono text-gray-400 font-bold">
                                  {b.reference}
                                </span>
                              </div>

                              <h3 className="font-extrabold text-sm sm:text-base text-[#0B192C] dark:text-white line-clamp-1">
                                {b.title}
                              </h3>

                              <p className="text-xs text-gray-400 flex items-center gap-1 font-medium">
                                <MapPin size={12} className="text-[#E58C28]" />
                                <span className="truncate">
                                  {b.location || "Tirvona"}
                                </span>
                              </p>

                              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold pt-0.5">
                                {b.start
                                  ? `${formatDate(b.start)} → ${formatDate(b.end)}`
                                  : formatDate(b.createdAt)}
                              </p>
                            </div>
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto gap-2 border-t sm:border-t-0 border-gray-100 dark:border-slate-800 pt-3 sm:pt-0 shrink-0">
                            <span className="text-base font-black text-[#0A4DA6] dark:text-white">
                              {formatCurrency(b.amount)}
                            </span>

                            <div className="flex items-center gap-2">
                              {b.category === "upcoming" && (
                                <button
                                  onClick={() => handleCancelBooking(b)}
                                  disabled={cancellingId === b.id}
                                  className="px-3 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                                >
                                  {cancellingId === b.id
                                    ? "Cancelling..."
                                    : "Cancel"}
                                </button>
                              )}

                              <Link
                                to={
                                  b.detailHref ||
                                  (b.kind === "parking"
                                    ? `/parking/booking/${b.id}`
                                    : `/booking/${b.id}`)
                                }
                                className="px-3.5 py-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-[#0A4DA6] hover:text-white dark:hover:bg-[#0A4DA6] text-[#0B192C] dark:text-gray-200 text-xs font-extrabold rounded-full transition-all"
                              >
                                Details
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === "articles" && <VisitorArticlesTab />}

            {activeTab === "volunteer" && <VolunteerApplicationsTab />}

            {activeTab === "orders" && <ProfileOrdersPage />}

            {activeTab === "wishlist" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-black text-[#0B192C] dark:text-white">
                    Wishlist & Saved Ashrams
                  </h2>
                  <p className="text-xs text-gray-400 font-medium">
                    Favorite spiritual stays saved for your future yatras.
                  </p>
                </div>

                {wishlistItems.length === 0 ? (
                  <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-10 text-center space-y-3 shadow-md">
                    <Heart
                      size={36}
                      className="text-gray-300 dark:text-slate-700 mx-auto"
                    />
                    <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
                      Your wishlist is empty
                    </h3>
                    <p className="text-xs text-gray-400 max-w-sm mx-auto font-medium">
                      Save ashrams and sacred retreats while searching to keep
                      them handy here.
                    </p>
                    <Link
                      to="/search"
                      className="inline-block px-5 py-2.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white rounded-full text-xs font-black transition-all shadow-md mt-2"
                    >
                      Browse Ashrams
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {wishlistItems.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-md space-y-3 p-4 flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="relative h-40 w-full rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-800">
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                            <button
                              onClick={() => handleRemoveWishlist(item.id)}
                              title="Remove from wishlist"
                              className="absolute top-2.5 right-2.5 p-2 bg-white/90 dark:bg-[#0B192C]/90 text-rose-500 rounded-full shadow-sm hover:bg-rose-50 transition-all cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                            <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 bg-black/60 backdrop-blur-xs text-amber-400 text-[10px] font-black rounded-md flex items-center gap-1">
                              <Star size={10} fill="currentColor" />{" "}
                              {item.rating}
                            </div>
                          </div>

                          <div>
                            <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white leading-tight line-clamp-1">
                              {item.name}
                            </h3>
                            <p className="text-xs text-gray-400 flex items-center gap-1 font-medium mt-0.5">
                              <MapPin size={12} className="text-[#E58C28]" />{" "}
                              {item.city}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-800">
                          <div>
                            <span className="text-[10px] text-gray-400 font-bold block">
                              Starting from
                            </span>
                            <span className="text-sm font-black text-[#0A4DA6] dark:text-white">
                              {formatCurrency(item.price)}
                              <span className="text-[10px] font-normal text-gray-400">
                                /night
                              </span>
                            </span>
                          </div>

                          <Link
                            to="/search"
                            className="px-3.5 py-1.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-extrabold rounded-full transition-all"
                          >
                            View Ashram
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "payments" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-black text-[#0B192C] dark:text-white">
                    Payments & GST Invoices
                  </h2>
                  <p className="text-xs text-gray-400 font-medium">
                    Download tax invoices and view payment transaction receipts.
                  </p>
                </div>

                <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-md space-y-4">
                  <h3 className="font-extrabold text-xs text-gray-400 tracking-wider">
                    Transaction Receipts
                  </h3>

                  <div className="divide-y divide-gray-100 dark:divide-slate-800">
                    {transactions.map((t) => (
                      <div
                        key={t.id}
                        className="py-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-[#0B192C] dark:text-white">
                              {t.title}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${t.status === "Paid" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-blue-50 text-blue-600"}`}
                            >
                              {t.status}
                            </span>
                          </div>
                          <p className="text-gray-400 font-medium text-[11px]">
                            {t.id} • {t.date} via {t.method}
                          </p>
                        </div>

                        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                          <span className="text-sm font-black text-[#0A4DA6] dark:text-white">
                            {formatCurrency(t.amount)}
                          </span>
                          <button
                            onClick={() =>
                              addNotification(
                                "Invoice Downloaded",
                                `Receipt for ${t.id} requested.`,
                                "info",
                              )
                            }
                            className="px-3 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-100 text-xs font-bold text-gray-700 dark:text-gray-200 rounded-full transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Download size={13} /> Receipt
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "settings" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-black text-[#0B192C] dark:text-white">
                    Account Settings & Security
                  </h2>
                  <p className="text-xs text-gray-400 font-medium">
                    Manage your security credentials and regional preferences.
                  </p>
                </div>

                <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-md space-y-4">
                  <h3 className="font-extrabold text-xs text-[#0B192C] dark:text-white tracking-wider flex items-center gap-2">
                    <Lock size={15} className="text-[#0A4DA6]" /> Change
                    Password
                  </h3>

                  <form
                    onSubmit={handleChangePassword}
                    className="space-y-3 text-xs font-bold"
                  >
                    <div className="space-y-1">
                      <label className="text-gray-700 dark:text-gray-300">
                        Current Password
                      </label>
                      <input
                        type="password"
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-[#0A4DA6]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-gray-700 dark:text-gray-300">
                          New Password
                        </label>
                        <input
                          type="password"
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-[#0A4DA6]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-gray-700 dark:text-gray-300">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-[#0A4DA6]"
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={changingPassword}
                        className="px-5 py-2 bg-[#0A4DA6] hover:bg-[#083D85] text-white rounded-full text-xs font-black transition-all cursor-pointer shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {changingPassword ? "Updating..." : "Update Security Password"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <EnterpriseModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Profile Details"
        subtitle="Update your name and primary contact number"
      >
        <form
          onSubmit={handleSaveProfile}
          className="space-y-4 text-xs font-bold"
        >
          <div className="space-y-1">
            <label className="text-gray-700 dark:text-gray-300">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-[#0A4DA6]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-gray-700 dark:text-gray-300">
              Phone Number *
            </label>
            <input
              type="tel"
              required
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-[#0A4DA6]"
            />
          </div>

          <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-200 text-xs font-bold rounded-full cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-black rounded-full cursor-pointer transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              <span>{saving ? "Saving…" : "Save Changes"}</span>
            </button>
          </div>
        </form>
      </EnterpriseModal>
    </div>
  );
};

export default ProfileMainPage;
