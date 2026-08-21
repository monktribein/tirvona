import React, { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck, ArrowRight, RotateCcw, Loader2 } from "lucide-react";
import type { OtpChallenge } from "../contexts/AuthContext";

type ChallengeView = Pick<OtpChallenge, "channel"> &
  Partial<Pick<OtpChallenge, "sentTo">>;

interface Props {
  challenge: ChallengeView;
  destination: string;
  title?: string;
  onVerify: (otp: string) => Promise<{ success: boolean; message?: string }>;
  onResend: () => Promise<{ success: boolean; message?: string }>;
  onCancel: () => void;
  onVerified: () => void;
}

const maskDestination = (value: string) => {
  if (value.includes("@")) {
    const [local, domain] = value.split("@");
    const head = local.length <= 2 ? local : `${local[0]}***${local.slice(-1)}`;
    return `${head}@${domain}`;
  }
  const digits = value.replace(/\D/g, "");
  return digits.length >= 6
    ? `${digits.slice(0, 2)}****${digits.slice(-4)}`
    : value;
};

const OTP_LENGTH = 6;

type Status = "idle" | "verifying" | "success" | "error";

export const OtpChallengeForm: React.FC<Props> = ({
  challenge,
  destination,
  title = "Verify OTP",
  onVerify,
  onResend,
  onCancel,
  onVerified,
}) => {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [cooldown, setCooldown] = useState(30);
  const inputRef = useRef<HTMLInputElement>(null);
  const submittedRef = useRef("");

  const busy = status === "verifying" || status === "success";

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const runVerify = useCallback(
    async (code: string) => {
      setError("");
      setStatus("verifying");
      const res = await onVerify(code);

      if (res.success) {
        setStatus("success");
        setTimeout(onVerified, 900);
        return;
      }

      setStatus("error");
      setError(res.message || "Invalid OTP");
      setTimeout(() => {
        setOtp("");
        submittedRef.current = "";
        setStatus("idle");
        inputRef.current?.focus();
      }, 550);
    },
    [onVerify, onVerified],
  );

  useEffect(() => {
    if (otp.length !== OTP_LENGTH || busy) return;
    if (submittedRef.current === otp) return;

    const timer = setTimeout(() => {
      submittedRef.current = otp;
      runVerify(otp);
    }, 350);
    return () => clearTimeout(timer);
  }, [otp, busy, runVerify]);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length === OTP_LENGTH && !busy) runVerify(otp);
  };

  const handleResend = async () => {
    setError("");
    setNotice("");
    setStatus("verifying");
    const res = await onResend();
    setStatus("idle");
    if (res.success) {
      setCooldown(30);
      setNotice(res.message || "A new OTP has been sent.");
      setOtp("");
      submittedRef.current = "";
      inputRef.current?.focus();
    } else {
      setError(res.message || "Could not resend OTP");
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <img
          src="/logo/logo.png"
          alt="Tirvona"
          className="w-14 h-14 object-contain inline-block"
        />
        <h2 className="text-2xl font-black text-[#0B192C] dark:text-white flex items-center justify-center gap-1.5">
          {title} <ShieldCheck size={20} className="text-[#0A4DA6]" />
        </h2>
        <p className="text-xs text-gray-400 font-semibold">
          Enter the 6-digit code sent to your{" "}
          {challenge.channel === "email" ? "email" : "mobile"}{" "}
          <span className="text-[#0A4DA6] font-bold">
            {challenge.sentTo || maskDestination(destination)}
          </span>
        </p>
      </div>

      {error && (
        <div className="p-3 bg-danger/10 text-danger border border-danger/20 text-xs rounded-xl font-semibold">
          {error}
        </div>
      )}
      {notice && !error && (
        <div className="p-3 bg-[#0A4DA6]/10 text-[#0A4DA6] border border-[#0A4DA6]/20 text-xs rounded-xl font-semibold">
          {notice}
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-extrabold text-[#0B192C] dark:text-gray-200">
            One-Time Password
          </label>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={OTP_LENGTH}
            placeholder="● ● ● ● ● ●"
            value={otp}
            disabled={busy}
            onChange={(e) =>
              setOtp(e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))
            }
            className={`w-full px-4 py-3.5 bg-white dark:bg-slate-900 border rounded-xl text-center text-lg font-black tracking-[0.5em] focus:outline-none focus:ring-2 transition-colors disabled:opacity-100 ${
              status === "error"
                ? "border-danger focus:ring-danger otp-shake"
                : status === "success"
                  ? "border-emerald-500 focus:ring-emerald-500 text-emerald-600"
                  : "border-gray-200 dark:border-slate-800 focus:ring-[#0A4DA6]"
            }`}
          />

          <div className="h-[3px] rounded-full overflow-hidden relative bg-transparent">
            {status === "verifying" && (
              <div className="otp-progress absolute inset-0" />
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={busy || otp.length !== OTP_LENGTH}
          className={`w-full py-3.5 rounded-full font-extrabold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 ${
            status === "success"
              ? "bg-emerald-600 text-white shadow-emerald-600/20"
              : "bg-[#0A4DA6] hover:bg-[#083b80] text-white shadow-[#0A4DA6]/20"
          }`}
        >
          {status === "verifying" && (
            <>
              <Loader2 size={16} className="animate-spin" /> Verifying…
            </>
          )}
          {status === "success" && (
            <>
              <span className="otp-success-pop inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/20">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    className="otp-check-draw"
                    d="M4 12.5l5 5L20 6.5"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              Verified
            </>
          )}
          {(status === "idle" || status === "error") && (
            <>
              Verify &amp; Continue <ArrowRight size={16} />
            </>
          )}
        </button>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="text-xs text-gray-500 dark:text-gray-400 font-bold hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
          >
            ← Go back
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || busy}
            className="text-xs text-[#0A4DA6] font-black hover:underline cursor-pointer disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed flex items-center gap-1"
          >
            <RotateCcw size={12} />
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default OtpChallengeForm;
