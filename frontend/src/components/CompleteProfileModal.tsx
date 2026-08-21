import React, { useEffect, useState } from "react";
import { User as UserIcon, Phone, ArrowRight, ShieldCheck } from "lucide-react";

interface Props {
  email: string;
  suggestedName?: string;
  onSubmit: (
    name: string,
    phone: string,
  ) => Promise<{ success: boolean; message?: string }>;
  onDone: () => void;
  onCancel: () => void;
}

export const CompleteProfileModal: React.FC<Props> = ({
  email,
  suggestedName = "",
  onSubmit,
  onDone,
  onCancel,
}) => {
  const [name, setName] = useState(suggestedName);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await onSubmit(name.trim(), phone.trim());
    setLoading(false);
    if (res.success) onDone();
    else setError(res.message || "Could not finish creating your account");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B192C]/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white/95 dark:bg-[#0B192C]/95 backdrop-blur-xl border border-white/40 dark:border-slate-800 rounded-[28px] shadow-2xl p-6 sm:p-8 space-y-5">
        <div className="text-center space-y-2">
          <img
            src="/logo/logo.png"
            alt="Tirvona"
            className="w-14 h-14 object-contain inline-block"
          />
          <h2 className="text-2xl font-black text-[#0B192C] dark:text-white flex items-center justify-center gap-1.5">
            Almost There <ShieldCheck size={20} className="text-[#0A4DA6]" />
          </h2>
          <p className="text-xs text-gray-400 font-semibold">
            Signing up as{" "}
            <span className="text-[#0A4DA6] font-bold">{email}</span>
          </p>
        </div>

        {error && (
          <div className="p-3 bg-danger/10 text-danger border border-danger/20 text-xs rounded-xl font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-[#0B192C] dark:text-gray-200">
              Full Name
            </label>
            <div className="relative">
              <UserIcon
                className="absolute left-3.5 top-3.5 text-gray-400"
                size={16}
              />
              <input
                type="text"
                required
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-3.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-[#0B192C] dark:text-gray-200">
              Mobile Phone Number
            </label>
            <div className="relative">
              <Phone
                className="absolute left-3.5 top-3.5 text-gray-400"
                size={16}
              />
              <input
                type="tel"
                required
                autoFocus
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-4 py-3.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
              />
            </div>
            <p className="text-[10px] text-gray-400 font-semibold">
              Used for booking confirmations and check-in at the ashram.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#0A4DA6] hover:bg-[#083b80] text-white rounded-full font-extrabold text-sm shadow-md shadow-[#0A4DA6]/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              "Creating account…"
            ) : (
              <>
                Finish &amp; Continue <ArrowRight size={16} />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="w-full text-xs text-gray-500 dark:text-gray-400 font-bold hover:underline cursor-pointer disabled:opacity-50"
          >
            Cancel sign-up
          </button>
        </form>
      </div>
    </div>
  );
};

export default CompleteProfileModal;
