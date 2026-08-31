import React, { useState, useEffect, useRef } from "react";
import logo from "../assets/logo.png";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../contexts/NotificationContext";
import NotificationDropdown from "../components/shared/NotificationDropdown";
import CartDrawer, { CartButton } from "../components/shared/CartDrawer";
import { setGuestPendingIntent } from "../utils/guestGate";
import { getRoleDefaultDashboard, isParkingRole } from "../utils/roleRedirect";
import { useCurrency } from "../contexts/CurrencyContext";
import { useLanguage } from "../contexts/LanguageContext";
import { getFormattingLocale } from "../utils/format";
import {
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Globe,
  ChevronUp,
  ChevronRight,
  LayoutDashboard,
  ArrowRight,
  Mail,
  User,
  Heart,
  Tag,
  Settings,
  Calendar,
  Sparkles,
  PhoneCall,
  Package,
} from "lucide-react";

const FooterAccordion: React.FC<{
  title: string;
  titleColor?: string;
  children: React.ReactNode;
}> = ({ title, titleColor = "text-white", children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/10">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center py-4 text-left"
      >
        <span
          className={`text-xs font-extrabold tracking-wider ${titleColor}`}
        >
          {title}
        </span>
        <ChevronRight
          size={14}
          className={`text-gray-500 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${open ? "max-h-96 pb-4" : "max-h-0"}`}
      >
        {children}
      </div>
    </div>
  );
};

export const PublicLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { unreadCount, notifications, markAllAsRead, removeNotification } =
    useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [navbarVisible, setNavbarVisible] = useState(true);
  const notifRef = useRef<HTMLDivElement>(null);
  const lastNavbarScrollY = useRef(0);
  const navbarScrollFrame = useRef<number | null>(null);

  useEffect(() => {
    const updateNavbar = () => {
      const currentScrollY = Math.max(window.scrollY, 0);
      const scrollDifference = currentScrollY - lastNavbarScrollY.current;

      if (currentScrollY <= 32) {
        setNavbarVisible(true);
        lastNavbarScrollY.current = currentScrollY;
      } else if (Math.abs(scrollDifference) >= 8) {
        setNavbarVisible(scrollDifference < 0);
        lastNavbarScrollY.current = currentScrollY;
      }

      navbarScrollFrame.current = null;
    };

    const handleScroll = () => {
      if (navbarScrollFrame.current === null) {
        navbarScrollFrame.current = window.requestAnimationFrame(updateNavbar);
      }
    };

    lastNavbarScrollY.current = Math.max(window.scrollY, 0);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (navbarScrollFrame.current !== null) {
        window.cancelAnimationFrame(navbarScrollFrame.current);
      }
    };
  }, []);

  useEffect(() => {
    setNavbarVisible(true);
    lastNavbarScrollY.current = Math.max(window.scrollY, 0);
  }, [location.pathname]);

  const {
    currency: activeCurrency,
    setCurrency,
    rate,
    loadingRate,
    refreshRate,
  } = useCurrency();
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const currencyDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        currencyDropdownRef.current &&
        !currencyDropdownRef.current.contains(e.target as Node)
      ) {
        setShowCurrencyDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelectCurrency = (code: "INR" | "USD") => {
    setCurrency(code);
    setShowCurrencyDropdown(false);
  };

  const { language: activeLang, setLanguage, t } = useLanguage();
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        langDropdownRef.current &&
        !langDropdownRef.current.contains(e.target as Node)
      ) {
        setShowLangDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelectLang = (code: "en" | "hi") => {
    setLanguage(code);
    setShowLangDropdown(false);
  };

  const authReturnUrl = `${location.pathname}${location.search}${location.hash}`;
  const rememberCurrentPage = () =>
    setGuestPendingIntent({ type: "generic", returnUrl: authReturnUrl });

  useEffect(() => {
    setDrawerOpen(false);
    setShowNotifications(false);
  }, [location.pathname]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const toggleDarkMode = () => {
    setDarkMode((d) => !d);
    document.documentElement.classList.toggle("dark");
  };

  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => {
    logout();
    setProfileDropdownOpen(false);
    navigate("/");
    setDrawerOpen(false);
  };

  const getDashboardPath = () => {
    if (!user) return "/login";
    return getRoleDefaultDashboard(user.role, user.parkingRoles, user.email);
  };

  const getDashboardLabel = () => {
    if (!user) return "Dashboard";
    if (["district_officer", "govt_admin", "super_admin"].includes(user.role))
      return "Admin Dashboard";
    if (["ashram_admin", "stay_admin"].includes(user.role))
      return "Ashram Admin Dashboard";
    if (["ashram_owner", "owner"].includes(user.role))
      return "Stay Owner Dashboard";
    if (user.role === "support") return "Support Console";
    if (isParkingRole(user.parkingRoles, user.role, user.email))
      return "Parking Dashboard";
    return "My Dashboard";
  };

  const hasOperationalDashboard = () => {
    if (!user) return false;
    if (isParkingRole(user.parkingRoles, user.role, user.email)) return true;
    return [
      "super_admin",
      "govt_admin",
      "district_officer",
      "owner",
      "stay_admin",
      "ashram_admin",
      "ashram_owner",
      "manager",
      "reception",
      "housekeeping",
      "support",
    ].includes(user.role);
  };

  const getRoleBadgeLabel = () => {
    if (!user) return "";
    if (user.role === "super_admin") return "Super Admin";
    if (user.role === "govt_admin") return "Govt Admin";
    if (user.role === "district_officer") return "District Admin";
    if (["ashram_admin", "stay_admin"].includes(user.role)) return "Ashram Admin";
    if (["ashram_owner", "owner"].includes(user.role)) return "Stay Owner";
    if (isParkingRole(user.parkingRoles, user.role, user.email))
      return "Parking Partner";
    if (user.role === "volunteer") return "Volunteer";
    if (user.role === "support") return "Support";
    return "Pilgrim";
  };

  const navLinks: { label: string; to: string; isHighlighted?: boolean }[] = [
    { label: "Destinations", to: "/search" },
    { label: "Parking", to: "/parking" },
    { label: "Marketplace", to: "/marketplace" },
    { label: "Aarti Booking", to: "/aarti" },
    { label: "Live Pooja", to: "/live-pooja" },
    { label: "Offers", to: "/offers" },
  ];

  const hasOverlayHero =
    ["/", "/public"].includes(location.pathname) ||
    location.pathname.startsWith("/featured-banner/");

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/70 dark:bg-[#070F1B] text-foreground transition-colors duration-300">
      <header
        className={`sticky top-0 z-50 pt-3 pb-3 ${hasOverlayHero ? "-mb-20 lg:-mb-24" : "mb-0"} pointer-events-none transform-gpu transition-all duration-300 ease-out will-change-transform ${navbarVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"}`}
        aria-hidden={!navbarVisible}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pointer-events-auto">
          <div className="bg-white/95 dark:bg-[#0B192C]/95 backdrop-blur-md border border-gray-200/90 dark:border-slate-800 rounded-full px-4 lg:px-6 py-2 flex items-center justify-between w-full shadow-sm hover:shadow-md transition-shadow">
            <Link to="/" className="flex items-center gap-2 group shrink-0">
              <img
                src="/logo/logo.png"
                alt="Tirvona Sacred Destinations"
                className="h-8 sm:h-9 lg:h-9.5 w-auto object-contain group-hover:scale-105 transition-transform"
              />
            </Link>

            <nav className="hidden lg:flex items-center justify-center gap-0.5 xl:gap-1.5 text-xs font-medium text-[#1E293B] dark:text-gray-200">
              {navLinks.map((link) => {
                const isActive =
                  location.pathname === link.to ||
                  (link.to !== "/" && location.pathname.startsWith(link.to));
                const isSpecial = link.isHighlighted;
                return (
                  <Link
                    key={link.label}
                    to={link.to}
                    className={`px-3 xl:px-3.5 py-1.5 rounded-full font-bold transition-all text-center whitespace-nowrap text-xs xl:text-[13px] tracking-tight ${isSpecial
                      ? "bg-[#0A4DA6] text-white hover:bg-[#083D85] shadow-xs font-black ring-2 ring-[#E58C28]/60 ring-offset-1 ring-offset-white dark:ring-offset-[#0B192C] transform -translate-y-0.5"
                      : isActive
                        ? "text-[#0A4DA6] dark:text-[#E58C28] bg-blue-50/90 dark:bg-slate-800 shadow-2xs font-extrabold"
                        : "text-slate-700 dark:text-slate-200 hover:text-[#0A4DA6] dark:hover:text-[#E58C28] hover:bg-slate-100/90 dark:hover:bg-slate-800/70"
                      }`}
                  >
                    <span>{t(link.label)}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="lg:hidden flex-1 pl-3 text-xs font-semibold text-gray-500">
              {t("Menu")}
            </div>

            <div className="flex items-center gap-2 lg:gap-3">
              <div className="relative hidden sm:block" ref={currencyDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
                  className="text-slate-600 dark:text-gray-300 hover:text-[#E58C28] transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span>{activeCurrency === "USD" ? "$ USD" : "₹ INR"}</span>
                  <ChevronRight
                    size={12}
                    className={`transition-transform duration-200 ${showCurrencyDropdown ? "rotate-90" : ""}`}
                  />
                </button>

                {showCurrencyDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => handleSelectCurrency("INR")}
                      className={`w-full text-left px-3 py-2 text-xs font-bold flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ${activeCurrency === "INR"
                        ? "text-[#0A4DA6] dark:text-amber-400 bg-blue-50/50 dark:bg-slate-800/50"
                        : "text-gray-700 dark:text-gray-200"
                        }`}
                    >
                      <span>₹ INR</span>
                      <span className="text-[10px] font-semibold text-gray-400">Rupee</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectCurrency("USD")}
                      className={`w-full text-left px-3 py-2 text-xs font-bold flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ${activeCurrency === "USD"
                        ? "text-[#0A4DA6] dark:text-amber-400 bg-blue-50/50 dark:bg-slate-800/50"
                        : "text-gray-700 dark:text-gray-200"
                        }`}
                    >
                      <span>$ USD</span>
                      <span className="text-[10px] font-semibold text-gray-400">Dollar</span>
                    </button>
                    <div className="border-t border-gray-100 dark:border-slate-800 px-3 py-2.5">
                      {rate ? (
                        <>
                          <div className="flex items-center justify-between gap-3 text-[11px]">
                            <span className="font-extrabold text-slate-700 dark:text-slate-200">
                              1 USD = ₹{rate.usdToInr.toLocaleString(getFormattingLocale(), {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                            <button
                              type="button"
                              onClick={() => void refreshRate()}
                              disabled={loadingRate}
                              className="font-bold text-[#0A4DA6] disabled:opacity-50"
                            >
                              {loadingRate ? "Updating…" : "Refresh"}
                            </button>
                          </div>
                          <div className="mt-1 text-[10px] leading-4 text-gray-400">
                            Live source: {" "}
                            <a
                              href={rate.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-[#0A4DA6] hover:underline"
                            >
                              {rate.source}
                            </a>
                            <br />
                            Updated {new Date(rate.updatedAt).toLocaleString(getFormattingLocale())}
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void refreshRate()}
                          disabled={loadingRate}
                          className="w-full text-left text-[11px] font-bold text-[#0A4DA6] disabled:opacity-50"
                        >
                          {loadingRate
                            ? "Loading live USD/INR rate…"
                            : "Live rate unavailable — retry"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative hidden sm:block" ref={langDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowLangDropdown(!showLangDropdown)}
                  className="text-slate-600 dark:text-gray-300 hover:text-[#0A4DA6] transition-colors p-1 cursor-pointer flex items-center gap-1 text-xs font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Languages"
                >
                  <Globe size={15} />
                  <span className="uppercase text-[11px] font-extrabold">
                    {activeLang === "hi" ? "HI" : "EN"}
                  </span>
                </button>

                {showLangDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-32 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => handleSelectLang("en")}
                      className={`w-full text-left px-3 py-2 text-xs font-bold flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ${activeLang === "en"
                        ? "text-[#0A4DA6] dark:text-amber-400 bg-blue-50/50 dark:bg-slate-800/50"
                        : "text-gray-700 dark:text-gray-200"
                        }`}
                    >
                      <span>English</span>
                      <span className="text-[10px] font-semibold text-gray-400">EN</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectLang("hi")}
                      className={`w-full text-left px-3 py-2 text-xs font-bold flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ${activeLang === "hi"
                        ? "text-[#0A4DA6] dark:text-amber-400 bg-blue-50/50 dark:bg-slate-800/50"
                        : "text-gray-700 dark:text-gray-200"
                        }`}
                    >
                      <span>हिंदी</span>
                      <span className="text-[10px] font-semibold text-gray-400">HI</span>
                    </button>
                  </div>
                )}
              </div>

              {user ? (
                <div className="flex items-center gap-2">
                  {!hasOperationalDashboard() && <CartButton />}

                  <NotificationDropdown />

                  {hasOperationalDashboard() && (
                    <Link
                      to={getDashboardPath()}
                      className="hidden sm:flex text-xs font-extrabold px-3 py-1.5 rounded-full bg-[#0A4DA6] hover:bg-blue-800 text-white shadow-sm transition-all items-center gap-1.5 shrink-0"
                    >
                      <LayoutDashboard size={13} />
                      <span className="hidden md:inline">
                        {getDashboardLabel()}
                      </span>
                    </Link>
                  )}

                  <div className="relative" ref={profileRef}>
                    <button
                      onClick={() => setProfileDropdownOpen((prev) => !prev)}
                      aria-label={`Account menu for ${user.name}`}
                      aria-haspopup="menu"
                      aria-expanded={profileDropdownOpen}
                      title={user.name}
                      className={`w-9 h-9 shrink-0 rounded-full bg-[#0A4DA6] text-white flex items-center justify-center cursor-pointer transition-all hover:bg-[#083D85] ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#0B192C] ${profileDropdownOpen
                        ? "ring-[#0A4DA6]/40"
                        : "ring-transparent"
                        }`}
                    >
                      <User size={18} />
                    </button>

                    {profileDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-50 text-xs font-bold text-gray-700 dark:text-gray-200">
                        <div className="px-3.5 py-2.5 bg-gradient-to-r from-blue-50/80 to-indigo-50/40 dark:from-slate-800/90 dark:to-slate-900/60 border-b border-gray-100 dark:border-slate-800 flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#0A4DA6] text-white flex items-center justify-center shrink-0 shadow-sm ring-1 ring-white dark:ring-slate-700">
                            <User size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="font-extrabold text-[#0B192C] dark:text-white text-xs truncate block leading-tight">
                              {user.name}
                            </span>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium truncate block leading-tight lowercase">
                              {user.email}
                            </span>
                          </div>
                        </div>

                        <div className="p-1.5 space-y-0.5">
                          {hasOperationalDashboard() && (
                            <Link
                              to={getDashboardPath()}
                              onClick={() => setProfileDropdownOpen(false)}
                              className="px-2.5 py-1.5 rounded-lg flex items-center gap-2.5 bg-blue-50/80 dark:bg-blue-950/50 text-[#0A4DA6] dark:text-blue-400 hover:bg-blue-100/80 transition-colors font-black"
                            >
                              <div className="w-6 h-6 rounded-md bg-[#0A4DA6] text-white flex items-center justify-center shrink-0">
                                <LayoutDashboard size={13} />
                              </div>
                              <span className="text-xs font-black">
                                {getDashboardLabel()}
                              </span>
                            </Link>
                          )}

                          {!hasOperationalDashboard() && (
                            <>
                              <Link
                                to="/profile"
                                onClick={() => setProfileDropdownOpen(false)}
                                className="px-2.5 py-1.5 rounded-lg flex items-center gap-2.5 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                              >
                                <div className="w-6 h-6 rounded-md bg-emerald-100/60 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                  <User size={13} />
                                </div>
                                <span className="text-xs font-bold">
                                  My Profile
                                </span>
                              </Link>

                              <Link
                                to="/profile/bookings"
                                onClick={() => setProfileDropdownOpen(false)}
                                className="px-2.5 py-1.5 rounded-lg flex items-center gap-2.5 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                              >
                                <div className="w-6 h-6 rounded-md bg-amber-100/60 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                  <Calendar size={13} />
                                </div>
                                <span className="text-xs font-bold">
                                  My Bookings &amp; Stays
                                </span>
                              </Link>

                              <Link
                                to="/profile/orders"
                                onClick={() => setProfileDropdownOpen(false)}
                                className="px-2.5 py-1.5 rounded-lg flex items-center gap-2.5 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                              >
                                <div className="w-6 h-6 rounded-md bg-blue-100/60 dark:bg-blue-950/60 text-[#0A4DA6] dark:text-blue-400 flex items-center justify-center shrink-0">
                                  <Package size={13} />
                                </div>
                                <span className="text-xs font-bold">
                                  My Orders
                                </span>
                              </Link>

                              <Link
                                to="/profile/wishlist"
                                onClick={() => setProfileDropdownOpen(false)}
                                className="px-2.5 py-1.5 rounded-lg flex items-center gap-2.5 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                              >
                                <div className="w-6 h-6 rounded-md bg-rose-100/60 dark:bg-rose-950/60 text-rose-500 dark:text-rose-400 flex items-center justify-center shrink-0">
                                  <Heart size={13} />
                                </div>
                                <span className="text-xs font-bold">
                                  Wishlist &amp; Saved
                                </span>
                              </Link>
                            </>
                          )}
                        </div>

                        <div className="p-1.5 border-t border-gray-100 dark:border-slate-800">
                          <button
                            onClick={handleLogout}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer font-bold"
                          >
                            <div className="w-6 h-6 rounded-md bg-red-100/60 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                              <LogOut size={13} />
                            </div>
                            <span className="text-xs font-bold">Sign Out</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <CartButton />
                  <Link
                    to={`/login?redirect=${encodeURIComponent(authReturnUrl)}`}
                    onClick={rememberCurrentPage}
                    className="text-xs font-bold text-slate-700 dark:text-white hover:text-[#0A4DA6] transition-colors px-3 py-1.5 rounded-full border border-gray-200 dark:border-slate-700"
                  >
                    Login
                  </Link>
                  <Link
                    to={`/register?redirect=${encodeURIComponent(authReturnUrl)}`}
                    onClick={rememberCurrentPage}
                    className="text-xs font-bold text-white bg-[#0A4DA6] hover:bg-[#083b80] transition-colors px-4 py-2 rounded-full shadow-sm"
                  >
                    Sign Up
                  </Link>
                </div>
              )}

              <button
                onClick={() => setDrawerOpen(true)}
                className="lg:hidden p-1.5 text-slate-700 dark:text-gray-200 cursor-pointer"
                aria-label="Open menu"
              >
                <Menu size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div
        className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-300 ${drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        style={{ background: "rgba(0,0,0,0.55)" }}
        onClick={() => setDrawerOpen(false)}
      />

      <div
        className={`lg:hidden fixed top-0 right-0 h-full w-[85vw] max-w-[320px] bg-white dark:bg-[#0B192C] z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-out ${drawerOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-800">
          <Link
            to="/"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-2"
          >
            <img
              src="/logo/logo.png"
              alt="Tirvona"
              className="w-8 h-8 object-contain"
            />
            <span className="font-black text-base text-[#0B192C] dark:text-white">
              tirvona
              <span className="text-[#D4AF37] text-[8px] align-super">™</span>
            </span>
          </Link>
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close menu"
          >
            <X size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto px-5 py-4 space-y-1">
          {user && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-900 rounded-2xl mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-black text-sm flex-shrink-0">
                {(user.name || user.email || "U").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <span className="text-sm font-bold text-[#0B192C] dark:text-white block truncate">
                  {user.name || user.email || "Tirvona User"}
                </span>
                <span className="text-[10px] text-gray-400 capitalize">
                  {(user.role || "customer").replace(/_/g, " ")}
                </span>
              </div>
            </div>
          )}

          <nav className="space-y-1">
            {navLinks.map((link) => {
              const isActive =
                location.pathname === link.to ||
                (link.to !== "/" && location.pathname.startsWith(link.to));
              return (
                <Link
                  key={link.label}
                  to={link.to}
                  onClick={() => setDrawerOpen(false)}
                  className={`flex items-center justify-between py-3 px-3.5 rounded-xl text-sm font-bold transition-colors ${isActive
                    ? "bg-blue-50 dark:bg-slate-800 text-[#0A4DA6] dark:text-[#E58C28]"
                    : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-900"
                    }`}
                >
                  <span>{link.label}</span>
                  <ChevronRight
                    size={14}
                    className={
                      isActive
                        ? "text-[#0A4DA6] dark:text-[#E58C28]"
                        : "text-gray-300"
                    }
                  />
                </Link>
              );
            })}

            {user && (
              <Link
                to={getDashboardPath()}
                onClick={() => setDrawerOpen(false)}
                className="flex items-center justify-between py-3.5 px-3 rounded-xl text-sm font-bold text-primary hover:bg-primary/5 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <LayoutDashboard size={15} />{" "}
                  {hasOperationalDashboard()
                    ? getDashboardLabel()
                    : "My Profile"}
                </span>
                <ChevronRight size={14} className="text-primary/50" />
              </Link>
            )}
          </nav>

          <div className="h-px bg-gray-100 dark:bg-slate-800 my-4" />

          <div className="space-y-2">
            <button
              onClick={toggleDarkMode}
              className="w-full flex items-center justify-between py-3 px-3 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-900 transition-colors"
            >
              <span className="flex items-center gap-2">
                {darkMode ? <Sun size={15} /> : <Moon size={15} />}
                {darkMode ? "Light" : "Dark"} Mode
              </span>
            </button>
            <div className="flex items-center justify-between py-3 px-3 rounded-xl text-sm text-gray-500">
              <span className="flex items-center gap-2 font-semibold">
                <Globe size={15} /> Currency
              </span>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-bold">
                <button
                  type="button"
                  onClick={() => handleSelectCurrency("INR")}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${activeCurrency === "INR"
                    ? "bg-white dark:bg-[#0A4DA6] text-[#0A4DA6] dark:text-white shadow-xs"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    }`}
                >
                  ₹ INR
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectCurrency("USD")}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${activeCurrency === "USD"
                    ? "bg-white dark:bg-[#0A4DA6] text-[#0A4DA6] dark:text-white shadow-xs"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    }`}
                >
                  $ USD
                </button>
              </div>
            </div>
            <div className="px-3 -mt-2 text-[10px] leading-4 text-gray-400">
              {rate ? (
                <>
                  <span className="font-bold text-slate-600 dark:text-slate-300">
                    1 USD = ₹{rate.usdToInr.toLocaleString(getFormattingLocale(), {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>{" "}
                  · {rate.source}
                </>
              ) : loadingRate ? (
                "Loading live exchange rate…"
              ) : (
                "Live exchange rate unavailable"
              )}
            </div>

            <div className="flex items-center justify-between py-3 px-3 rounded-xl text-sm text-gray-500">
              <span className="flex items-center gap-2 font-semibold">
                <Globe size={15} /> Language
              </span>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-bold">
                <button
                  type="button"
                  onClick={() => handleSelectLang("en")}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${activeLang === "en"
                    ? "bg-white dark:bg-[#0A4DA6] text-[#0A4DA6] dark:text-white shadow-xs"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectLang("hi")}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${activeLang === "hi"
                    ? "bg-white dark:bg-[#0A4DA6] text-[#0A4DA6] dark:text-white shadow-xs"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    }`}
                >
                  हिंदी
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-800 space-y-3">
          {user ? (
            <button
              onClick={handleLogout}
              className="w-full min-h-[48px] flex items-center justify-center gap-2 bg-danger/10 text-danger border border-danger/20 rounded-full font-bold text-sm"
            >
              <LogOut size={15} /> Logout
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Link
                to={`/login?redirect=${encodeURIComponent(authReturnUrl)}`}
                onClick={() => {
                  rememberCurrentPage();
                  setDrawerOpen(false);
                }}
                className="min-h-[48px] flex items-center justify-center bg-gray-100 dark:bg-slate-800 rounded-full font-bold text-sm text-gray-700 dark:text-gray-200"
              >
                Login
              </Link>
              <Link
                to={`/register?redirect=${encodeURIComponent(authReturnUrl)}`}
                onClick={() => {
                  rememberCurrentPage();
                  setDrawerOpen(false);
                }}
                className="min-h-[48px] flex items-center justify-center bg-primary text-white rounded-full font-bold text-sm shadow-md"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>

      <CartDrawer />

      <main className="flex-grow">
        <Outlet />
      </main>

      <footer className="bg-[#06101E] text-slate-300 pt-10 sm:pt-16 pb-0 relative overflow-hidden border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 lg:gap-12 pb-10 sm:pb-14">
            <div className="space-y-4">
              <Link to="/" className="flex items-center gap-3 group">
                <img
                  src={logo}
                  alt="Tirvona"
                  className="w-10 h-10 sm:w-11 sm:h-11 object-contain transition-transform group-hover:scale-105"
                />
                <div className="flex flex-col leading-none">
                  <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    tirvona
                    <span className="text-[#E58C28] text-xs align-super">
                      ™
                    </span>
                  </span>
                  <span className="text-[8px] sm:text-[9px] font-extrabold tracking-widest text-[#E58C28] mt-1">
                    One Nation, One Spiritual Stay
                  </span>
                </div>
              </Link>

              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                Connecting sacred destinations across India. We take care of
                every detail so you can travel with peace, comfort, and divine
                grace.
              </p>

              <div className="pt-1">
                <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80 space-y-2.5">
                  <span className="text-[10px] text-amber-400 font-extrabold tracking-wider block">
                    24/7 Pilgrim Support
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <a
                      href="tel:+917836055511"
                      className="px-3 py-2 rounded-xl bg-white/5 hover:bg-[#E58C28]/20 border border-white/10 text-xs font-extrabold text-white flex items-center gap-2 transition-colors"
                    >
                      <PhoneCall
                        size={13}
                        className="text-[#E58C28] shrink-0"
                      />
                      <span className="truncate">+91 78360 55511</span>
                    </a>
                    <a
                      href="mailto:support@tirvona.com"
                      className="px-3 py-2 rounded-xl bg-white/5 hover:bg-[#E58C28]/20 border border-white/10 text-xs font-extrabold text-slate-300 flex items-center gap-2 transition-colors"
                    >
                      <Mail size={13} className="text-[#E58C28] shrink-0" />
                      <span className="truncate">Email Support</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5 sm:gap-8 lg:col-span-2">
              <div className="space-y-3">
                <h4 className="text-xs sm:text-sm font-black text-white tracking-wider border-l-2 border-[#E58C28] pl-2.5">
                  Quick Links
                </h4>
                <ul className="text-xs space-y-2.5 text-slate-300 font-medium pt-1">
                  <li>
                    <Link
                      to="/about"
                      className="hover:text-amber-400 transition-colors flex items-center gap-1"
                    >
                      <ArrowRight
                        size={10}
                        className="text-slate-500 shrink-0"
                      />{" "}
                      About Us
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/search"
                      className="hover:text-amber-400 transition-colors flex items-center gap-1"
                    >
                      <ArrowRight
                        size={10}
                        className="text-slate-500 shrink-0"
                      />{" "}
                      Ashram Stays
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/search"
                      className="hover:text-amber-400 transition-colors flex items-center gap-1"
                    >
                      <ArrowRight
                        size={10}
                        className="text-slate-500 shrink-0"
                      />{" "}
                      Destinations
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/pilgrimage-circuits"
                      className="hover:text-amber-400 transition-colors flex items-center gap-1"
                    >
                      <ArrowRight
                        size={10}
                        className="text-slate-500 shrink-0"
                      />{" "}
                      Yatra Circuits
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/blog"
                      className="hover:text-amber-400 transition-colors flex items-center gap-1"
                    >
                      <ArrowRight
                        size={10}
                        className="text-slate-500 shrink-0"
                      />{" "}
                      Knowledge Hub
                    </Link>
                  </li>

                  <li>
                    <Link
                      to="/volunteer"
                      className="hover:text-amber-400 transition-colors flex items-center gap-1"
                    >
                      <ArrowRight
                        size={10}
                        className="text-slate-500 shrink-0"
                      />{" "}
                      Volunteer
                    </Link>
                  </li>
                </ul>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs sm:text-sm font-black text-white tracking-wider border-l-2 border-[#0A4DA6] pl-2.5">
                  Popular Services
                </h4>
                <ul className="text-xs space-y-2.5 text-slate-300 font-medium pt-1">
                  <li>
                    <Link
                      to="/search"
                      className="hover:text-amber-400 transition-colors flex items-center gap-1"
                    >
                      <ArrowRight
                        size={10}
                        className="text-slate-500 shrink-0"
                      />{" "}
                      Reservations
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/restaurants"
                      className="hover:text-amber-400 transition-colors flex items-center gap-1"
                    >
                      <ArrowRight
                        size={10}
                        className="text-slate-500 shrink-0"
                      />{" "}
                      Mahaprasad
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/parking"
                      className="hover:text-amber-400 transition-colors flex items-center gap-1"
                    >
                      <ArrowRight
                        size={10}
                        className="text-slate-500 shrink-0"
                      />{" "}
                      Parking
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/contact"
                      className="hover:text-amber-400 transition-colors flex items-center gap-1"
                    >
                      <ArrowRight
                        size={10}
                        className="text-slate-500 shrink-0"
                      />{" "}
                      Yatra Support
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs sm:text-sm font-black text-white tracking-wider border-l-2 border-emerald-500 pl-2.5">
                Stay Connected
              </h4>
              <p className="text-xs text-slate-300 font-medium leading-relaxed">
                Subscribe for sacred yatra updates, upcoming festival darshan
                alerts &amp; exclusive stays.
              </p>

              <form onSubmit={(e) => e.preventDefault()} className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    placeholder="Enter your email address..."
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#0A4DA6] transition-colors"
                  />
                  <button
                    type="submit"
                    className="w-full sm:w-auto bg-[#0A4DA6] hover:bg-blue-700 text-white text-xs font-black py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-lg transition-all cursor-pointer shrink-0"
                  >
                    <span>Subscribe</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </form>

              <div className="pt-1 space-y-2">
                <span className="text-[10px] font-extrabold text-slate-400 tracking-wider block">
                  Follow Us
                </span>
                <div className="flex items-center gap-2.5">
                  <a
                    href="https://facebook.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 hover:bg-[#0A4DA6] text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-sm group"
                    title="Facebook"
                  >
                    <svg
                      className="w-4 h-4 fill-current transition-transform group-hover:scale-110"
                      viewBox="0 0 24 24"
                    >
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </a>

                  <a
                    href="https://instagram.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-sm group"
                    title="Instagram"
                  >
                    <svg
                      className="w-4 h-4 stroke-current fill-none transition-transform group-hover:scale-110"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect
                        x="2"
                        y="2"
                        width="20"
                        height="20"
                        rx="5"
                        ry="5"
                      ></rect>
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                    </svg>
                  </a>

                  <a
                    href="https://youtube.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 hover:bg-red-600 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-sm group"
                    title="YouTube"
                  >
                    <svg
                      className="w-4 h-4 fill-current transition-transform group-hover:scale-110"
                      viewBox="0 0 24 24"
                    >
                      <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.507a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.507 9.388.507 9.388.507s7.517 0 9.388-.507a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#030914] text-slate-400 py-6 border-t border-slate-800/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-medium">
            <div>
              © {new Date().getFullYear()}{" "}
              <span className="text-white font-black">Tirvona</span>. All Rights
              Reserved.
            </div>

            <div className="flex items-center gap-6 text-xs font-semibold text-slate-400">
              <Link
                to="/privacy"
                className="hover:text-amber-400 transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                to="/terms"
                className="hover:text-amber-400 transition-colors"
              >
                Terms &amp; Conditions
              </Link>
              <Link
                to="/faq"
                className="hover:text-amber-400 transition-colors"
              >
                FAQs
              </Link>
            </div>

            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="w-10 h-10 rounded-full bg-[#0A4DA6] hover:bg-blue-600 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105 cursor-pointer shrink-0"
              title="Back to Top"
            >
              <ChevronUp size={20} className="stroke-[3]" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
export default PublicLayout;
