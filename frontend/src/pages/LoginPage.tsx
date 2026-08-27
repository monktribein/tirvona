import React, { useEffect, useRef, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth, type OtpChallenge } from "../contexts/AuthContext";
import OtpChallengeForm from "../components/OtpChallengeForm";
import CompleteProfileModal from "../components/CompleteProfileModal";
import useGoogleAuth from "../hooks/useGoogleAuth";
import { isGoogleConfigured } from "../lib/googleAuth";
import {
  ShieldCheck,
  Lock,
  Mail,
  Phone,
  Send,
  Loader2,
  Eye,
  EyeOff,
  BadgeCheck,
  Headphones,
  ArrowRight,
  Landmark,
  Zap,
  Smartphone,
} from "lucide-react";
import { authService } from "../services";
import { getErrorMessage } from "../lib/api";
import { getPostLoginRedirect } from "../utils/roleRedirect";

const GoogleIcon: React.FC = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
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

export const LoginPage: React.FC = () => {
  const { user, login, loginOTP, verifyLoginOtp, resendOtp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect");

  const [useOtp, setUseOtp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [otpCode, setOtpCode] = useState("");
  const [serverOtpMsg, setServerOtpMsg] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [suspensionInfo, setSuspensionInfo] = useState<any | null>(null);
  const [loginChallenge, setLoginChallenge] = useState<OtpChallenge | null>(
    null,
  );
  const verifiedLoginUser = useRef<any>(null);

  const goAfterAuthentication = (
    role?: string,
    parkingRoles?: string[],
    userEmail?: string,
  ) => {
    const target = getPostLoginRedirect(
      role,
      redirect,
      parkingRoles,
      userEmail,
    );
    navigate(target.url, { replace: true });
  };

  const google = useGoogleAuth((userArg) => {
    goAfterAuthentication(
      userArg?.role,
      userArg?.parkingRoles,
      userArg?.email,
    );
  });

  const handleGoogle = async () => {
    setError("");
    setNotice("");
    const message = await google.start();
    if (message) setError(message);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuspensionInfo(null);
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (res.success) {
      goAfterAuthentication(
        res.user?.role,
        res.user?.parkingRoles,
        res.user?.email,
      );
    } else {
      if (res.isSuspended && res.suspensionData) {
        setSuspensionInfo(res.suspensionData);
      } else {
        setError(res.message || "Login failed");
      }
    }
  };

  const handleForgotPassword = async () => {
    setError("");
    setNotice("");
    const identifier = email.trim();
    if (!identifier) {
      setError(
        "Enter your registered email address above, then click Forgot Password.",
      );
      return;
    }
    if (!identifier.includes("@")) {
      setError(
        "Password reset links are sent by email. Please enter your registered email address.",
      );
      return;
    }

    setLoading(true);
    try {
      const res = await authService.forgotPassword(identifier);
      setNotice(
        res.data.message ||
          "If that email is registered, a password reset link has been sent to it.",
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Could not send the reset link. Please try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const handleSendOtp = async (e: React.MouseEvent) => {
    e.preventDefault();
    setError("");
    if (!phone) return setError("Enter phone number");
    setSendingOtp(true);
    // A very fast response makes the spinner flash and read as "nothing
    // happened", so hold it briefly before showing the result.
    const startedAt = Date.now();
    const settle = async () => {
      const elapsed = Date.now() - startedAt;
      if (elapsed < 700)
        await new Promise((resolve) => setTimeout(resolve, 700 - elapsed));
      setSendingOtp(false);
    };
    try {
      const res = await authService.sendOtp(phone);
      await settle();
      if (res.data.success) {
        setOtpSent(true);
        setResendIn(30);
        setServerOtpMsg("OTP sent to your WhatsApp number.");
      }
    } catch (err) {
      await settle();
      setError(getErrorMessage(err, "Error requesting OTP"));
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await loginOTP(phone, otpCode);
    setLoading(false);
    if (res.success) {
      goAfterAuthentication(
        res.user?.role,
        res.user?.parkingRoles,
        res.user?.email,
      );
    } else {
      setError(res.message || "Invalid OTP");
    }
  };

  const switchMode = (otp: boolean) => {
    setUseOtp(otp);
    setError("");
    setNotice("");
  };

  const heroFeatures = [
    { icon: <ShieldCheck size={18} />, label: "Trusted Properties" },
    { icon: <Lock size={18} />, label: "Secure Booking" },
    { icon: <BadgeCheck size={18} />, label: "Verified Hosts" },
    { icon: <Headphones size={18} />, label: "24×7 Support" },
  ];

  const trustBadges = [
    {
      icon: <ShieldCheck size={16} />,
      title: "SSL Secure Login",
      sub: "Your data is protected",
    },
    {
      icon: <Landmark size={16} />,
      title: "Government",
      sub: "Verified Platform",
    },
    {
      icon: <Zap size={16} />,
      title: "Fast OTP Delivery",
      sub: "Instant & reliable",
    },
  ];

  return (
    <section className="relative w-full min-h-screen bg-[#0B192C] overflow-hidden -mt-24 lg:-mt-28">
      <img
        src="/auth-page/background.png"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0B192C]/90 via-[#0B192C]/60 to-[#0A4DA6]/25" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-screen grid lg:grid-cols-2 gap-10 lg:gap-12 items-center pt-36 lg:pt-40 pb-16">
        <div className="hidden lg:flex flex-col justify-center text-white space-y-6 max-w-xl">
          <div className="space-y-3">
            <h1
              className="font-black leading-[1.08] tracking-tight text-white"
              style={{ fontSize: "clamp(2.4rem, 4.5vw, 3.5rem)" }}
            >
              Discover{" "}
              <span className="bg-gradient-to-r from-amber-200 via-[#E58C28] to-amber-400 bg-clip-text text-transparent">
                Divine Stays
              </span>
              <br />&amp; Sacred Retreats
            </h1>
            <p className="text-sm text-slate-300 max-w-lg leading-relaxed font-medium">
              Sign in to manage verified ashram bookings, view digital check-in
              passes, and experience seamless spiritual stays across Rishikesh,
              Haridwar &amp; Varanasi.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            {heroFeatures.map((f) => (
              <div
                key={f.label}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 hover:border-[#E58C28]/40 transition-all duration-300 group"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0A4DA6]/40 to-[#E58C28]/30 border border-white/15 flex items-center justify-center text-[#E58C28] group-hover:scale-105 transition-transform shrink-0">
                  {f.icon}
                </div>
                <span className="font-extrabold text-xs text-slate-200 group-hover:text-white transition-colors">
                  {f.label}
                </span>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-r from-white/5 to-white/10 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex items-center justify-around shadow-xl">
            {[
              { n: "1,200+", l: "Verified Ashrams" },
              { n: "50+", l: "Sacred Cities" },
              { n: "25k+", l: "Happy Pilgrims" },
            ].map((s, i) => (
              <React.Fragment key={s.l}>
                {i > 0 && <div className="h-8 w-px bg-white/15" />}
                <div className="text-center">
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

        <div className="w-full max-w-[400px] mx-auto lg:ml-auto lg:mr-0 space-y-3">
          <div className="bg-white/95 dark:bg-[#0B192C]/95 backdrop-blur-xl border border-white/40 dark:border-slate-800 rounded-[24px] shadow-2xl p-5 sm:p-6 space-y-3.5">
            <div className="text-center space-y-1">
              <img
                src="/logo/logo.png"
                alt="Tirvona"
                className="w-10 h-10 object-contain inline-block"
              />
              <h2 className="text-xl font-black text-[#0B192C] dark:text-white">
                Welcome Back <span className="align-middle">👋</span>
              </h2>
              <p className="text-[11px] text-gray-400 font-semibold">
                Sign in to continue your spiritual journey
              </p>
            </div>

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
            ) : loginChallenge ? (
              <OtpChallengeForm
                challenge={loginChallenge}
                destination={email}
                title="Verify OTP"
                onVerify={async (otp) => {
                  const result = await verifyLoginOtp(
                    loginChallenge.otpToken,
                    otp,
                  );
                  if (result.success) verifiedLoginUser.current = result.user;
                  return result;
                }}
                onResend={async () => {
                  const res = await resendOtp(loginChallenge.otpToken);
                  if (res.challenge) setLoginChallenge(res.challenge);
                  return res;
                }}
                onCancel={() => setLoginChallenge(null)}
                onVerified={() => {
                  const authenticated = verifiedLoginUser.current || user;
                  goAfterAuthentication(
                    authenticated?.role,
                    authenticated?.parkingRoles,
                    authenticated?.email,
                  );
                }}
              />
            ) : (
              <>
                <div className="flex bg-gray-100 dark:bg-slate-900 p-1 rounded-full">
                  <button
                    onClick={() => switchMode(false)}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-full transition-all cursor-pointer ${!useOtp ? "bg-white dark:bg-slate-800 text-[#0A4DA6] shadow-sm" : "text-gray-400 hover:text-gray-500"}`}
                  >
                    Password
                  </button>
                  <button
                    onClick={() => switchMode(true)}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-full transition-all cursor-pointer ${useOtp ? "bg-white dark:bg-slate-800 text-[#0A4DA6] shadow-sm" : "text-gray-400 hover:text-gray-500"}`}
                  >
                    Mobile OTP
                  </button>
                </div>

                {suspensionInfo ? (
                  <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-5 space-y-3 text-left shadow-lg animate-in zoom-in-95 duration-150">
                    <div className="flex items-center gap-3 border-b border-rose-200 dark:border-rose-900/60 pb-3">
                      <div className="w-9 h-9 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-300 flex items-center justify-center shrink-0">
                        <ShieldCheck size={18} />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-xs text-rose-800 dark:text-rose-200">
                          {suspensionInfo.suspensionType === "permanent"
                            ? "Account Permanently Suspended"
                            : "Account Temporarily Suspended"}
                        </h3>
                        <p className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                          Access to Tirvona platform has been restricted by
                          System Administration.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between items-center py-1 border-b border-rose-100 dark:border-rose-900/40">
                        <span className="text-gray-500 font-bold">Reason:</span>
                        <span className="font-extrabold text-rose-700 dark:text-rose-300">
                          {suspensionInfo.suspensionReason}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-rose-100 dark:border-rose-900/40">
                        <span className="text-gray-500 font-bold">
                          Suspended By:
                        </span>
                        <span className="font-bold text-gray-700 dark:text-gray-200">
                          {suspensionInfo.suspendedBy || "Super Admin"}
                        </span>
                      </div>

                      {suspensionInfo.suspendedAt && (
                        <div className="flex justify-between items-center py-1 border-b border-rose-100 dark:border-rose-900/40">
                          <span className="text-gray-500 font-bold">
                            Suspended On:
                          </span>
                          <span className="font-medium text-gray-700 dark:text-gray-200">
                            {suspensionInfo.suspendedAt}
                          </span>
                        </div>
                      )}

                      {suspensionInfo.suspensionType === "temporary" && (
                        <>
                          <div className="flex justify-between items-center py-1 border-b border-rose-100 dark:border-rose-900/40">
                            <span className="text-gray-500 font-bold">
                              Suspension Ends:
                            </span>
                            <span className="font-bold text-gray-700 dark:text-gray-200">
                              {suspensionInfo.suspensionEndDate || "N/A"}
                            </span>
                          </div>

                          <div className="flex justify-between items-center py-1">
                            <span className="text-gray-500 font-bold">
                              Remaining Duration:
                            </span>
                            <span className="font-black text-rose-600 dark:text-rose-400">
                              {suspensionInfo.remainingDays !== null
                                ? `${suspensionInfo.remainingDays} Days`
                                : "N/A"}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {suspensionInfo.visibleMessage && (
                      <div className="p-2.5 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-rose-100 dark:border-rose-900 text-[11px] text-rose-800 dark:text-rose-300 italic">
                        "{suspensionInfo.visibleMessage}"
                      </div>
                    )}

                    <div className="pt-2 border-t border-rose-200 dark:border-rose-900/60 text-center space-y-1.5">
                      <p className="text-xs font-bold text-gray-600 dark:text-gray-300">
                        Need Help? Contact Support
                      </p>
                      <a
                        href="mailto:support@tirvona.com"
                        className="inline-block px-4 py-1.5 rounded-full bg-rose-600 text-white font-extrabold text-[11px] hover:bg-rose-700 transition-colors shadow-md"
                      >
                        support@tirvona.com
                      </a>
                      <div>
                        <button
                          onClick={() => setSuspensionInfo(null)}
                          className="text-[10px] text-gray-400 underline font-semibold mt-0.5 cursor-pointer"
                        >
                          Back to Login
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {error && (
                      <div className="p-2.5 bg-danger/10 text-danger border border-danger/20 text-xs rounded-xl font-semibold">
                        {error}
                      </div>
                    )}
                    {notice && (
                      <div className="p-2.5 bg-[#0A4DA6]/10 text-[#0A4DA6] border border-[#0A4DA6]/20 text-xs rounded-xl font-semibold">
                        {notice}
                      </div>
                    )}
                  </>
                )}

                {!useOtp ? (
                  <form onSubmit={handlePasswordSubmit} className="space-y-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-extrabold text-[#0B192C] dark:text-gray-200">
                        Email / Phone
                      </label>
                      <div className="relative">
                        <Mail
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                          size={15}
                        />
                        <input
                          type="text"
                          required
                          placeholder="name@govt.in or +91 98765 43210"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-9 pr-3.5 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-extrabold text-[#0B192C] dark:text-gray-200">
                        Password
                      </label>
                      <div className="relative">
                        <Lock
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                          size={15}
                        />
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-9 pr-9 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? (
                            <EyeOff size={15} />
                          ) : (
                            <Eye size={15} />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-0.5">
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={remember}
                          onChange={(e) => setRemember(e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-[#0A4DA6] cursor-pointer"
                        />
                        <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                          Remember me
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={loading}
                        className="text-[11px] font-bold text-[#0A4DA6] hover:underline cursor-pointer disabled:opacity-60"
                      >
                        Forgot Password?
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 bg-[#0A4DA6] hover:bg-[#083b80] text-white font-extrabold rounded-full text-xs shadow-md shadow-[#0A4DA6]/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60 mt-1"
                    >
                      {loading ? (
                        "Signing in…"
                      ) : (
                        <>
                          Continue <ArrowRight size={15} />
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleOtpSubmit} className="space-y-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-extrabold text-[#0B192C] dark:text-gray-200">
                        Mobile Phone Number
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-grow">
                          <Phone
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                            size={15}
                          />
                          <input
                            type="tel"
                            required
                            placeholder="+91 98765 43210"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={sendingOtp || resendIn > 0}
                          className="px-3.5 py-2 bg-[#25D366] text-white rounded-xl text-xs font-bold hover:bg-[#1FB855] transition-all cursor-pointer shrink-0 inline-flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {sendingOtp ? (
                            <>
                              <Loader2 size={13} className="animate-spin" />
                              Sending…
                            </>
                          ) : resendIn > 0 ? (
                            `Resend in ${resendIn}s`
                          ) : (
                            <>
                              <Send size={13} />
                              {otpSent ? "Resend on WhatsApp" : "Get OTP on WhatsApp"}
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {otpSent && (
                      <div className="space-y-2.5 animate-in fade-in duration-200">
                        <div className="p-2.5 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200/50 text-[10px] rounded-xl font-semibold leading-relaxed">
                          {serverOtpMsg}
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-extrabold text-[#0B192C] dark:text-gray-200">
                            Enter 6-digit OTP Code
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={6}
                            placeholder="123456"
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs text-center tracking-[0.4em] font-extrabold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full py-2.5 bg-[#0A4DA6] hover:bg-[#083b80] text-white rounded-full font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
                        >
                          {loading ? (
                            "Verifying…"
                          ) : (
                            <>
                              Verify &amp; Continue <ArrowRight size={15} />
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </form>
                )}

                <div className="flex items-center gap-2.5">
                  <span className="h-px flex-grow bg-gray-200 dark:bg-slate-800" />
                  <span className="text-[10px] font-bold text-gray-400 tracking-wider">
                    Or
                  </span>
                  <span className="h-px flex-grow bg-gray-200 dark:bg-slate-800" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleGoogle}
                    disabled={google.busy || !isGoogleConfigured()}
                    title={
                      isGoogleConfigured()
                        ? undefined
                        : "Google Sign-In is not configured on this deployment"
                    }
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold text-[#0B192C] dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <GoogleIcon />{" "}
                    {google.busy ? "Connecting…" : "Continue with Google"}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode(true)}
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold text-[#0B192C] dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    <Smartphone size={15} className="text-[#0A4DA6]" /> Login
                    with Mobile OTP
                  </button>
                </div>

                <p className="text-center text-xs text-gray-500 dark:text-gray-400 font-semibold pt-0.5">
                  Don't have an account?{" "}
                  <Link
                    to={`/register${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`}
                    className="text-[#0A4DA6] font-black hover:underline"
                  >
                    Create Account
                  </Link>
                </p>

                <p className="flex items-center justify-center gap-1.5 text-[10px] text-gray-400 font-semibold">
                  <Lock size={11} /> 256-bit encrypted sign-in · We never share
                  your data
                </p>
              </>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 text-white">
            {trustBadges.map((b) => (
              <div
                key={b.title}
                className="flex items-center gap-2 justify-center sm:justify-start"
              >
                <div className="text-[#E58C28] shrink-0">{b.icon}</div>
                <div className="leading-tight">
                  <p className="text-[10px] sm:text-[11px] font-black">
                    {b.title}
                  </p>
                  <p className="text-[9px] text-gray-300 font-semibold hidden sm:block">
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
          onDone={() => goAfterAuthentication(user?.role, user?.parkingRoles)}
          onCancel={google.reset}
        />
      )}
    </section>
  );
};
export default LoginPage;
