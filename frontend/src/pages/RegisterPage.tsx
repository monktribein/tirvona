import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth, type OtpChallenge } from "../contexts/AuthContext";
import OtpChallengeForm from "../components/OtpChallengeForm";
import CompleteProfileModal from "../components/CompleteProfileModal";
import PhoneInput, { phoneProblem } from "../components/PhoneInput";
import useGoogleAuth from "../hooks/useGoogleAuth";
import { isGoogleConfigured } from "../lib/googleAuth";
import { vendorApi } from "../services/marketplace.service";
import {
  ShieldCheck,
  Mail,
  Phone,
  Lock,
  User as UserIcon,
  Building2,
  BadgeCheck,
  Headphones,
  ArrowRight,
  Landmark,
  Zap,
  Store,
  Car,
  Eye,
  EyeOff,
  Loader2,
  Check,
  ChevronDown,
} from "lucide-react";
import { getPostLoginRedirect } from "../utils/roleRedirect";

const GoogleIcon: React.FC = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
    />
  </svg>
);
import {
  ShieldCheck,
  Mail,
  Lock,
  User as UserIcon,
  Building2,
  BadgeCheck,
  Headphones,
  ArrowRight,
  Landmark,
  Zap,
  Store,
  Car,
} from "lucide-react";

import { getPostLoginRedirect } from "../utils/roleRedirect";

export const RegisterPage: React.FC = () => {
  const { registerUser, verifyRegistrationOtp, resendOtp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect");

  // "seller" is a normal Tirvona account plus a marketplace store: it signs up
  // as a customer (never a stay owner) and its store is then approved by the
  // Super Admin in Admin > Marketplace > Pending Sellers.
  const [accountType, setAccountType] = useState<"customer" | "owner" | "seller">("customer");
  const role: "customer" | "owner" = accountType === "owner" ? "owner" : "customer";

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [storeName, setStoreName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [govtIdType, setGovtIdType] = useState("Aadhaar");
  const [govtIdNumber, setGovtIdNumber] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);

  const google = useGoogleAuth((userArg) => goAfterSignup(userArg?.role));

  const handleGoogle = async () => {
    setError("");
    const message = await google.start();
    if (message) setError(message);
  };

  const goAfterSignup = async (userRole?: string) => {
    if (accountType === "seller") {
      try {
        await vendorApi.createProfile({
          storeName: storeName.trim(),
          contactPhone: phone.replace(/[\s-]/g, "") || undefined,
        });
      } catch {
        // Already has a store, or the name needs fixing: onboarding handles it.
      }
      navigate("/vendor/onboarding", { replace: true });
      return;
    }
    const target = getPostLoginRedirect(userRole || role, redirect);
    navigate(target.url, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const problem = phoneProblem(phone);
    if (problem) {
      setError(problem);
      return;
    }
    setLoading(true);

    const payload: any = { name, email, phone, password, role };

    if (role === "owner") {
      payload.govtIdType = govtIdType;
      payload.govtIdNumber = govtIdNumber;
    }

    const res = await registerUser(payload);
    setLoading(false);
    if (res.success) {
      if (res.otpRequired && res.challenge) {
        setChallenge(res.challenge);
        return;
      }
      goAfterSignup(res.user?.role);
    } else {
      setError(res.message || "Registration failed");
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const accountOptions = [
    {
      id: "customer" as const,
      title: "Guest Visitor",
      desc: "Book verified stays, aartis & live pooja",
      icon: <UserIcon size={16} />,
      disabled: false,
    },
    {
      id: "owner" as const,
      title: "Individual Stay Owner",
      desc: "List ashrams, dharamsala & sacred stays",
      icon: <Building2 size={16} />,
      disabled: false,
    },
    {
      id: "seller" as const,
      title: "Marketplace Seller",
      desc: "Sell spiritual items, puja samagri & books",
      icon: <Store size={16} />,
      disabled: false,
    },
    {
      id: "ride" as const,
      title: "Tirvona Ride",
      desc: "Pilgrimage transport partner",
      icon: <Car size={16} />,
      disabled: true,
      badge: "Coming Soon",
    },
  ];

  const selectedOption =
    accountOptions.find((o) => o.id === accountType) || accountOptions[0];

  const heroFeatures = [
    { icon: <ShieldCheck size={18} />, label: "Trusted Properties", desc: "100% verified ashrams & stays" },
    { icon: <Lock size={18} />, label: "Secure Booking", desc: "Encrypted payments & zero spam" },
    { icon: <BadgeCheck size={18} />, label: "Verified Hosts", desc: "Background-checked stay owners" },
    { icon: <Headphones size={18} />, label: "24×7 Support", desc: "Dedicated pilgrimage helpline" },
  ];

  const trustBadges = [
    {
      icon: <ShieldCheck size={15} />,
      title: "SSL 256-Bit Encryption",
      sub: "Bank-grade security",
    },
    {
      icon: <Landmark size={15} />,
      title: "Government Verified",
      sub: "Compliant platform",
    },
    {
      icon: <Zap size={15} />,
      title: "Instant Access",
      sub: "No wait times",
    },
  ];

  return (
    <section className="relative w-full min-h-screen bg-[#0B192C] overflow-hidden -mt-24 lg:-mt-28">
      {/* Background Spiritual Artwork with Gradient Overlays */}
      <img
        src="/auth-page/background.png"
        alt=""
        className="absolute inset-0 w-full h-full object-cover object-center"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      {/* Enhanced Multi-layer Atmospheric Dark Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0B192C]/95 via-[#0B192C]/80 to-[#0B192C]/65" />
      <div className="absolute inset-0 bg-radial-at-tr from-[#F28C28]/15 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-screen grid lg:grid-cols-12 gap-8 lg:gap-12 items-center pt-28 sm:pt-32 lg:pt-36 pb-12 sm:pb-16">
        
        {/* Left Column: Brand & Hero Showcase (Desktop) */}
        <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 flex-col justify-center text-white space-y-7 max-w-xl">
          <div className="space-y-3.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-[#F28C28] animate-pulse" />
              <span className="text-[11px] font-extrabold text-amber-200 tracking-wider uppercase">
                India's Sacred Stays Network
              </span>
            </div>

            <h1
              className="font-black leading-[1.12] tracking-tight text-white"
              style={{ fontSize: "clamp(2.2rem, 4vw, 3.4rem)" }}
            >
              Begin Your{" "}
              <span className="bg-gradient-to-r from-amber-200 via-[#F28C28] to-amber-400 bg-clip-text text-transparent">
                Sacred Journey
              </span>
            </h1>
            <p className="text-sm text-slate-300 max-w-lg leading-relaxed font-medium">
              Create your account in seconds to book authentic ashrams, dharamsalas, and sacred stays — or register as a host to welcome pilgrims from across India.
            </p>
          </div>

          {/* 4 Feature Value Props */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {heroFeatures.map((f) => (
              <div
                key={f.label}
                className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 hover:border-[#F28C28]/40 transition-all duration-300 group"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F28C28]/30 to-[#E58C28]/20 border border-[#F28C28]/30 flex items-center justify-center text-[#F28C28] group-hover:scale-105 transition-transform shrink-0 mt-0.5">
                  {f.icon}
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-white group-hover:text-amber-200 transition-colors">
                    {f.label}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-medium leading-snug mt-0.5">
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Stat Banner */}
          <div className="bg-gradient-to-r from-white/5 via-white/8 to-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex items-center justify-around shadow-xl">
            {[
              { n: "100%", l: "Free to Join" },
              { n: "2 min", l: "Fast Onboarding" },
              { n: "1,200+", l: "Verified Stays" },
            ].map((s, i) => (
              <React.Fragment key={s.l}>
                {i > 0 && <div className="h-8 w-px bg-white/15" />}
                <div className="text-center px-2">
                  <p className="text-xl sm:text-2xl font-black bg-gradient-to-r from-white via-amber-100 to-amber-300 bg-clip-text text-transparent">
                    {s.n}
                  </p>
                  <p className="text-[10px] text-slate-300 font-bold mt-0.5 tracking-wide">
                    {s.l}
                  </p>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Right Column: Registration Card Container */}
        <div className="w-full lg:col-span-6 xl:col-span-5 max-w-[460px] mx-auto lg:ml-auto lg:mr-0 space-y-3.5">
          <div className="bg-white dark:bg-[#0E1E33] border border-gray-100 dark:border-slate-800 rounded-[28px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.35)] p-5 sm:p-6 space-y-3.5">
            {google.stage === "otp" && google.challenge ? (
              <OtpChallengeForm
                challenge={google.challenge}
                destination={google.challenge.sentTo || ""}
                title="Verify Email"
                onVerify={(otp) => google.verifyOtp(otp)}
                onResend={google.resendOtp}
                onCancel={google.reset}
                onVerified={() => {}}
              />
            ) : challenge ? (
              <OtpChallengeForm
                challenge={challenge}
                destination={phone}
                title="Verify Mobile"
                onVerify={(otp) =>
                  verifyRegistrationOtp(challenge.otpToken, otp)
                }
                onResend={async () => {
                  const res = await resendOtp(challenge.otpToken);
                  if (res.challenge) setChallenge(res.challenge);
                  return res;
                }}
                onCancel={() => setChallenge(null)}
                onVerified={goAfterSignup}
              />
            ) : (
              <>
                {/* Header */}
                <div className="text-center space-y-1 pt-0.5">
                  <div className="inline-flex items-center justify-center p-1.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 shadow-xs mb-1">
                    <img
                      src="/logo/logo.png"
                      alt="Tirvona"
                      className="w-8 h-8 object-contain"
                    />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-[#0B192C] dark:text-white tracking-tight flex items-center justify-center gap-1.5">
                    Create Account
                    <ShieldCheck size={20} className="text-[#F28C28]" />
                  </h2>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                    Join the national digital spiritual stays platform
                  </p>
                </div>

                {/* Account Type Selector Dropdown */}
                <div className="space-y-1 relative" ref={dropdownRef}>
                  <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block">
                    Account Type <span className="text-[#F28C28]">*</span>
                  </label>
                  
                  {/* Dropdown Trigger */}
                  <button
                    type="button"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className={`w-full p-2.5 bg-gray-50/80 dark:bg-slate-900/80 border rounded-xl flex items-center justify-between gap-3 transition-all cursor-pointer ${
                      dropdownOpen
                        ? "border-[#F28C28] ring-2 ring-[#F28C28]/20 bg-white dark:bg-slate-900"
                        : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#F28C28]/10 text-[#F28C28] flex items-center justify-center shrink-0 border border-[#F28C28]/20">
                        {selectedOption.icon}
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-xs font-bold text-[#0B192C] dark:text-white truncate">
                          {selectedOption.title}
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium truncate">
                          {selectedOption.desc}
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`text-gray-400 transition-transform duration-200 shrink-0 ${
                        dropdownOpen ? "rotate-180 text-[#F28C28]" : ""
                      }`}
                    />
                  </button>

                  {/* Dropdown Menu Options */}
                  {dropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 z-40 bg-white dark:bg-[#0E1E33] border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                      {accountOptions.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={opt.disabled}
                          onClick={() => {
                            if (!opt.disabled && opt.id !== "ride") {
                              setAccountType(opt.id);
                              setDropdownOpen(false);
                            }
                          }}
                          className={`w-full p-2 rounded-xl flex items-center justify-between gap-3 text-left transition-all ${
                            opt.disabled
                              ? "opacity-50 cursor-not-allowed bg-gray-50/50 dark:bg-slate-900/30"
                              : opt.id === accountType
                                ? "bg-[#F28C28]/10 border border-[#F28C28]/30 text-[#F28C28]"
                                : "hover:bg-gray-50 dark:hover:bg-slate-800/60 text-gray-700 dark:text-gray-200 cursor-pointer"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                opt.id === accountType
                                  ? "bg-[#F28C28] text-white"
                                  : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400"
                              }`}
                            >
                              {opt.icon}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold leading-tight flex items-center gap-1.5 truncate">
                                {opt.title}
                                {opt.badge && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                                    {opt.badge}
                                  </span>
                                )}
                              </p>
                              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium leading-tight mt-0.5 truncate">
                                {opt.desc}
                              </p>
                            </div>
                          </div>
                          {opt.id === accountType && (
                            <div className="w-5 h-5 rounded-full bg-[#F28C28] text-white flex items-center justify-center shrink-0">
                              <Check size={11} strokeWidth={3} />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 text-xs rounded-xl font-bold flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600 dark:bg-rose-400 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Google Sign-in Option for Pilgrims */}
                {accountType === "customer" && (
                  <>
                    <button
                      type="button"
                      onClick={handleGoogle}
                      disabled={google.busy || !isGoogleConfigured()}
                      title={
                        isGoogleConfigured()
                          ? undefined
                          : "Google Sign-In is not configured on this deployment"
                      }
                      className="w-full h-10 flex items-center justify-center gap-2.5 bg-gray-50/80 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold text-[#0B192C] dark:text-gray-200 hover:bg-gray-100/80 dark:hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                    >
                      <GoogleIcon />
                      <span>{google.busy ? "Connecting…" : "Create account with Google"}</span>
                    </button>

                    <div className="flex items-center gap-3">
                      <span className="h-px flex-grow bg-gray-200 dark:bg-slate-800" />
                      <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                        Or continue with details
                      </span>
                      <span className="h-px flex-grow bg-gray-200 dark:bg-slate-800" />
                    </div>
                  </>
                )}

                {/* Form Inputs */}
                <form onSubmit={handleSubmit} className="space-y-3">
                  {/* Seller Store Name */}
                  {accountType === "seller" && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block">
                        Store Name <span className="text-[#F28C28]">*</span>
                      </label>
                      <div className="relative">
                        <Store
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                          size={15}
                        />
                        <input
                          type="text"
                          required
                          minLength={3}
                          maxLength={80}
                          placeholder="e.g. Haridwar Sacred Store"
                          value={storeName}
                          onChange={(e) => setStoreName(e.target.value)}
                          className="w-full h-10 pl-10 pr-3.5 bg-gray-50/60 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-medium text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:bg-white dark:focus:bg-slate-900 focus:border-[#F28C28] focus:ring-2 focus:ring-[#F28C28]/20 transition-all outline-none"
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 leading-normal pl-0.5">
                        Your shop is verified and approved by Tirvona before going live.
                      </p>
                    </div>
                  )}

                  {/* Full Name */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block">
                      Full Name <span className="text-[#F28C28]">*</span>
                    </label>
                    <div className="relative">
                      <UserIcon
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                        size={15}
                      />
                      <input
                        type="text"
                        required
                        placeholder="Enter your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full h-10 pl-10 pr-3.5 bg-gray-50/60 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-medium text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:bg-white dark:focus:bg-slate-900 focus:border-[#F28C28] focus:ring-2 focus:ring-[#F28C28]/20 transition-all outline-none"
                      />
                    </div>
                  </div>

                  {/* Email Address */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block">
                      Email Address <span className="text-[#F28C28]">*</span>
                    </label>
                    <div className="relative">
                      <Mail
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                        size={15}
                      />
                      <input
                        type="email"
                        required
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full h-10 pl-10 pr-3.5 bg-gray-50/60 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-medium text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:bg-white dark:focus:bg-slate-900 focus:border-[#F28C28] focus:ring-2 focus:ring-[#F28C28]/20 transition-all outline-none"
                      />
                    </div>
                  </div>

                  {/* Mobile Phone Number */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block">
                      Mobile Phone Number <span className="text-[#F28C28]">*</span>
                    </label>
                    <PhoneInput required value={phone} onChange={setPhone} />
                  </div>

                  {/* Security Password with Eye Toggle */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block">
                      Security Password <span className="text-[#F28C28]">*</span>
                    </label>
                    <div className="relative">
                      <Lock
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                        size={15}
                      />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={6}
                        placeholder="Minimum 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full h-10 pl-10 pr-10 bg-gray-50/60 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-medium text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:bg-white dark:focus:bg-slate-900 focus:border-[#F28C28] focus:ring-2 focus:ring-[#F28C28]/20 transition-all outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 cursor-pointer"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Stay Owner Verification Document Section */}
                  {role === "owner" && (
                    <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-xl space-y-2 animate-in fade-in duration-200">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck size={13} className="text-[#F28C28]" />
                        <span className="text-[10px] font-extrabold text-[#F28C28] tracking-wider uppercase">
                          Verification ID Required
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={govtIdType}
                          onChange={(e) => setGovtIdType(e.target.value)}
                          className="h-9 px-2 bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 rounded-lg text-[11px] font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#F28C28]"
                        >
                          <option value="Aadhaar">Aadhaar Card</option>
                          <option value="PAN">PAN Card</option>
                          <option value="Service ID">Service ID</option>
                          <option value="VoterID">Voter ID</option>
                        </select>
                        <input
                          type="text"
                          required
                          placeholder="ID Number"
                          value={govtIdNumber}
                          onChange={(e) => setGovtIdNumber(e.target.value)}
                          className="h-9 px-2.5 bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 rounded-lg text-[11px] font-medium text-[#0B192C] dark:text-white focus:outline-none focus:border-[#F28C28]"
                        />
                      </div>
                      <p className="text-[9px] text-gray-500 dark:text-gray-400 leading-snug">
                        Subject to administrative verification by Tirvona verification teams.
                      </p>
                    </div>
                  )}

                  {/* Submit CTA */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 bg-gradient-to-r from-[#F28C28] to-[#E58C28] hover:from-[#E58C28] hover:to-[#d97706] active:scale-[0.99] text-white rounded-xl font-extrabold text-xs tracking-wider shadow-md shadow-[#F28C28]/25 hover:shadow-lg hover:shadow-[#F28C28]/35 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Creating account…</span>
                      </>
                    ) : (
                      <>
                        <span>Create Account</span>
                        <ArrowRight size={15} />
                      </>
                    )}
                  </button>

                  {/* Terms & Privacy */}
                  <p className="text-center text-[10px] text-gray-500 dark:text-gray-400 font-medium leading-relaxed pt-0.5">
                    By creating an account you agree to our{" "}
                    <Link
                      to="/terms"
                      className="text-[#F28C28] font-bold hover:underline"
                    >
                      Terms
                    </Link>{" "}
                    &amp;{" "}
                    <Link
                      to="/privacy"
                      className="text-[#F28C28] font-bold hover:underline"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </p>
                </form>

                {/* Login Prompt Footer */}
                <div className="pt-2 border-t border-gray-100 dark:border-slate-800/80 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    Already have an account?{" "}
                    <Link
                      to={`/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`}
                      className="text-[#F28C28] font-black hover:underline ml-0.5"
                    >
                      Log in here
                    </Link>
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Trust Badges Below Card */}
          <div className="grid grid-cols-3 gap-2 px-2 text-white">
            {trustBadges.map((b) => (
              <div
                key={b.title}
                className="flex items-center gap-2 justify-center"
              >
                <div className="text-[#F28C28] shrink-0">{b.icon}</div>
                <div className="leading-tight text-left">
                  <p className="text-[10px] sm:text-[11px] font-bold text-slate-200">
                    {b.title}
                  </p>
                  <p className="text-[9px] text-slate-400 font-medium hidden sm:block">
                    {b.sub}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {google.stage === "profile" && (
        <CompleteProfileModal
          email={google.email}
          suggestedName={google.suggestedName}
          onSubmit={google.completeProfile}
          onDone={goAfterSignup}
          onCancel={google.reset}
        />
      )}
    </section>
  );
};
export default RegisterPage;
