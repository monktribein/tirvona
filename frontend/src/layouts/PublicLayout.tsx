import React, { useState, useEffect, useRef } from "react";
import logo from "../assets/logo.png";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../contexts/NotificationContext";
import NotificationDropdown from "../components/shared/NotificationDropdown";
import { setGuestPendingIntent } from "../utils/guestGate";
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
} from "lucide-react";

// ─── Accordion item for mobile footer ────────────────────────────────────────
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
          className={`text-xs font-extrabold uppercase tracking-wider ${titleColor}`}
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

// ─── Main Layout ──────────────────────────────────────────────────────────────
export const PublicLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { unreadCount, notifications, markAllAsRead, removeNotification } =
    useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const [showHeader, setShowHeader] = useState(true);
  const authReturnUrl = `${location.pathname}${location.search}${location.hash}`;
  const rememberCurrentPage = () =>
    setGuestPendingIntent({ type: "generic", returnUrl: authReturnUrl });

  // Hide header on scroll down, show on scroll up
  useEffect(() => {
    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY <= 40) {
        setShowHeader(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 80) {
        setShowHeader(false);
      } else if (currentScrollY < lastScrollY) {
        setShowHeader(true);
      }
      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
    setShowNotifications(false);
  }, [location.pathname]);

  // Close notification popover on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Prevent body scroll when drawer is open
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

  // Close profile dropdown on outside click
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
    if (
      [
        "district_officer",
        "state_admin",
        "govt_admin",
        "government_admin",
        "national_admin",
        "super_admin",
      ].includes(user.role)
    )
      return "/admin/dashboard";
    if (user.role === "inspector") return "/admin/verifications";
    if (user.role === "banner_manager") return "/bannerboy/dashboard";
    if (["owner", "stay_admin", "manager"].includes(user.role))
      return "/owner/dashboard";
    if (user.role === "reception") return "/staff/reception";
    if (user.role === "housekeeping") return "/staff/housekeeping";
    if (["banner_manager", "content_manager"].includes(user.role))
      return "/bannerboy/dashboard";
    if (user.role === "offer_manager") return "/owner/offers";
    if (user.role === "marketplace_manager")
      return "/admin/manage/marketplace/products";
    if (user.role === "support") return "/support-tickets";
    return "/profile";
  };

  const getDashboardLabel = () => {
    if (!user) return "Dashboard";
    if (["district_officer", "govt_admin", "super_admin"].includes(user.role))
      return "Admin Dashboard";
    if (user.role === "banner_manager") return "Banner CMS";
    if (["owner", "stay_admin"].includes(user.role))
      return "Stay Admin Dashboard";
    if (user.role === "support") return "Support Console";
    return "My Dashboard";
  };

  /**
   * Whether this user has a real operational console to jump to.
   *
   * A visitor's "dashboard" is just /profile, which the avatar menu already
   * links to — so the nav button was a duplicate taking up width. Staff and
   * admin roles land somewhere genuinely different, so they keep the shortcut.
   */
  const hasOperationalDashboard = () => {
    if (!user) return false;
    return [
      "super_admin",
      "govt_admin",
      "district_officer",
      "owner",
      "stay_admin",
      "manager",
      "reception",
      "housekeeping",
      "banner_manager",
      "support",
    ].includes(user.role);
  };

  const getRoleBadgeLabel = () => {
    if (!user) return "";
    if (user.role === "super_admin") return "Super Admin";
    if (user.role === "govt_admin") return "Govt Admin";
    if (user.role === "district_officer") return "District Admin";
    if (["owner", "stay_admin"].includes(user.role)) return "Stay Admin";
    if (user.role === "banner_manager") return "BannerBoy";
    if (user.role === "volunteer") return "Volunteer";
    if (user.role === "support") return "Support";
    return "Pilgrim";
  };

  const navLinks = [
    { label: "Stay", to: "/search", hasDropdown: false },
    { label: "Offers & Deals", to: "/offers", hasDropdown: false },
    { label: "Darshan & Seva", to: "/temples", hasDropdown: false },
    { label: "Tirvona Services", to: "/local", hasDropdown: false },
    { label: "Events", to: "/events", hasDropdown: false },
  ];

  const isHomePage = location.pathname === "/";

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
      {/* ── Sticky Header (Floating Rounded Navbar - Hide on Scroll Down, Show on Scroll Up) ── */}
      <header
        className={`sticky top-0 z-50 pt-3 pb-3 ${isHomePage ? "-mb-20 lg:-mb-24" : "mb-0"} pointer-events-none transition-all duration-300 ease-in-out transform ${
          showHeader || drawerOpen
            ? "translate-y-0 opacity-100"
            : "-translate-y-full opacity-0"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pointer-events-auto">
          {/* Simple Clean Single Floating Navbar Container */}
          <div className="bg-white/95 dark:bg-[#0B192C]/95 backdrop-blur-md border border-gray-200/90 dark:border-slate-800 rounded-full px-5 lg:px-6 py-2.5 flex items-center justify-between w-full shadow-sm hover:shadow-md transition-shadow">
            {/* Left Brand Logo Image */}
            <Link to="/" className="flex items-center gap-2 group shrink-0">
              <img
                src="/logo/logo.png"
                alt="Tirvona Sacred Destinations"
                className="h-8 sm:h-9 lg:h-10 w-auto object-contain group-hover:scale-105 transition-transform"
              />
            </Link>

            {/* Desktop nav links */}
            <nav className="hidden lg:flex items-center justify-center gap-1 xl:gap-2 text-xs xl:text-sm font-medium text-[#1E293B] dark:text-gray-200">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  className="px-3 xl:px-3.5 py-1.5 rounded-full font-bold text-slate-700 dark:text-slate-200 hover:text-[#0A4DA6] dark:hover:text-[#E58C28] hover:bg-slate-100/90 dark:hover:bg-slate-800/70 transition-all text-center whitespace-nowrap text-xs xl:text-[13px] tracking-tight"
                >
                  <span>{link.label}</span>
                </Link>
              ))}
            </nav>

            {/* Mobile spacer / menu title */}
            <div className="lg:hidden flex-1 pl-3 text-xs font-semibold text-gray-500">
              Menu
            </div>

            {/* Right Side Action & Utility Area */}
            <div className="flex items-center gap-2 lg:gap-3">
              {/* Currency selector inside navbar */}
              <button className="hidden sm:flex text-slate-600 dark:text-gray-300 hover:text-[#D4AF37] transition-colors text-xs font-semibold items-center cursor-pointer px-1.5 py-1">
                <span>₹ INR</span>
              </button>

              {/* Language globe inside navbar */}
              <button
                className="hidden sm:flex text-slate-600 dark:text-gray-300 hover:text-[#0A4DA6] transition-colors cursor-pointer p-1"
                title="Languages"
              >
                <Globe size={15} />
              </button>

              {/* User Auth / Action Buttons */}
              {user ? (
                <div className="flex items-center gap-2">
                  {/* Notifications Active Bell Dropdown */}
                  <NotificationDropdown />

                  {/* Dashboard Button — staff and admin roles only.
                        Hidden for visitors, whose dashboard is /profile and is
                        already one tap away in the avatar menu below. */}
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

                  {/* Profile Avatar Dropdown Trigger.
                        Icon only — the name and chevron were dropped because the
                        nav bar had outgrown its width. The name is not lost: it
                        is the first line of the dropdown, and it stays available
                        to screen readers and on hover via the label/title. */}
                  <div className="relative" ref={profileRef}>
                    <button
                      onClick={() => setProfileDropdownOpen((prev) => !prev)}
                      aria-label={`Account menu for ${user.name}`}
                      aria-haspopup="menu"
                      aria-expanded={profileDropdownOpen}
                      title={user.name}
                      className={`w-9 h-9 shrink-0 rounded-full bg-[#0A4DA6] text-white flex items-center justify-center cursor-pointer transition-all hover:bg-[#083D85] ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#0B192C] ${
                        profileDropdownOpen
                          ? "ring-[#0A4DA6]/40"
                          : "ring-transparent"
                      }`}
                    >
                      <User size={18} />
                    </button>

                    {/* Profile Dropdown Menu */}
                    {profileDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-50 text-xs font-bold text-gray-700 dark:text-gray-200">
                        {/* User Info Header */}
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

                        {/* Navigation Links */}
                        <div className="p-1.5 space-y-0.5">
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
                        </div>

                        {/* Sign Out */}
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

              {/* Mobile Drawer Hamburger */}
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

      {/* ── Mobile Sliding Drawer ── */}
      {/* Backdrop */}
      <div
        className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-300 ${drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        style={{ background: "rgba(0,0,0,0.55)" }}
        onClick={() => setDrawerOpen(false)}
      />

      {/* Drawer panel — slides from right */}
      <div
        className={`lg:hidden fixed top-0 right-0 h-full w-[85vw] max-w-[320px] bg-white dark:bg-[#0B192C] z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-out ${drawerOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Drawer header */}
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

        {/* Drawer body */}
        <div className="flex-grow overflow-y-auto px-5 py-4 space-y-1">
          {/* User info (if logged in) */}
          {user && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-900 rounded-2xl mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-black text-sm flex-shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <span className="text-sm font-bold text-[#0B192C] dark:text-white block truncate">
                  {user.name}
                </span>
                <span className="text-[10px] text-gray-400 capitalize">
                  {user.role.replace(/_/g, " ")}
                </span>
              </div>
            </div>
          )}

          {/* Nav links */}
          <nav className="space-y-0.5">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                onClick={() => setDrawerOpen(false)}
                className="flex items-center justify-between py-3.5 px-3 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-900 transition-colors"
              >
                {link.label}
                <ChevronRight size={14} className="text-gray-300" />
              </Link>
            ))}

            {/* Dashboard / profile link if logged in.
                Kept for every role, unlike the desktop button: this drawer has
                no other route to the profile, so hiding it for visitors would
                leave them no way in on mobile. The label follows the role so a
                visitor is not sent to "Dashboard" and shown their profile. */}
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

          {/* Divider */}
          <div className="h-px bg-gray-100 dark:bg-slate-800 my-4" />

          {/* Utilities */}
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
              <span className="flex items-center gap-2">
                <Globe size={15} /> Currency
              </span>
              <span className="font-bold text-gray-700 dark:text-gray-200">
                ₹ INR
              </span>
            </div>
          </div>
        </div>

        {/* Drawer footer — auth buttons */}
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

      {/* ── Main Content ── */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* ── Redesigned Mobile-Optimized Premium Footer ── */}
      <footer className="bg-[#06101E] text-slate-300 pt-10 sm:pt-16 pb-0 relative overflow-hidden border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main Layout Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 lg:gap-12 pb-10 sm:pb-14">
            {/* Col 1: Brand & Contact Info */}
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
                  <span className="text-[8px] sm:text-[9px] font-extrabold tracking-widest text-[#E58C28] uppercase mt-1">
                    One Nation, One Spiritual Stay
                  </span>
                </div>
              </Link>

              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                Connecting sacred destinations across India. We take care of
                every detail so you can travel with peace, comfort, and divine
                grace.
              </p>

              {/* Need Help Box - Mobile friendly side-by-side buttons */}
              <div className="pt-1">
                <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80 space-y-2.5">
                  <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-wider block">
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

            {/* Col 2 & 3: Quick Links & Popular Services (Side-by-Side 2-Column Grid on Mobile) */}
            <div className="grid grid-cols-2 gap-5 sm:gap-8 lg:col-span-2">
              {/* Quick Links */}
              <div className="space-y-3">
                <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider border-l-2 border-[#E58C28] pl-2.5">
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
                      to="/careers"
                      className="hover:text-amber-400 transition-colors flex items-center gap-1"
                    >
                      <ArrowRight
                        size={10}
                        className="text-slate-500 shrink-0"
                      />{" "}
                      Careers
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

              {/* Popular Services */}
              <div className="space-y-3">
                <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider border-l-2 border-[#0A4DA6] pl-2.5">
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
                      to="/temples"
                      className="hover:text-amber-400 transition-colors flex items-center gap-1"
                    >
                      <ArrowRight
                        size={10}
                        className="text-slate-500 shrink-0"
                      />{" "}
                      Temple Darshan
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
                      to="/local-guides"
                      className="hover:text-amber-400 transition-colors flex items-center gap-1"
                    >
                      <ArrowRight
                        size={10}
                        className="text-slate-500 shrink-0"
                      />{" "}
                      Tour Guides
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

            {/* Col 4: Newsletter & Social Connection */}
            <div className="space-y-4">
              <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider border-l-2 border-emerald-500 pl-2.5">
                Stay Connected
              </h4>
              <p className="text-xs text-slate-300 font-medium leading-relaxed">
                Subscribe for sacred yatra updates, upcoming festival darshan
                alerts &amp; exclusive stays.
              </p>

              {/* Clean Responsive Newsletter Form */}
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

              {/* Social Media Links */}
              <div className="pt-1 space-y-2">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
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

        {/* BOTTOM SUB-FOOTER BAR */}
        <div className="bg-[#030914] text-slate-400 py-6 border-t border-slate-800/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-medium">
            {/* Copyright */}
            <div>
              © {new Date().getFullYear()}{" "}
              <span className="text-white font-black">Tirvona</span>. All Rights
              Reserved.
            </div>

            {/* Legal Links */}
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
