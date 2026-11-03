import React, { useState } from "react";
import { Copy, KeyRound, Mail } from "lucide-react";
import { getErrorMessage } from "../../../lib/api";

interface PasswordHelpPanelProps {
  accountName: string;
  accountEmail?: string | null;
  /** Resets the password (to `custom` when given) and resolves with the password to tell the person. */
  onReset: (custom?: string) => Promise<string>;
  /** Emails a reset link and resolves with the address it went to. Leave out where that is not possible. */
  onSendLink?: () => Promise<string>;
  /** Why there is no reset link here, when `onSendLink` is left out. */
  linkUnavailableReason?: string;
  /** Whether the person is made to choose their own password at the next sign-in. */
  forcesNewPassword?: boolean;
}

/**
 * Helps someone who forgot their password. The current password is never shown: it is
 * stored one-way (bcrypt) and cannot be read by anyone. Instead the admin either resets it
 * and reads the new temporary password out to the person, or emails them a reset link.
 */
export const PasswordHelpPanel: React.FC<PasswordHelpPanelProps> = ({
  accountName,
  accountEmail,
  onReset,
  onSendLink,
  linkUnavailableReason,
  forcesNewPassword = true,
}) => {
  const [custom, setCustom] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<"reset" | "link" | null>(null);
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [linkSentTo, setLinkSentTo] = useState("");
  const [error, setError] = useState("");

  const reset = async () => {
    const chosen = custom.trim();
    if (chosen && chosen.length < 8) return setError("A password needs at least 8 characters.");
    setBusy("reset");
    setError("");
    try {
      setPassword(await onReset(chosen || undefined));
      setConfirming(false);
      setCustom("");
    } catch (err) {
      setError(getErrorMessage(err, "The password could not be reset."));
    } finally {
      setBusy(null);
    }
  };

  const sendLink = async () => {
    if (!onSendLink) return;
    setBusy("link");
    setError("");
    try {
      setLinkSentTo(await onSendLink());
    } catch (err) {
      setError(getErrorMessage(err, "The reset link could not be sent."));
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the password stays on screen to read out.
    }
  };

  return (
    <div className="space-y-3 text-xs">
      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        The current password of {accountName} cannot be shown: Tirvona stores passwords encrypted one-way, so nobody can read them. Use one of these instead.
      </p>

      <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-4 dark:border-purple-900/60 dark:bg-purple-950/20 space-y-3">
        <div className="flex items-center gap-2 font-black text-purple-700 dark:text-purple-300">
          <KeyRound size={15} /> Reset and show a temporary password
        </div>
        {password ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-purple-200 bg-white px-4 py-3 dark:border-purple-900 dark:bg-slate-950">
              <span data-temporary-password className="font-mono text-base font-black tracking-wider text-gray-900 dark:text-white select-all">
                {password}
              </span>
              <button
                type="button"
                onClick={() => void copy()}
                className="inline-flex items-center gap-1 rounded-full bg-purple-600 px-3 py-1.5 text-[10px] font-black text-white"
              >
                <Copy size={12} /> {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-[11px] text-gray-600 dark:text-gray-300">
              Tell {accountName} this password. It is shown only now.
              {forcesNewPassword && " They will be asked to choose their own password when they sign in."}
            </p>
          </div>
        ) : (
          <>
            <input
              type="text"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Leave empty for a strong generated password, or type one (8+ characters)"
              autoComplete="off"
              className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2.5 font-mono text-xs outline-none focus:border-purple-500 dark:border-purple-900 dark:bg-slate-950"
            />
            {confirming ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="mr-auto text-[11px] font-bold text-rose-600">
                  {accountName}'s old password stops working and they are signed out everywhere.
                </span>
                <button type="button" onClick={() => setConfirming(false)} className="rounded-full bg-white px-4 py-2 text-[10px] font-bold text-gray-600 dark:bg-slate-900 dark:text-gray-300">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void reset()}
                  className="rounded-full bg-purple-600 px-4 py-2 text-[10px] font-black text-white disabled:opacity-50"
                >
                  {busy === "reset" ? "Resetting..." : "Confirm reset"}
                </button>
              </div>
            ) : (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setConfirming(true);
                  }}
                  className="rounded-full bg-purple-600 px-4 py-2 text-[10px] font-black text-white"
                >
                  Reset & show password
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 space-y-2">
        <div className="flex items-center gap-2 font-black text-gray-700 dark:text-gray-200">
          <Mail size={15} /> Email a reset link
        </div>
        {onSendLink ? (
          linkSentTo ? (
            <p className="text-[11px] font-bold text-emerald-700">
              A reset link was sent to {linkSentTo}. It works for 30 minutes.
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                {accountEmail ? `${accountName} gets a link at ${accountEmail} to choose a new password themselves.` : `${accountName} gets a link by email to choose a new password themselves.`}
              </span>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void sendLink()}
                className="rounded-full border border-gray-300 px-4 py-2 text-[10px] font-black text-gray-700 disabled:opacity-50 dark:border-slate-700 dark:text-gray-200"
              >
                {busy === "link" ? "Sending..." : "Send reset link"}
              </button>
            </div>
          )
        ) : (
          <p className="text-[11px] text-gray-500 dark:text-gray-400">{linkUnavailableReason ?? "A reset link is not available for this account."}</p>
        )}
      </div>

      {error && <p className="text-[11px] font-bold text-rose-600">{error}</p>}
    </div>
  );
};

export default PasswordHelpPanel;
