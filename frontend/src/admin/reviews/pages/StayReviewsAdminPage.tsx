import React, { useEffect, useState } from "react";
import { BadgeCheck, Check, Pencil, Search, Star, X } from "lucide-react";
import { EnterprisePageHeader } from "../../shared/components/EnterprisePageHeader";
import { EnterpriseButton } from "../../shared/components/EnterpriseButton";
import { reviewService } from "../../../services";
import { useAuth } from "../../../contexts/AuthContext";
import { useNotifications } from "../../../contexts/NotificationContext";
import {
  Chips,
  Empty,
  inputClass,
  Panel,
  PanelState,
  Pager,
  Pill,
  shortDate,
  useAction,
  useRemote,
} from "../../../modules/marketplace/ui";

interface StayReview {
  _id: string;
  displayName?: string;
  comment: string;
  status: "approved" | "hidden" | "pending";
  verifiedStay?: boolean;
  rating?: { overall?: number };
  createdAt: string;
  customerId?: { _id: string; name?: string; email?: string; phone?: string; role?: string };
  ashramId?: { _id: string; name?: string; address?: { city?: string; state?: string } };
}

const FILTERS = [
  { value: "", label: "All" },
  { value: "approved", label: "Published" },
  { value: "hidden", label: "Hidden" },
];

const Stars: React.FC<{ value: number }> = ({ value }) => (
  <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star
        key={n}
        size={12}
        className={n <= value ? "fill-[#E58C28] text-[#E58C28]" : "text-gray-300 dark:text-slate-600"}
      />
    ))}
  </span>
);

/**
 * Super-admin moderation of ashram (stay) reviews: the reviews on ashram
 * pages and the home page's Sacred Experiences. Hiding a review removes it
 * from public view and from the ashram's rating. The public reviewer name can
 * be set only on reviews this super admin posted on a guest's behalf.
 */
export const StayReviewsAdminPage: React.FC = () => {
  const { user } = useAuth();
  const { confirmAction } = useNotifications();
  const [status, setStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");

  // Search after typing pauses, not on every keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const { data, meta, state, error, reload } = useRemote<StayReview[]>(
    () => reviewService.adminList({ status, search, page, limit: 20 }),
    [status, search, page],
  );
  const { busy, run } = useAction();

  // The shown name can only be set on reviews this super admin posted.
  const isMine = (r: StayReview) =>
    Boolean(user?.id) && String(r.customerId?._id) === String(user?.id);

  const saveName = (r: StayReview) =>
    run(
      `name-${r._id}`,
      () => reviewService.setDisplayName(r._id, nameDraft.trim()),
      () => {
        setEditingId(null);
        return reload();
      },
    );

  const remove = async (r: StayReview) => {
    const ok = await confirmAction({
      title: "Delete this review?",
      message: `The review of ${r.ashramId?.name ?? "this ashram"} is removed permanently and the ashram's rating is recalculated. Hide it instead if you may want it back.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (ok) await run(`del-${r._id}`, () => reviewService.remove(r._id), reload);
  };

  return (
    <div className="space-y-5">
      <EnterprisePageHeader
        title="Stay reviews"
        subtitle="Reviews shown on ashram pages and in Sacred Experiences. Hidden reviews stop counting towards the rating."
        icon={<Star size={20} />}
      />
      <Panel>
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <Chips
              value={status}
              options={FILTERS}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            />
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search review text, name or ashram…"
                className={`${inputClass} pl-8`}
              />
            </div>
          </div>

          {state !== "ready" ? (
            <PanelState state={state} error={error} onRetry={reload} />
          ) : !data?.length ? (
            <Empty title="No reviews" text={search ? "Nothing matches that search." : undefined} />
          ) : (
            <>
              <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                {data.map((r) => {
                  const shownName = r.displayName || r.customerId?.name || "Guest";
                  const location = [r.ashramId?.address?.city, r.ashramId?.address?.state]
                    .filter(Boolean)
                    .join(", ");
                  return (
                    <li key={r._id} className="py-4 flex flex-col lg:flex-row gap-3">
                      <div className="flex-1 min-w-0 space-y-1.5 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <Stars value={Math.round(r.rating?.overall ?? 0)} />
                          <span className="font-extrabold text-[#0B192C] dark:text-white">
                            {r.ashramId?.name ?? "Ashram"}
                          </span>
                          {location && <span className="text-gray-400">{location}</span>}
                          <Pill status={r.status === "approved" ? "published" : r.status} />
                          {r.verifiedStay && (
                            <span className="inline-flex items-center gap-1 text-emerald-600 text-[10px] font-black">
                              <BadgeCheck size={12} /> Verified stay
                            </span>
                          )}
                        </div>

                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">“{r.comment}”</p>

                        {editingId === r._id ? (
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              autoFocus
                              value={nameDraft}
                              onChange={(e) => setNameDraft(e.target.value.slice(0, 80))}
                              placeholder="Name shown publicly — empty shows your account name"
                              className={`${inputClass} max-w-xs`}
                            />
                            <EnterpriseButton
                              size="sm"
                              loading={busy === `name-${r._id}`}
                              onClick={() => saveName(r)}
                            >
                              <Check size={13} /> Save
                            </EnterpriseButton>
                            <EnterpriseButton size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                              <X size={13} />
                            </EnterpriseButton>
                          </div>
                        ) : (
                          <p className="text-gray-400 flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-gray-600 dark:text-gray-300">{shownName}</span>
                            {r.displayName && r.customerId?.name && (
                              <span>(posted by {r.customerId.name})</span>
                            )}
                            {!r.displayName && r.customerId?.email && <span>· {r.customerId.email}</span>}
                            <span>· {shortDate(r.createdAt)}</span>
                            {isMine(r) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(r._id);
                                  setNameDraft(r.displayName ?? "");
                                }}
                                className="inline-flex items-center gap-1 text-[#F28C28] font-bold hover:underline cursor-pointer"
                              >
                                <Pencil size={11} /> Edit shown name
                              </button>
                            )}
                          </p>
                        )}
                      </div>

                      <div className="flex items-start gap-2 shrink-0">
                        <EnterpriseButton
                          size="sm"
                          variant={r.status === "approved" ? "ghost" : "outline"}
                          loading={busy === `status-${r._id}`}
                          onClick={() =>
                            run(
                              `status-${r._id}`,
                              () =>
                                reviewService.setStatus(
                                  r._id,
                                  r.status === "approved" ? "hidden" : "approved",
                                ),
                              reload,
                            )
                          }
                        >
                          {r.status === "approved" ? "Hide" : "Publish"}
                        </EnterpriseButton>
                        <EnterpriseButton
                          size="sm"
                          variant="ghost"
                          loading={busy === `del-${r._id}`}
                          onClick={() => remove(r)}
                        >
                          Delete
                        </EnterpriseButton>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <Pager page={meta.page} limit={meta.limit} total={meta.total} onPage={setPage} />
            </>
          )}
        </div>
      </Panel>
    </div>
  );
};

export default StayReviewsAdminPage;
