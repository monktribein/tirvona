"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LogOut,
  ChevronRight,
  Bell,
  Globe,
  ShieldCheck,
  User,
  LayoutDashboard,
  BookOpen,
  Calendar,
  Sparkles,
  Menu,
  X,
  ChevronDown,
  Check,
  Users,
} from "lucide-react";
import { panditService } from "../../services/pandit.service";
import type { ProviderProfile } from "../../types/pandit.types";
import { PROVIDER_TYPE_LABELS } from "../../types/pandit.types";

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();

  // Scroll hide/show states exactly matching Tirvona PublicLayout
  const [navbarVisible, setNavbarVisible] = useState(true);
  const lastNavbarScrollY = useRef(0);
  const navbarScrollFrame = useRef<number | null>(null);

  // Active Role state: "ADMIN" | "PANDIT" | "ACHARYA" | "KATHA_VACHAK" | "JYOTISHI"
  const [activeRole, setActiveRole] = useState<string>("ADMIN");
  const [currentProfile, setCurrentProfile] = useState<ProviderProfile | null>(null);

  // Dropdown states
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [activeCurrency, setActiveCurrency] = useState<"INR" | "USD">("INR");
  const [activeLang, setActiveLang] = useState<"EN" | "HI">("EN");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const currencyDropdownRef = useRef<HTMLDivElement>(null);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  // Load current profile or role from localStorage
  useEffect(() => {
    try {
      const storedRole = localStorage.getItem("tirvona_user_role");
      if (storedRole) {
        setActiveRole(storedRole);
      } else if (pathname.startsWith("/admin")) {
        setActiveRole("ADMIN");
      } else {
        setActiveRole("PANDIT");
      }

      const rawProfile = localStorage.getItem("tirvona_pandit_profile");
      if (rawProfile) {
        setCurrentProfile(JSON.parse(rawProfile));
      }
    } catch (e) {
      console.error(e);
    }
  }, [pathname]);

  // Handle Role Switching
  const handleRoleChange = (role: string) => {
    setActiveRole(role);
    localStorage.setItem("tirvona_user_role", role);
    setShowRoleDropdown(false);

    if (role === "ADMIN") {
      router.push("/admin");
    } else {
      router.push("/pandit");
    }
  };

  // Scroll detection logic with smooth hysteresis buffer
  useEffect(() => {
    const updateNavbar = () => {
      const currentScrollY = Math.max(window.scrollY, 0);
      const scrollDifference = currentScrollY - lastNavbarScrollY.current;

      if (currentScrollY <= 40) {
        setNavbarVisible(true);
        lastNavbarScrollY.current = currentScrollY;
      } else if (scrollDifference > 12) {
        // Scrolling down -> hide navbar smoothly
        setNavbarVisible(false);
        lastNavbarScrollY.current = currentScrollY;
      } else if (scrollDifference < -12) {
        // Scrolling up -> show navbar smoothly
        setNavbarVisible(true);
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
    setDrawerOpen(false);
  }, [pathname]);

  // Click outside listeners for dropdowns
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        roleDropdownRef.current &&
        !roleDropdownRef.current.contains(e.target as Node)
      ) {
        setShowRoleDropdown(false);
      }
      if (
        currencyDropdownRef.current &&
        !currencyDropdownRef.current.contains(e.target as Node)
      ) {
        setShowCurrencyDropdown(false);
      }
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

  const handleLogout = () => {
    if (confirm("Are you sure you want to log out of Pandit Portal?")) {
      localStorage.removeItem("ab_token");
      router.push("/pandit/explore");
    }
  };

  // Determine Dashboard Label based on current active role
  const getDashboardButton = () => {
    if (activeRole === "ADMIN") {
      return {
        label: "Admin Dashboard",
        href: "/admin",
        icon: ShieldCheck,
      };
    }
    if (activeRole === "ACHARYA") {
      return {
        label: "Acharya Dashboard",
        href: "/pandit",
        icon: LayoutDashboard,
      };
    }
    if (activeRole === "KATHA_VACHAK") {
      return {
        label: "Katha Vachak Dashboard",
        href: "/pandit",
        icon: LayoutDashboard,
      };
    }
    if (activeRole === "JYOTISHI") {
      return {
        label: "Jyotishi Dashboard",
        href: "/pandit",
        icon: LayoutDashboard,
      };
    }
    return {
      label: "Pandit Dashboard",
      href: "/pandit",
      icon: LayoutDashboard,
    };
  };

  const dashboardBtn = getDashboardButton();
  const IconComponent = dashboardBtn.icon;

  // Determine Navigation links depending on whether user is in Admin, Provider, or Public Mode
  const navLinks = [
    { label: "Public Portal", href: "/pandit/explore" },
    { label: "Search Pandits", href: "/search" },
    { label: "Offerings", href: "/pandit/offerings" },
    { label: "Availability", href: "/pandit/availability" },
    { label: "Verification", href: "/pandit/verification" },
  ];

  return (
    <header
      className={`sticky top-0 z-50 pt-3 pb-3 pointer-events-none transform-gpu transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[transform,opacity] ${
        navbarVisible
          ? "translate-y-0 opacity-100 scale-100"
          : "-translate-y-full opacity-0 scale-[0.98] pointer-events-none"
      }`}
      aria-hidden={!navbarVisible}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pointer-events-auto">
        <div className="bg-white/95 dark:bg-[#0B192C]/95 backdrop-blur-md border border-gray-200/90 dark:border-slate-800 rounded-full px-4 lg:px-6 py-2 flex items-center justify-between w-full shadow-sm hover:shadow-md transition-shadow">
          {/* Real Tirvona Logo Branding */}
          <Link href="/pandit/explore" className="flex items-center gap-2 group shrink-0">
            <img
              src="/logo.png"
              alt="Tirvona Sacred Destinations"
              className="h-8 sm:h-9 lg:h-9.5 w-auto object-contain group-hover:scale-105 transition-transform"
            />
          </Link>

          {/* Desktop Navigation Links (Exact Tirvona Landing Page Pill Style) */}
          <nav className="hidden lg:flex items-center justify-center gap-0.5 xl:gap-1.5 text-xs font-medium text-[#1E293B] dark:text-gray-200">
            {navLinks.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`px-3 xl:px-3.5 py-1.5 rounded-full font-bold transition-all text-center whitespace-nowrap text-xs xl:text-[13px] tracking-tight ${
                    isActive
                      ? "text-[#0A4DA6] dark:text-[#E58C28] bg-blue-50/90 dark:bg-slate-800 shadow-2xs font-extrabold"
                      : "text-slate-700 dark:text-slate-200 hover:text-[#0A4DA6] dark:hover:text-[#E58C28] hover:bg-slate-100/90 dark:hover:bg-slate-800/70"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Mobile Menu Button */}
          <div className="lg:hidden flex-1 pl-3 text-xs font-semibold text-gray-500">
            <button
              type="button"
              onClick={() => setDrawerOpen(!drawerOpen)}
              className="p-1 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              {drawerOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          {/* Right Action Controls: Role Switcher, Currency, Language, Dynamic Dashboard, Profile Avatar */}
          <div className="flex items-center gap-2 lg:gap-3">
            {/* Currency Selector */}
            <div className="relative hidden sm:block" ref={currencyDropdownRef}>
              <button
                type="button"
                onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
                className="text-slate-600 dark:text-gray-300 hover:text-[#E58C28] transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span>{activeCurrency === "USD" ? "$ USD" : "₹ INR"}</span>
                <ChevronRight
                  size={12}
                  className={`transition-transform duration-200 ${
                    showCurrencyDropdown ? "rotate-90" : ""
                  }`}
                />
              </button>

              {showCurrencyDropdown && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl shadow-xl z-50 py-1 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCurrency("INR");
                      setShowCurrencyDropdown(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs font-bold flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ${
                      activeCurrency === "INR"
                        ? "text-[#0A4DA6] bg-blue-50/50"
                        : "text-gray-700 dark:text-gray-200"
                    }`}
                  >
                    <span>₹ INR</span>
                    <span className="text-[10px] text-gray-400">Rupee</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCurrency("USD");
                      setShowCurrencyDropdown(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs font-bold flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ${
                      activeCurrency === "USD"
                        ? "text-[#0A4DA6] bg-blue-50/50"
                        : "text-gray-700 dark:text-gray-200"
                    }`}
                  >
                    <span>$ USD</span>
                    <span className="text-[10px] text-gray-400">Dollar</span>
                  </button>
                </div>
              )}
            </div>

            {/* Language Selector */}
            <div className="relative hidden sm:block" ref={langDropdownRef}>
              <button
                type="button"
                onClick={() => setShowLangDropdown(!showLangDropdown)}
                className="text-slate-600 dark:text-gray-300 hover:text-[#E58C28] transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Globe size={13} className="text-gray-500" />
                <span>{activeLang}</span>
              </button>

              {showLangDropdown && (
                <div className="absolute right-0 top-full mt-2 w-36 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl shadow-xl z-50 py-1 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveLang("EN");
                      setShowLangDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    English (EN)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveLang("HI");
                      setShowLangDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    हिन्दी (HI)
                  </button>
                </div>
              )}
            </div>

            {/* Notification Bell */}
            <button
              type="button"
              className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 relative cursor-pointer"
              title="Notifications"
            >
              <Bell size={15} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#E58C28]" />
            </button>

            {/* Role Switcher & Dynamic Dashboard Button */}
            <div className="relative" ref={roleDropdownRef}>
              <div className="flex items-center">
                <Link
                  href={dashboardBtn.href}
                  className="px-3.5 sm:px-4 py-2 rounded-l-full bg-[#0A4DA6] hover:bg-[#083D85] text-white font-bold text-xs shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <IconComponent size={14} />
                  <span>{dashboardBtn.label}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                  title="Switch Role"
                  className="px-2 py-2 rounded-r-full bg-[#083b80] hover:bg-[#062c60] text-white border-l border-blue-400/30 transition flex items-center justify-center cursor-pointer"
                >
                  <ChevronDown size={14} className={`transition-transform ${showRoleDropdown ? "rotate-180" : ""}`} />
                </button>
              </div>

              {/* Role Selection Dropdown */}
              {showRoleDropdown && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl shadow-2xl z-50 py-2 overflow-hidden text-xs">
                  <div className="px-3 py-1 text-[10px] uppercase font-extrabold text-gray-400">
                    Switch User Role
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRoleChange("ADMIN")}
                    className="w-full text-left px-3.5 py-2 hover:bg-blue-50 dark:hover:bg-slate-800 font-bold flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <ShieldCheck size={14} className="text-[#0A4DA6]" />
                      Super Admin
                    </span>
                    {activeRole === "ADMIN" && <Check size={14} className="text-[#0A4DA6]" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRoleChange("PANDIT")}
                    className="w-full text-left px-3.5 py-2 hover:bg-blue-50 dark:hover:bg-slate-800 font-bold flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <User size={14} className="text-[#E58C28]" />
                      Pandit / Purohit
                    </span>
                    {activeRole === "PANDIT" && <Check size={14} className="text-[#0A4DA6]" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRoleChange("ACHARYA")}
                    className="w-full text-left px-3.5 py-2 hover:bg-blue-50 dark:hover:bg-slate-800 font-bold flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <User size={14} className="text-[#0A4DA6]" />
                      Acharya (Scholar)
                    </span>
                    {activeRole === "ACHARYA" && <Check size={14} className="text-[#0A4DA6]" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRoleChange("KATHA_VACHAK")}
                    className="w-full text-left px-3.5 py-2 hover:bg-blue-50 dark:hover:bg-slate-800 font-bold flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <BookOpen size={14} className="text-[#E58C28]" />
                      Katha Vachak
                    </span>
                    {activeRole === "KATHA_VACHAK" && <Check size={14} className="text-[#0A4DA6]" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRoleChange("JYOTISHI")}
                    className="w-full text-left px-3.5 py-2 hover:bg-blue-50 dark:hover:bg-slate-800 font-bold flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles size={14} className="text-[#E58C28]" />
                      Jyotishi (Astrologer)
                    </span>
                    {activeRole === "JYOTISHI" && <Check size={14} className="text-[#0A4DA6]" />}
                  </button>
                </div>
              )}
            </div>

            {/* Provider Profile Avatar Button */}
            <Link
              href="/pandit/profile"
              title="Provider Profile"
              className="w-9 h-9 rounded-full bg-[#0A4DA6] text-white flex items-center justify-center font-bold text-xs shadow-sm hover:scale-105 transition cursor-pointer"
            >
              <User size={16} />
            </Link>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {drawerOpen && (
          <div className="lg:hidden mt-2 bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 rounded-3xl p-4 shadow-xl space-y-2 pointer-events-auto">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setDrawerOpen(false)}
                className="block px-4 py-2.5 rounded-2xl font-bold text-xs text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-slate-800"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <Link
                href={dashboardBtn.href}
                onClick={() => setDrawerOpen(false)}
                className="text-xs font-bold text-[#0A4DA6]"
              >
                {dashboardBtn.label}
              </Link>
              <button
                onClick={handleLogout}
                className="text-xs font-bold text-rose-500"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
