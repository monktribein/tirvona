import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { getErrorMessage } from "../lib/api";
import { isGoogleConfigured, signInWithGoogle } from "../lib/googleAuth";
import { authService } from "../services";

interface Blocker {
  code: string;
  message: string;
  count: number;
}

interface Eligibility {
  eligible: boolean;
  supportOnly: boolean;
  reauth: "password" | "google";
  blockers: Blocker[];
}

const CONFIRM_WORD = "DELETE";
const SUPPORT_EMAIL = "support@tirvona.in";
const PRIVACY_EMAIL = "privacy@tirvona.in";

const Card: React.FC<{
  tone?: "default" | "danger" | "info";
  children: React.ReactNode;
}> = ({ tone = "default", children }) => {
  const tones = {
    default:
      "bg-white dark:bg-[#0B192C] border-gray-100 dark:border-slate-800",
    danger:
      "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50",
    info: "bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900/50",
  };
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${tones[tone]}`}>
      {children}
    </div>
  );
};

const Bullets: React.FC<{ items: string[]; icon: React.ReactNode }> = ({
  items,
  icon,
}) => (
  <ul className="space-y-2.5">
    {items.map((item) => (
      <li key={item} className="flex gap-3 text-sm leading-relaxed">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

const WhatHappens: React.FC = () => (
  <div className="grid gap-4 sm:grid-cols-2">
    <Card>
      <h2 className="mb-3 text-sm font-extrabold text-[#0B192C] dark:text-white">
        What is deleted
      </h2>
      <div className="text-gray-600 dark:text-gray-300">
        <Bullets
          icon={<Trash2 className="h-4 w-4 text-red-500" aria-hidden />}
          items={[
            "Your name, email address, phone number and profile details",
            "Saved preferences and notification devices",
            "Your login. You can sign up again later with the same email or phone",
          ]}
        />
      </div>
    </Card>
    <Card>
      <h2 className="mb-3 text-sm font-extrabold text-[#0B192C] dark:text-white">
        What we have to keep
      </h2>
      <div className="text-gray-600 dark:text-gray-300">
        <Bullets
          icon={<Info className="h-4 w-4 text-sky-600" aria-hidden />}
          items={[
            "Past booking, payment and refund records, kept for up to 7 years because tax and accounting law requires it. They are no longer linked to your name, email or phone",
          ]}
        />
      </div>
    </Card>
  </div>
);

const inputClass =
  "w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/40 focus:border-[#0A4DA6]";

export const DeleteAccountPage: React.FC = () => {
  const { user, loading: authLoading, logout } = useAuth();

  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const previous = document.title;
    document.title = "Delete your Tirvona account | Tirvona";
    return () => {
      document.title = previous;
    };
  }, []);

  const loadEligibility = useCallback(async () => {
    setChecking(true);
    setCheckError("");
    try {
      const res = await authService.deletionCheck();
      setEligibility(res.data.data as Eligibility);
    } catch (err) {
      setCheckError(getErrorMessage(err));
    } finally {
      setChecking(false);
    }
  }, []);

  const userId = user?.id;
  useEffect(() => {
    if (userId && !done) void loadEligibility();
    if (!userId) setEligibility(null);
  }, [userId, done, loadEligibility]);

  const usesGoogle = eligibility?.reauth === "google";
  const canSubmit =
    !submitting &&
    confirmText.trim() === CONFIRM_WORD &&
    (usesGoogle || password.length > 0);

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !eligibility) return;
    if (
      !window.confirm(
        "Delete your Tirvona account now? This erases your account and cannot be undone.",
      )
    )
      return;

    setSubmitting(true);
    setError("");
    try {
      let googleCredential: string | undefined;
      if (usesGoogle) googleCredential = await signInWithGoogle();
      await authService.deleteMyAccount({
        password: usesGoogle ? undefined : password,
        googleCredential,
        reason: reason.trim() || undefined,
      });
      // The server has already invalidated the session; clear it locally.
      logout();
      setDone(true);
    } catch (err) {
      if (
        axios.isAxiosError(err) &&
        err.response?.data?.code === "ACCOUNT_DELETION_BLOCKED"
      ) {
        await loadEligibility();
      } else {
        setError(getErrorMessage(err, "We could not delete your account."));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderBody = () => {
    if (done) {
      return (
        <Card tone="info">
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" aria-hidden />
            <h2 className="text-lg font-extrabold text-[#0B192C] dark:text-white">
              Your account has been deleted
            </h2>
            <p className="max-w-md text-sm text-gray-600 dark:text-gray-300">
              Your personal details were erased and you have been signed out
              everywhere. Thank you for staying with Tirvona.
            </p>
            <Link
              to="/"
              className="mt-2 rounded-xl bg-[#0A4DA6] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#00377D]"
            >
              Back to home
            </Link>
          </div>
        </Card>
      );
    }

    if (authLoading || (user && checking && !eligibility)) {
      return (
        <div
          className="flex justify-center py-16"
          role="status"
          aria-label="Loading"
        >
          <Loader2 className="h-8 w-8 animate-spin text-[#0A4DA6]" />
        </div>
      );
    }

    if (!user) {
      return (
        <div className="space-y-6">
          <Card>
            <h2 className="text-base font-extrabold text-[#0B192C] dark:text-white">
              Sign in to delete your account
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              For your security we only delete an account after you sign in and
              confirm it is you. This works for accounts created in the Tirvona
              app and on this website.
            </p>
            <Link
              to={`/login?redirect=${encodeURIComponent("/privacy/delete-account")}`}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#0A4DA6] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#00377D]"
            >
              <Lock className="h-4 w-4" aria-hidden /> Sign in to continue
            </Link>
          </Card>
          <Card>
            <h2 className="text-base font-extrabold text-[#0B192C] dark:text-white">
              Cannot sign in?
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Email us from the address on your account and ask us to delete it.
              We reply within 48 hours and will confirm before deleting.
            </p>
            <a
              href={`mailto:${PRIVACY_EMAIL}?subject=${encodeURIComponent("Delete my Tirvona account")}`}
              className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#0A4DA6] hover:underline"
            >
              <Mail className="h-4 w-4" aria-hidden /> {PRIVACY_EMAIL}
            </a>
          </Card>
          <WhatHappens />
        </div>
      );
    }

    if (checkError && !eligibility) {
      return (
        <Card tone="danger">
          <p className="text-sm text-red-700 dark:text-red-300" role="alert">
            {checkError}
          </p>
          <button
            type="button"
            onClick={() => void loadEligibility()}
            className="mt-3 rounded-xl border border-red-300 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100"
          >
            Try again
          </button>
        </Card>
      );
    }

    if (!eligibility) return null;

    if (eligibility.supportOnly) {
      return (
        <Card tone="info">
          <h2 className="text-base font-extrabold text-[#0B192C] dark:text-white">
            Contact support to close this account
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            This type of account is linked to business records (listings,
            payouts, staff), so the Tirvona team closes it for you. Email{" "}
            <a className="font-bold text-[#0A4DA6]" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>{" "}
            or call +91 78360 55511.
          </p>
        </Card>
      );
    }

    if (eligibility.blockers.length > 0) {
      return (
        <div className="space-y-6">
          <Card tone="danger">
            <div className="flex gap-3">
              <AlertTriangle
                className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
                aria-hidden
              />
              <div>
                <h2 className="text-base font-extrabold text-[#0B192C] dark:text-white">
                  Finish these first
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  We cannot delete your account while any of these are still
                  open.
                </p>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-gray-700 dark:text-gray-200">
                  {eligibility.blockers.map((b) => (
                    <li key={b.code}>{b.message}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => void loadEligibility()}
                  disabled={checking}
                  className="mt-4 rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-[#0B192C] hover:bg-white disabled:opacity-60 dark:text-white"
                >
                  {checking ? "Checking…" : "Check again"}
                </button>
              </div>
            </div>
          </Card>
          <WhatHappens />
        </div>
      );
    }

    return (
      <form onSubmit={handleDelete} className="space-y-6" noValidate>
        <Card tone="danger">
          <div className="flex gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-red-600"
              aria-hidden
            />
            <p className="text-sm text-gray-700 dark:text-gray-200">
              Signed in as <strong>{user.email}</strong>. Deleting your account
              is permanent: it signs you out everywhere and cannot be undone.
            </p>
          </div>
        </Card>

        <WhatHappens />

        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-extrabold text-[#0B192C] dark:text-white">
            <ShieldCheck className="h-4 w-4 text-[#0A4DA6]" aria-hidden />
            {usesGoogle ? "Confirm with Google" : "Confirm it is you"}
          </h2>

          {usesGoogle ? (
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
              {isGoogleConfigured()
                ? "When you press delete, Google will ask you to choose the account you signed up with."
                : "Google confirmation is not available right now. Please email privacy@tirvona.in to delete your account."}
            </p>
          ) : (
            <div className="mb-4">
              <label
                htmlFor="delete-password"
                className="mb-1.5 block text-xs font-bold text-gray-600 dark:text-gray-300"
              >
                Your password
              </label>
              <div className="relative">
                <input
                  id="delete-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  className={`${inputClass} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="mb-4">
            <label
              htmlFor="delete-confirm"
              className="mb-1.5 block text-xs font-bold text-gray-600 dark:text-gray-300"
            >
              Type {CONFIRM_WORD} to confirm
            </label>
            <input
              id="delete-confirm"
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="delete-reason"
              className="mb-1.5 block text-xs font-bold text-gray-600 dark:text-gray-300"
            >
              Why are you leaving? (optional)
            </label>
            <textarea
              id="delete-reason"
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={inputClass}
            />
          </div>
        </Card>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
          >
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={!canSubmit || (usesGoogle && !isGoogleConfigured())}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="h-4 w-4" aria-hidden />
            )}
            {submitting ? "Deleting…" : "Delete my account"}
          </button>
          <Link
            to="/profile"
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-300 px-5 py-3 text-sm font-bold text-[#0B192C] hover:bg-gray-50 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"
          >
            Keep my account
          </Link>
        </div>
      </form>
    );
  };

  return (
    <div className="pb-20">
      <section className="bg-[#0B192C] px-4 py-14 text-white sm:px-6">
        <div className="mx-auto max-w-3xl space-y-3 text-center">
          <span className="inline-block rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-4 py-1.5 text-[10px] font-extrabold tracking-widest text-[#D4AF37]">
            Account
          </span>
          <h1
            className="font-extrabold text-white"
            style={{ fontSize: "clamp(1.8rem, 6vw, 2.8rem)" }}
          >
            Delete your Tirvona account
          </h1>
          <p className="text-sm text-gray-400">
            For the Tirvona app and the Tirvona website
          </p>
        </div>
      </section>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">{renderBody()}</div>
    </div>
  );
};

export default DeleteAccountPage;
