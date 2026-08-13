import React, { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth, type OtpChallenge } from "../contexts/AuthContext";
import OtpChallengeForm from "../components/OtpChallengeForm";
import CompleteProfileModal from "../components/CompleteProfileModal";
import useGoogleAuth from "../hooks/useGoogleAuth";
import { isGoogleConfigured } from "../lib/googleAuth";

// Small multicolor Google mark, matching the one on the login page.
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
} from "lucide-react";

import { getPostLoginRedirect } from "../utils/roleRedirect";

export const RegisterPage: React.FC = () => {
  const { registerUser, verifyRegistrationOtp, resendOtp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect");

  const [role, setRole] = useState<"customer" | "owner">("customer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [govtIdType, setGovtIdType] = useState("Aadhaar");
  const [govtIdNumber, setGovtIdNumber] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Set when a Guest Visitor registration returns an OTP challenge instead of a
  // session. While it is set, the card shows the OTP step in place of the form.
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);

  const google = useGoogleAuth((userArg) => goAfterSignup(userArg?.role));

  const handleGoogle = async () => {
    setError("");
    const message = await google.start();
    if (message) setError(message);
  };

  const goAfterSignup = (userRole?: string) => {
    const target = getPostLoginRedirect(userRole || role, redirect);
    navigate(target.url, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const payload: any = { name, email, phone, password, role };

    if (role === "owner") {
      payload.govtIdType = govtIdType;
      payload.govtIdNumber = govtIdNumber;
    }

    const res = await registerUser(payload);
    setLoading(false);
    if (res.success) {
      // New accounts confirm the OTP sent to their email before creation.
      if (res.otpRequired && res.challenge) {
        setChallenge(res.challenge);
        return;
      }
      goAfterSignup(res.user?.role);
    } else {
      setError(res.message || "Registration failed");
    }
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
      title: "SSL Secure Signup",
      sub: "Your data is protected",
    },
    {
      icon: <Landmark size={16} />,
      title: "Government",
      sub: "Verified Platform",
    },
    {
      icon: <Zap size={16} />,
      title: "Instant Access",
      sub: "Book right away",
    },
  ];

  return (
    <section className="relative w-full min-h-screen bg-[#0B192C] overflow-hidden -mt-24 lg:-mt-28">
      {/* Full-cover background; section pulled up under the floating navbar so there is no white gap */}
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
        {/* ── Left: Marketing hero ── */}
        <div className="hidden lg:flex flex-col justify-center text-white space-y-6 max-w-xl">
          {/* Heading */}
          <div className="space-y-3">
            <h1
              className="font-black leading-[1.08] tracking-tight text-white"
              style={{ fontSize: "clamp(2.4rem, 4.5vw, 3.5rem)" }}
            >
              Begin Your{" "}
              <span className="bg-gradient-to-r from-amber-200 via-[#E58C28] to-amber-400 bg-clip-text text-transparent">
                Sacred Journey
              </span>
            </h1>
            <p className="text-sm text-slate-300 max-w-lg leading-relaxed font-medium">
              Create a free account in seconds to book verified stays as a
              pilgrim — or list your ashram and welcome guests from across
              India.
            </p>
          </div>

          {/* 2x2 Feature Cards Grid */}
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

          {/* Glass Stats Card */}
          <div className="bg-gradient-to-r from-white/5 to-white/10 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex items-center justify-around shadow-xl">
            {[
              { n: "Free", l: "To Join" },
              { n: "2 min", l: "Quick Signup" },
              { n: "0", l: "Paperwork" },
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

        {/* ── Right: Register card ── */}
        <div className="w-full max-w-[400px] mx-auto lg:ml-auto lg:mr-0 space-y-3">
          <div className="bg-white/95 dark:bg-[#0B192C]/95 backdrop-blur-xl border border-white/40 dark:border-slate-800 rounded-[24px] shadow-2xl p-5 sm:p-6 space-y-3.5">
            {google.stage === "otp" && google.challenge ? (
              /* Google sign-up: verify the address before the account exists. */
              <OtpChallengeForm
                challenge={google.challenge}
                destination={google.challenge.sentTo || ""}
                title="Verify Email"
                onVerify={(otp) => google.verifyOtp(otp)}
                onResend={google.resendOtp}
                onCancel={google.reset}
                /* Advancing to the profile modal is handled by the hook. */
                onVerified={() => {}}
              />
            ) : challenge ? (
              /* OTP step — same card, same styling, form swapped out. */
              <OtpChallengeForm
                challenge={challenge}
                destination={email}
                title="Verify Email"
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
                {/* Brand */}
                <div className="text-center space-y-1">
                  <img
                    src="/logo/logo.png"
                    alt="Tirvona"
                    className="w-10 h-10 object-contain inline-block"
                  />
                  <h2 className="text-xl font-black text-[#0B192C] dark:text-white flex items-center justify-center gap-1.5">
                    Create Account{" "}
                    <ShieldCheck size={18} className="text-[#0A4DA6]" />
                  </h2>
                  <p className="text-[11px] text-gray-400 font-semibold">
                    Join the national digital spiritual stays platform
                  </p>
                </div>

                {/* Role select */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setRole("customer")}
                    className={`py-2 px-3 rounded-[14px] border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      role === "customer"
                        ? "border-[#0A4DA6] bg-[#0A4DA6]/5 text-[#0A4DA6] shadow-sm"
                        : "border-gray-200 dark:border-slate-800 text-gray-400 hover:border-gray-300"
                    }`}
                  >
                    <UserIcon size={16} />
                    <span className="text-[11px] font-bold">Guest Visitor</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("owner")}
                    className={`py-2 px-3 rounded-[14px] border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      role === "owner"
                        ? "border-[#0A4DA6] bg-[#0A4DA6]/5 text-[#0A4DA6] shadow-sm"
                        : "border-gray-200 dark:border-slate-800 text-gray-400 hover:border-gray-300"
                    }`}
                  >
                    <Building2 size={16} />
                    <span className="text-[11px] font-bold">Individual Ashram Owner</span>
                  </button>
                </div>

                {error && (
                  <div className="p-2.5 bg-danger/10 text-danger border border-danger/20 text-xs rounded-xl font-semibold">
                    {error}
                  </div>
                )}

                {/* Google sign-up is offered to Guest Visitors only; Ashram Owners
                must go through the KYC form below. */}
                {role === "customer" && (
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
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold text-[#0B192C] dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <GoogleIcon />{" "}
                      {google.busy
                        ? "Connecting…"
                        : "Create account with Google"}
                    </button>

                    <div className="flex items-center gap-2.5">
                      <span className="h-px flex-grow bg-gray-200 dark:bg-slate-800" />
                      <span className="text-[10px] font-bold text-gray-400 tracking-wider">
                        Or
                      </span>
                      <span className="h-px flex-grow bg-gray-200 dark:bg-slate-800" />
                    </div>
                  </>
                )}

                <form onSubmit={handleSubmit} className="space-y-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-extrabold text-[#0B192C] dark:text-gray-200">
                      Full Name
                    </label>
                    <div className="relative">
                      <UserIcon
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        size={15}
                      />
                      <input
                        type="text"
                        required
                        placeholder="Enter your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-extrabold text-[#0B192C] dark:text-gray-200">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        size={15}
                      />
                      <input
                        type="email"
                        required
                        placeholder="name@govt.in"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-extrabold text-[#0B192C] dark:text-gray-200">
                      Mobile Phone Number
                    </label>
                    <div className="relative">
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
                        className="w-full pl-9 pr-3.5 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-extrabold text-[#0B192C] dark:text-gray-200">
                      Security Password
                    </label>
                    <div className="relative">
                      <Lock
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        size={15}
                      />
                      <input
                        type="password"
                        required
                        minLength={6}
                        placeholder="Minimum 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                      />
                    </div>
                  </div>

                  {/* Owner KYC */}
                  {role === "owner" && (
                    <div className="p-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-[16px] space-y-2 animate-in fade-in duration-200">
                      <span className="text-[9px] font-bold text-[#0A4DA6] tracking-wider">
                        Tirvona Verification Required
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={govtIdType}
                          onChange={(e) => setGovtIdType(e.target.value)}
                          className="p-2 bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 rounded-xl text-[11px] focus:outline-none"
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
                          className="p-2 bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 rounded-xl text-[11px] focus:outline-none"
                        />
                      </div>
                      <div className="text-[9px] text-gray-400 leading-normal">
                        By submitting, you agree to undergo physical and
                        document checks by State/District officers.
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 bg-[#0A4DA6] hover:bg-[#083b80] text-white rounded-full font-extrabold text-xs shadow-md shadow-[#0A4DA6]/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60 mt-1"
                  >
                    {loading ? (
                      "Creating account…"
                    ) : (
                      <>
                        Create Account <ArrowRight size={15} />
                      </>
                    )}
                  </button>

                  <p className="text-center text-[10px] text-gray-400 font-semibold leading-relaxed pt-0.5">
                    By creating an account you agree to our{" "}
                    <Link
                      to="/terms"
                      className="text-[#0A4DA6] font-bold hover:underline"
                    >
                      Terms
                    </Link>{" "}
                    &amp;{" "}
                    <Link
                      to="/privacy"
                      className="text-[#0A4DA6] font-bold hover:underline"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </p>
                </form>

                <p className="text-center text-xs text-gray-500 dark:text-gray-400 font-semibold pt-1">
                  Already have an account?{" "}
                  <Link
                    to={`/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`}
                    className="text-[#0A4DA6] font-black hover:underline"
                  >
                    Log in here
                  </Link>
                </p>
              </>
            )}
          </div>

          {/* Trust badges */}
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

      {/* Google sign-up final step: the account is created only when this
          modal is submitted. */}
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
