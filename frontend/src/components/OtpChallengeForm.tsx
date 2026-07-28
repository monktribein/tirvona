import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck, ArrowRight, RotateCcw, Loader2 } from 'lucide-react';
import type { OtpChallenge } from '../contexts/AuthContext';

/**
 * Only the display fields are required, so this component serves both the
 * regular OTP challenge and the pre-account Google one (which carries a
 * `googleToken` instead of an `otpToken`).
 */
type ChallengeView = Pick<OtpChallenge, 'channel'> & Partial<Pick<OtpChallenge, 'sentTo'>>;

interface Props {
  challenge: ChallengeView;
  /**
   * Fallback destination to display. The server's already-masked
   * `challenge.sentTo` is preferred when present, since the channel may differ
   * from what the user typed (e.g. SMS switched off → code emailed instead).
   */
  destination: string;
  title?: string;
  onVerify: (otp: string) => Promise<{ success: boolean; message?: string }>;
  onResend: () => Promise<{ success: boolean; message?: string }>;
  onCancel: () => void;
  onVerified: () => void;
}

// Masks the destination so a shoulder-surfer cannot read the full address.
const maskDestination = (value: string) => {
  if (value.includes('@')) {
    const [local, domain] = value.split('@');
    const head = local.length <= 2 ? local : `${local[0]}***${local.slice(-1)}`;
    return `${head}@${domain}`;
  }
  const digits = value.replace(/\D/g, '');
  return digits.length >= 6 ? `${digits.slice(0, 2)}****${digits.slice(-4)}` : value;
};

/**
 * OTP entry step. Styled with the exact input/button classes already used by the
 * login and register cards so it drops into either without changing the page
 * layout, palette or spacing.
 */
const OTP_LENGTH = 6;

type Status = 'idle' | 'verifying' | 'success' | 'error';

export const OtpChallengeForm: React.FC<Props> = ({
  challenge,
  destination,
  title = 'Verify OTP',
  onVerify,
  onResend,
  onCancel,
  onVerified,
}) => {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [cooldown, setCooldown] = useState(30);
  const inputRef = useRef<HTMLInputElement>(null);
  // Guards against the auto-submit effect firing twice for the same code.
  const submittedRef = useRef('');

  const busy = status === 'verifying' || status === 'success';

  // Resend cooldown mirrors the server-side 30s window.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Focus the field as soon as the step appears, so the code can be typed or
  // pasted (or filled from an SMS/email autofill) without a click.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const runVerify = useCallback(
    async (code: string) => {
      setError('');
      setStatus('verifying');
      const res = await onVerify(code);

      if (res.success) {
        // Hold on the success state briefly so the tick is actually seen
        // before the page navigates away.
        setStatus('success');
        setTimeout(onVerified, 900);
        return;
      }

      setStatus('error');
      setError(res.message || 'Invalid OTP');
      // Clear and refocus so the next attempt needs no extra interaction.
      setTimeout(() => {
        setOtp('');
        submittedRef.current = '';
        setStatus('idle');
        inputRef.current?.focus();
      }, 550);
    },
    [onVerify, onVerified]
  );

  // Auto-submit once the final digit lands — no button press needed.
  //
  // A short grace window first: verification spends one of only 5 attempts, so
  // a mistyped last digit must not be submitted before the user can backspace.
  // Any edit inside the window cancels the pending submit.
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
    setError('');
    setNotice('');
    setStatus('verifying');
    const res = await onResend();
    setStatus('idle');
    if (res.success) {
      setCooldown(30);
      setNotice(res.message || 'A new OTP has been sent.');
      setOtp('');
      submittedRef.current = '';
      inputRef.current?.focus();
    } else {
      setError(res.message || 'Could not resend OTP');
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <img src="/logo/logo.png" alt="Tirvona" className="w-14 h-14 object-contain inline-block" />
        <h2 className="text-2xl font-black text-[#0B192C] dark:text-white flex items-center justify-center gap-1.5">
          {title} <ShieldCheck size={20} className="text-[#0A4DA6]" />
        </h2>
        <p className="text-xs text-gray-400 font-semibold">
          Enter the 6-digit code sent to your {challenge.channel === 'email' ? 'email' : 'mobile'}{' '}
          <span className="text-[#0A4DA6] font-bold">{challenge.sentTo || maskDestination(destination)}</span>
        </p>
      </div>

      {error && (
        <div className="p-3 bg-danger/10 text-danger border border-danger/20 text-xs rounded-xl font-semibold">{error}</div>
      )}
      {notice && !error && (
        <div className="p-3 bg-[#0A4DA6]/10 text-[#0A4DA6] border border-[#0A4DA6]/20 text-xs rounded-xl font-semibold">
          {notice}
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-extrabold text-[#0B192C] dark:text-gray-200">One-Time Password</label>
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
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
            className={`w-full px-4 py-3.5 bg-white dark:bg-slate-900 border rounded-xl text-center text-lg font-black tracking-[0.5em] focus:outline-none focus:ring-2 transition-colors disabled:opacity-100 ${
              status === 'error'
                ? 'border-danger focus:ring-danger otp-shake'
                : status === 'success'
                ? 'border-emerald-500 focus:ring-emerald-500 text-emerald-600'
                : 'border-gray-200 dark:border-slate-800 focus:ring-[#0A4DA6]'
            }`}
          />

          {/* Indeterminate bar: the code auto-submits, so this is the only cue
              that something is happening between the 6th digit and the result. */}
          <div className="h-[3px] rounded-full overflow-hidden relative bg-transparent">
            {status === 'verifying' && <div className="otp-progress absolute inset-0" />}
          </div>
        </div>

        {/* The button stays for accessibility and as a manual fallback, but the
            code normally verifies itself the moment the last digit is entered. */}
        <button
          type="submit"
          disabled={busy || otp.length !== OTP_LENGTH}
          className={`w-full py-3.5 rounded-full font-extrabold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 ${
            status === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-600/20'
              : 'bg-[#0A4DA6] hover:bg-[#083b80] text-white shadow-[#0A4DA6]/20'
          }`}
        >
          {status === 'verifying' && (
            <>
              <Loader2 size={16} className="animate-spin" /> Verifying…
            </>
          )}
          {status === 'success' && (
            <>
              <span className="otp-success-pop inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/20">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
          {(status === 'idle' || status === 'error') && (
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
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default OtpChallengeForm;
