import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { authService } from "../services";
import { getErrorMessage } from "../lib/api";

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useParams<{ token?: string }>();
  const token = searchParams.get("token") || params.token || "";

  const [checking, setChecking] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendNotice, setResendNotice] = useState("");
  const [resending, setResending] = useState(false);

  const handleRequestNewLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResendNotice("");
    setResending(true);
    try {
      const res = await authService.forgotPassword(resendEmail.trim());
      setResendNotice(
        res.data.message ||
          "If that email is registered, a new reset link has been sent to it.",
      );
    } catch (err) {
      setError(
        getErrorMessage(err, "Could not send a new link. Please try again."),
      );
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setChecking(false);
      setError("This reset link is invalid or has expired.");
      return;
    }
    authService
      .verifyResetToken(token)
      .then((res) => {
        setTokenValid(Boolean(res.data.success));
        setMaskedEmail(res.data.data?.email || "");
      })
      .catch((err) =>
        setError(
          getErrorMessage(err, "This reset link is invalid or has expired."),
        ),
      )
      .finally(() => setChecking(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Could not reset your password. Please request a new link.",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

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

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-screen flex items-center justify-center pt-36 lg:pt-40 pb-16">
        <div className="w-full max-w-md space-y-4">
          <div className="bg-white/95 dark:bg-[#0B192C]/95 backdrop-blur-xl border border-white/40 dark:border-slate-800 rounded-[28px] shadow-2xl p-6 sm:p-8 space-y-5">
            <div className="text-center space-y-2">
              <img
                src="/logo/logo.png"
                alt="Tirvona"
                className="w-14 h-14 object-contain inline-block"
              />
              <h2 className="text-2xl font-black text-[#0B192C] dark:text-white flex items-center justify-center gap-1.5">
                Set New Password{" "}
                <ShieldCheck size={20} className="text-[#0A4DA6]" />
              </h2>
              {maskedEmail && !done && (
                <p className="text-xs text-gray-400 font-semibold">
                  Resetting the password for{" "}
                  <span className="text-[#0A4DA6] font-bold">
                    {maskedEmail}
                  </span>
                </p>
              )}
            </div>

            {checking && (
              <p className="text-center text-xs text-gray-400 font-semibold py-4">
                Checking your reset link…
              </p>
            )}

            {error && (
              <div className="p-3 bg-danger/10 text-danger border border-danger/20 text-xs rounded-xl font-semibold">
                {error}
              </div>
            )}

            {done && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60 text-xs rounded-xl font-semibold flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0" />
                Password updated. Redirecting you to the login page…
              </div>
            )}

            {!checking && tokenValid && !done && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-[#0B192C] dark:text-gray-200">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock
                      className="absolute left-3.5 top-3.5 text-gray-400"
                      size={16}
                    />
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="Minimum 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-[#0B192C] dark:text-gray-200">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock
                      className="absolute left-3.5 top-3.5 text-gray-400"
                      size={16}
                    />
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="Re-enter your new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-[#0A4DA6] hover:bg-[#083b80] text-white rounded-full font-extrabold text-sm shadow-md shadow-[#0A4DA6]/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? (
                    "Updating…"
                  ) : (
                    <>
                      Update Password <ArrowRight size={16} />
                    </>
                  )}
                </button>

                <p className="text-center text-[10px] text-gray-400 font-semibold leading-relaxed">
                  For your security, updating your password signs you out of all
                  devices.
                </p>
              </form>
            )}

            {!checking && !tokenValid && !resendNotice && (
              <>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold leading-relaxed text-center">
                  Reset links expire after 30 minutes, and requesting a new one
                  cancels the previous link. Enter your email below and we'll
                  send a fresh one.
                </p>

                <form onSubmit={handleRequestNewLink} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-[#0B192C] dark:text-gray-200">
                      Registered Email
                    </label>
                    <div className="relative">
                      <Mail
                        className="absolute left-3.5 top-3.5 text-gray-400"
                        size={16}
                      />
                      <input
                        type="email"
                        required
                        placeholder="name@example.com"
                        value={resendEmail}
                        onChange={(e) => setResendEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={resending}
                    className="w-full py-3.5 bg-[#0A4DA6] hover:bg-[#083b80] text-white rounded-full font-extrabold text-sm shadow-md shadow-[#0A4DA6]/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {resending ? (
                      "Sending…"
                    ) : (
                      <>
                        Send Me A New Link <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>
              </>
            )}

            {resendNotice && (
              <div className="p-3 bg-[#0A4DA6]/10 text-[#0A4DA6] border border-[#0A4DA6]/20 text-xs rounded-xl font-semibold">
                {resendNotice}
              </div>
            )}

            <p className="text-center text-xs text-gray-500 dark:text-gray-400 font-semibold">
              Remembered it?{" "}
              <Link
                to="/login"
                className="text-[#0A4DA6] font-black hover:underline"
              >
                Log in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ResetPasswordPage;
