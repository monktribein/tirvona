import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { reviewService } from "../../services";
import { useAuth } from "../../contexts/AuthContext";
import { useNotifications } from "../../contexts/NotificationContext";
import { getErrorMessage } from "../../lib/api";
import { setGuestPendingIntent } from "../../utils/guestGate";
import { BadgeCheck, CheckCircle2, Loader2, Star } from "lucide-react";

interface Eligibility {
  canReview: boolean;
  alreadyReviewed: boolean;
  verifiedStay: boolean;
  bookingId: string | null;
}

const SUB_SCORES = [
  { key: "cleanliness", label: "Cleanliness" },
  { key: "service", label: "Service" },
  { key: "location", label: "Location" },
  { key: "valueForMoney", label: "Value" },
] as const;

const StarRow: React.FC<{
  value: number;
  onChange: (value: number) => void;
  label: string;
  size?: number;
}> = ({ value, onChange, label, size = 22 }) => (
  <div
    className="flex items-center gap-1"
    role="radiogroup"
    aria-label={`${label} rating`}
  >
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type="button"
        role="radio"
        aria-checked={value === star}
        aria-label={`${star} star${star === 1 ? "" : "s"}`}
        onClick={() => onChange(star)}
        className="cursor-pointer transition-transform hover:scale-110"
      >
        <Star
          size={size}
          className={
            star <= value
              ? "fill-[#E58C28] text-[#E58C28]"
              : "text-gray-300 dark:text-slate-600"
          }
        />
      </button>
    ))}
  </div>
);

export const WriteReviewCard: React.FC<{
  ashramId: string;
  ashramName?: string;
  onSubmitted?: () => void;
}> = ({ ashramId, ashramName, onSubmitted }) => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();

  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [checking, setChecking] = useState(true);
  const [overall, setOverall] = useState(0);
  const [subScores, setSubScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const check = useCallback(async () => {
    if (!user) {
      setChecking(false);
      return;
    }
    try {
      const res = await reviewService.eligibility(ashramId);
      setEligibility(res.data?.data ?? null);
    } catch {
      setEligibility(null);
    } finally {
      setChecking(false);
    }
  }, [ashramId, user]);

  useEffect(() => {
    check();
  }, [check]);

  const submit = async () => {
    if (overall < 1 || comment.trim().length < 2) return;
    setSubmitting(true);
    try {
      await reviewService.create({
        ashramId,
        rating: { overall, ...subScores },
        comment: comment.trim(),
        ...(eligibility?.bookingId ? { bookingId: eligibility.bookingId } : {}),
      });
      setDone(true);
      addNotification(
        "Review posted",
        `Thank you for sharing your experience of ${ashramName ?? "this ashram"}.`,
        "success",
      );
      onSubmitted?.();
    } catch (err) {
      addNotification(
        "Review not posted",
        getErrorMessage(err, "Please try again."),
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (checking && user) return null;

  if (!user)
    return (
      <div className="bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 rounded-2xl p-5 text-center space-y-2">
        <p className="text-sm font-bold text-[#0B192C] dark:text-white">
          Share your experience
        </p>
        <p className="text-xs text-gray-500">
          Sign in to write a review. You can review whether or not you have
          stayed here.
        </p>
        <button
          onClick={() => {
            setGuestPendingIntent({
              type: "review_submit",
              returnUrl: `${window.location.pathname}${window.location.search}`,
            });
            navigate(
              `/login?redirect=${encodeURIComponent(window.location.pathname)}`,
            );
          }}
          className="px-5 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white text-xs font-extrabold cursor-pointer"
        >
          Sign in to review
        </button>
      </div>
    );

  if (done || eligibility?.alreadyReviewed)
    return (
      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-5 flex items-start gap-3">
        <CheckCircle2 size={18} className="text-emerald-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
            Your review is posted
          </p>
          <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
            Thank you for helping other pilgrims choose their stay.
          </p>
        </div>
      </div>
    );

  const canSubmit = overall >= 1 && comment.trim().length >= 2 && !submitting;

  return (
    <div className="bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-black text-[#0B192C] dark:text-white">
            Write a review
          </h3>
          <p className="text-xs text-gray-500">
            {ashramName ? `How was ${ashramName}?` : "How was your visit?"}
          </p>
        </div>
        {eligibility?.verifiedStay && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-[10px] font-black">
            <BadgeCheck size={12} /> Verified stay
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <span className="text-[11px] font-black text-gray-500 block">
          Overall rating <span className="text-rose-500">*</span>
        </span>
        <StarRow value={overall} onChange={setOverall} label="Overall" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {SUB_SCORES.map((score) => (
          <div key={score.key} className="space-y-1">
            <span className="text-[10px] font-bold text-gray-500 block">
              {score.label}{" "}
              <span className="text-gray-300 font-normal">(optional)</span>
            </span>
            <StarRow
              size={15}
              label={score.label}
              value={subScores[score.key] ?? 0}
              onChange={(value) =>
                setSubScores((prev) => ({ ...prev, [score.key]: value }))
              }
            />
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-black text-gray-500 block">
          Your experience <span className="text-rose-500">*</span>
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 1500))}
          rows={4}
          placeholder="What stood out — the rooms, the food, the aarti, the staff?"
          className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6] resize-none"
        />
        <span className="text-[10px] text-gray-400 block text-right">
          {comment.length}/1500
        </span>
      </div>

      <button
        onClick={submit}
        disabled={!canSubmit}
        className="w-full py-3 rounded-full bg-[#0A4DA6] hover:bg-blue-900 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all"
      >
        {submitting && <Loader2 size={14} className="animate-spin" />}
        Post review
      </button>
    </div>
  );
};

export default WriteReviewCard;
