import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Lock, ShieldCheck } from "lucide-react";
import { authService } from "../../services";
import { getErrorMessage, TOKEN_KEY } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { getRoleDefaultDashboard } from "../../utils/roleRedirect";

const inputClass =
  "w-full pl-10 pr-4 py-3.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C28]";

/**
 * Shown after signing in with a temporary password an admin gave out: the person chooses
 * their own password before using anything else (the admin knows the temporary one).
 */
const SetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUser, logout } = useAuth();
  const [temporary, setTemporary] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!temporary) return setError("Enter the temporary password you were given.");
    if (password.length < 8) return setError("Your new password needs at least 8 characters.");
    if (password !== confirm) return setError("The two new passwords do not match.");
    if (password === temporary) return setError("Choose a password different from the temporary one.");
    setSaving(true);
    setError("");
    try {
      const response = await authService.changePassword(temporary, password);
      const session = response.data?.data;
      // Changing the password signs out other sessions; this one continues on the new token.
      if (session?.token) localStorage.setItem(TOKEN_KEY, session.token);
      await refreshUser();
      navigate(getRoleDefaultDashboard(session?.role ?? user?.role ?? "", session?.parkingRoles, session?.email), { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Your password could not be changed."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="relative w-full min-h-screen bg-[#0B192C] overflow-hidden -mt-24 lg:-mt-28">
      <div className="absolute inset-0 bg-gradient-to-r from-[#0B192C]/90 via-[#0B192C]/60 to-[#F28C28]/25" />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-screen flex items-center justify-center pt-36 lg:pt-40 pb-16">
        <div className="w-full max-w-md">
          <div className="bg-white/95 dark:bg-[#0B192C]/95 backdrop-blur-xl border border-white/40 dark:border-slate-800 rounded-[28px] shadow-2xl p-6 sm:p-8 space-y-5">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-black text-[#0B192C] dark:text-white flex items-center justify-center gap-1.5">
                Choose your own password <ShieldCheck size={20} className="text-[#F28C28]" />
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
                {user?.name ? `${user.name}, you` : "You"} signed in with a temporary password from Tirvona. Set a password only you know to continue.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-danger/10 text-danger border border-danger/20 text-xs rounded-xl font-semibold">{error}</div>
            )}

            <form onSubmit={submit} className="space-y-4">
              {[
                { label: "Temporary password", value: temporary, set: setTemporary, auto: "current-password" },
                { label: "New password", value: password, set: setPassword, auto: "new-password" },
                { label: "Confirm new password", value: confirm, set: setConfirm, auto: "new-password" },
              ].map((field) => (
                <div key={field.label} className="space-y-1.5">
                  <label className="text-xs font-extrabold text-[#0B192C] dark:text-gray-200">{field.label}</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                    <input
                      type="password"
                      aria-label={field.label}
                      autoComplete={field.auto}
                      value={field.value}
                      onChange={(e) => field.set(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              ))}
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3.5 bg-[#F28C28] hover:bg-[#B45309] text-white rounded-full font-extrabold text-sm shadow-md shadow-[#F28C28]/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save my password"} <ArrowRight size={16} />
              </button>
            </form>
            <button type="button" onClick={logout} className="w-full text-center text-xs font-bold text-gray-400 hover:text-gray-600">
              Sign out
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SetPasswordPage;
