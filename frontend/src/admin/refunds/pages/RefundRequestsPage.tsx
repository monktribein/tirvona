import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { refundService } from "../../../services";
import { getErrorMessage } from "../../../lib/api";
import { useAuth } from "../../../contexts/AuthContext";
import { useNotifications } from "../../../contexts/NotificationContext";
import { formatCurrency, formatDateTimeIN } from "../../../utils/format";
import { humanizeLabel } from "../../../utils/labels";
import {
  EnterpriseButton,
  EnterpriseModal,
  EnterprisePageHeader,
  EnterpriseStatsCard,
} from "../../shared";
import {
  REFUND_MODULES,
  REFUND_STATUSES,
  REFUND_STATUS_TONE,
  calcOf,
  canApproveRefunds,
  canReviewRefunds,
  netAmountOf,
  refEmail,
  refName,
  type RefundRequest,
  type RefundStatus,
  type RefundSummary,
} from "../refund.types";
import {
  AlertTriangle,
  BadgeIndianRupee,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Inbox,
  Loader2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Undo2,
  XCircle,
} from "lucide-react";

const PAGE_SIZE = 20;

/** Amount bands, kept coarse so the filter stays useful without a numeric form. */
const AMOUNT_BANDS = [
  { value: "", label: "Any amount" },
  { value: "0-1000", label: "Under ₹1,000" },
  { value: "1000-5000", label: "₹1,000 – ₹5,000" },
  { value: "5000-25000", label: "₹5,000 – ₹25,000" },
  { value: "25000-", label: "Over ₹25,000" },
];

const DATE_RANGES = [
  { value: "", label: "Any date" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

export const RefundRequestsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [params, setParams] = useSearchParams();

  const [rows, setRows] = useState<RefundRequest[]>([]);
  const [summary, setSummary] = useState<RefundSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  // Server-side filters live in the URL so a queue view is shareable.
  const status = params.get("status") ?? "";
  const module = params.get("module") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1));

  // Client-side refinements over the loaded page. The list endpoint understands
  // status/module/page/limit only, and the brief was to add no backend
  // contract changes — so these narrow what is already loaded and say so.
  const [term, setTerm] = useState("");
  const [ashram, setAshram] = useState("");
  const [band, setBand] = useState("");
  const [days, setDays] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [rejectTarget, setRejectTarget] = useState<RefundRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const mayReview = canReviewRefunds(user?.role);
  const mayApprove = canApproveRefunds(user?.role);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  };

  const load = useCallback(
    async (initial: boolean) => {
      if (initial) setLoading(true);
      else setRefreshing(true);
      try {
        const [listRes, sumRes] = await Promise.all([
          refundService.list({
            page,
            limit: PAGE_SIZE,
            ...(status ? { status } : {}),
            ...(module ? { module } : {}),
          }),
          refundService.summary().catch(() => null),
        ]);
        setRows(listRes.data?.data ?? []);
        setTotal(Number(listRes.data?.total ?? 0));
        if (sumRes) setSummary(sumRes.data?.data ?? null);
        setError("");
      } catch (err) {
        setRows([]);
        setTotal(0);
        setError(getErrorMessage(err, "The refund queue could not be loaded."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, status, module],
  );

  useEffect(() => {
    load(true);
  }, [load]);

  /**
   * Apply an action with an optimistic status change.
   *
   * The row flips immediately so the queue feels responsive, then the server
   * response replaces it. On failure the previous row is restored rather than
   * left showing a state the server never accepted.
   */
  const act = async (
    request: RefundRequest,
    next: RefundStatus,
    run: () => Promise<any>,
    successLabel: string,
  ) => {
    const previous = rows;
    setBusyId(request._id);
    setRows((current) =>
      current.map((row) =>
        row._id === request._id ? { ...row, status: next } : row,
      ),
    );
    try {
      const res = await run();
      const updated: RefundRequest | undefined = res?.data?.data;
      if (updated)
        setRows((current) =>
          current.map((row) => (row._id === request._id ? { ...row, ...updated } : row)),
        );
      addNotification(successLabel, `${request.refundNumber} updated.`, "success");
      // Counts shift with every decision, so the header is refetched.
      refundService
        .summary()
        .then((r) => setSummary(r.data?.data ?? null))
        .catch(() => undefined);
    } catch (err) {
      setRows(previous);
      addNotification(
        "Action failed",
        getErrorMessage(err, "The refund was not updated."),
        "error",
      );
    } finally {
      setBusyId("");
    }
  };

  const submitReject = async () => {
    if (!rejectTarget || rejectReason.trim().length < 3) return;
    const target = rejectTarget;
    const reason = rejectReason.trim();
    setRejectTarget(null);
    setRejectReason("");
    await act(
      target,
      "rejected",
      () => refundService.reject(target._id, reason),
      "Refund rejected",
    );
  };

  const visible = useMemo(() => {
    const query = term.trim().toLowerCase();
    const cutoff = days
      ? Date.now() - Number(days) * 24 * 60 * 60 * 1000
      : null;
    const [min, max] = band
      ? band.split("-").map((v) => (v === "" ? null : Number(v)))
      : [null, null];

    return rows.filter((row) => {
      if (query) {
        const haystack = [
          row.refundNumber,
          row.sourceReference,
          row.reason,
          refName(row.customerId),
          refEmail(row.customerId),
          refName(row.ashramId),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (ashram && refName(row.ashramId) !== ashram) return false;
      if (cutoff && new Date(row.createdAt ?? 0).getTime() < cutoff) return false;
      if (min !== null || max !== null) {
        const amount = netAmountOf(row);
        if (min !== null && amount < min) return false;
        if (max !== null && amount > max) return false;
      }
      return true;
    });
  }, [rows, term, ashram, band, days]);

  const ashramOptions = useMemo(
    () =>
      [...new Set(rows.map((r) => refName(r.ashramId)).filter((n) => n !== "—"))].sort(),
    [rows],
  );

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const refining = Boolean(term || ashram || band || days);
  const counts = summary?.counts ?? {};

  return (
    <div className="space-y-6 text-left w-full">
      <EnterprisePageHeader
        title="Refund requests"
        subtitle="Review, approve and settle refunds across every module"
        icon={<Undo2 size={20} />}
        badgeText={summary ? `${summary.openCount} open` : undefined}
        actions={
          <div className="flex items-center gap-2">
            <EnterpriseButton
              variant="outline"
              size="sm"
              icon={
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              }
              onClick={() => load(false)}
            >
              Refresh
            </EnterpriseButton>
            <EnterpriseButton
              variant="secondary"
              size="sm"
              onClick={() => navigate("/admin/refunds/policies")}
            >
              Policies
            </EnterpriseButton>
          </div>
        }
      />

      {/* Analytics. Every figure comes from /refunds/summary — nothing here is
          derived or estimated. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <EnterpriseStatsCard
          title="Awaiting action"
          value={summary?.openCount ?? 0}
          description="Pending, in review, approved or processing"
          icon={<Clock size={18} />}
        />
        <EnterpriseStatsCard
          title="Refunded"
          value={summary?.settledCount ?? 0}
          description="Settled back to the customer"
          icon={<CheckCircle2 size={18} />}
        />
        <EnterpriseStatsCard
          title="Total refunded"
          value={formatCurrency(summary?.settledAmount ?? 0)}
          description="Net of processing fees"
          icon={<BadgeIndianRupee size={18} />}
        />
        <EnterpriseStatsCard
          title="Needs attention"
          value={(counts.failed ?? 0) + (counts.pending ?? 0)}
          description="Failed at the gateway, or not yet triaged"
          icon={<AlertTriangle size={18} />}
        />
      </div>

      {/* Status rail — doubles as the primary filter. */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setParam("status", "")}
          className={`px-3 py-1.5 rounded-full text-[11px] font-black border transition-colors cursor-pointer ${
            status === ""
              ? "bg-[#0A4DA6] text-white border-[#0A4DA6]"
              : "bg-white dark:bg-[#0B192C] border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:border-[#0A4DA6]"
          }`}
        >
          All{summary ? ` (${Object.values(counts).reduce((a, b) => a + (b ?? 0), 0)})` : ""}
        </button>
        {REFUND_STATUSES.map((value) => (
          <button
            key={value}
            onClick={() => setParam("status", value)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-black border transition-colors cursor-pointer ${
              status === value
                ? "bg-[#0A4DA6] text-white border-[#0A4DA6]"
                : `${REFUND_STATUS_TONE[value]} hover:opacity-80`
            }`}
          >
            {humanizeLabel(value)}
            {counts[value] ? ` (${counts[value]})` : ""}
          </button>
        ))}
      </div>

      {/* Filter row above everything it scopes. */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-4 sm:p-5 space-y-3 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search refund number, booking, pilgrim or reason..."
              aria-label="Search refunds"
              className="w-full pl-10 pr-3 py-2.5 rounded-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6]"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={module}
              onChange={(e) => setParam("module", e.target.value)}
              aria-label="Filter by module"
              className="px-4 py-2.5 rounded-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-[#0B192C] dark:text-white cursor-pointer focus:outline-none focus:border-[#0A4DA6]"
            >
              <option value="">All modules</option>
              {REFUND_MODULES.map((m) => (
                <option key={m} value={m}>
                  {humanizeLabel(m)}
                </option>
              ))}
            </select>
            <EnterpriseButton
              variant={showFilters ? "primary" : "outline"}
              size="sm"
              icon={<SlidersHorizontal size={14} />}
              onClick={() => setShowFilters((v) => !v)}
            >
              More
            </EnterpriseButton>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <select
              value={ashram}
              onChange={(e) => setAshram(e.target.value)}
              aria-label="Filter by ashram"
              className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-[#0B192C] dark:text-white cursor-pointer focus:outline-none focus:border-[#0A4DA6]"
            >
              <option value="">All ashrams</option>
              {ashramOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={band}
              onChange={(e) => setBand(e.target.value)}
              aria-label="Filter by amount"
              className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-[#0B192C] dark:text-white cursor-pointer focus:outline-none focus:border-[#0A4DA6]"
            >
              {AMOUNT_BANDS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
            <select
              value={days}
              onChange={(e) => setDays(e.target.value)}
              aria-label="Filter by date"
              className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-[#0B192C] dark:text-white cursor-pointer focus:outline-none focus:border-[#0A4DA6]"
            >
              {DATE_RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {refining && (
          <p className="text-[11px] text-gray-500 font-semibold">
            Showing {visible.length} of {rows.length} loaded on this page.
            Ashram, amount and date narrow the current page; status and module
            query the server.
            <button
              onClick={() => {
                setTerm("");
                setAshram("");
                setBand("");
                setDays("");
              }}
              className="ml-2 text-[#0A4DA6] hover:underline font-bold cursor-pointer"
            >
              Clear
            </button>
          </p>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-500/10 dark:border-rose-500/30 px-4 py-3">
          <AlertTriangle size={16} className="text-rose-600 mt-0.5 shrink-0" />
          <div className="text-xs">
            <p className="font-bold text-rose-900 dark:text-rose-300">
              Could not load refunds
            </p>
            <p className="text-rose-800/80 dark:text-rose-400/80">{error}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 rounded-2xl bg-gray-100 dark:bg-slate-900 animate-pulse"
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] py-16 text-center space-y-2">
          <Inbox size={30} className="mx-auto text-gray-300" />
          <p className="text-sm font-bold text-[#0B192C] dark:text-white">
            {rows.length === 0
              ? "No refund requests yet"
              : "No requests match these filters"}
          </p>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            {rows.length === 0
              ? "Requests appear here as pilgrims claim refunds against bookings, orders and parking."
              : "Try widening the amount, date or ashram filter."}
          </p>
        </div>
      ) : (
        <div
          className={`space-y-3 transition-opacity ${refreshing ? "opacity-60" : ""}`}
        >
          {visible.map((row) => {
            const calc = calcOf(row);
            const amount = netAmountOf(row);
            const busy = busyId === row._id;
            return (
              <div
                key={row._id}
                className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-4 sm:p-5 shadow-sm hover:border-[#0A4DA6]/40 transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <button
                    onClick={() => navigate(`/admin/refunds/${row._id}`)}
                    className="flex-1 min-w-0 text-left cursor-pointer"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-black text-[#0B192C] dark:text-white">
                        {row.refundNumber}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black ${REFUND_STATUS_TONE[row.status]}`}
                      >
                        {humanizeLabel(row.status)}
                      </span>
                      {row.autoApproved && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-[9px] font-black border border-indigo-200 dark:border-indigo-900/50">
                          Auto-approved
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-gray-400">
                        {humanizeLabel(row.module)}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[#0B192C] dark:text-white mt-1 truncate">
                      {refName(row.customerId)}
                      {refName(row.ashramId) !== "—" && (
                        <span className="text-gray-400 font-medium">
                          {" "}
                          · {refName(row.ashramId)}
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {row.sourceReference ? `${row.sourceReference} — ` : ""}
                      {row.reason}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Raised {formatDateTimeIN(row.createdAt)}
                    </p>
                  </button>

                  <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0">
                    <div className="text-right">
                      <span className="block text-sm font-black text-[#0A4DA6] dark:text-blue-400 tabular-nums">
                        {formatCurrency(amount)}
                      </span>
                      {calc?.refundPercent !== undefined && (
                        <span className="block text-[10px] text-gray-400 font-semibold">
                          {calc.refundPercent}% of eligible
                        </span>
                      )}
                    </div>

                    {/* Only actions the server would accept from this role in
                        this state are offered. */}
                    <div className="flex items-center gap-1.5">
                      {busy && (
                        <Loader2 size={14} className="animate-spin text-[#0A4DA6]" />
                      )}
                      {mayReview && row.status === "pending" && (
                        <EnterpriseButton
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            act(
                              row,
                              "under_review",
                              () => refundService.review(row._id),
                              "Moved to review",
                            )
                          }
                        >
                          Review
                        </EnterpriseButton>
                      )}
                      {mayApprove &&
                        ["pending", "under_review"].includes(row.status) && (
                          <EnterpriseButton
                            size="sm"
                            variant="success"
                            disabled={busy}
                            onClick={() =>
                              act(
                                row,
                                "approved",
                                () => refundService.approve(row._id),
                                "Refund approved",
                              )
                            }
                          >
                            Approve
                          </EnterpriseButton>
                        )}
                      {mayApprove &&
                        ["approved", "failed"].includes(row.status) && (
                          <EnterpriseButton
                            size="sm"
                            variant="primary"
                            disabled={busy}
                            onClick={() =>
                              act(
                                row,
                                "processing",
                                () => refundService.process(row._id),
                                "Sent to the gateway",
                              )
                            }
                          >
                            {row.status === "failed" ? "Retry" : "Process"}
                          </EnterpriseButton>
                        )}
                      {mayReview &&
                        ["pending", "under_review", "failed"].includes(row.status) && (
                          <EnterpriseButton
                            size="sm"
                            variant="danger"
                            disabled={busy}
                            icon={<XCircle size={13} />}
                            onClick={() => {
                              setRejectTarget(row);
                              setRejectReason("");
                            }}
                          >
                            Reject
                          </EnterpriseButton>
                        )}
                      <EnterpriseButton
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/admin/refunds/${row._id}`)}
                      >
                        Open
                      </EnterpriseButton>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between gap-3 text-xs font-semibold text-gray-500">
          <span>
            Page {page} of {pages} · {total} request{total === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <EnterpriseButton
              size="sm"
              variant="outline"
              disabled={page <= 1}
              icon={<ChevronLeft size={14} />}
              onClick={() => setParam("page", String(page - 1))}
            >
              Previous
            </EnterpriseButton>
            <EnterpriseButton
              size="sm"
              variant="outline"
              disabled={page >= pages}
              onClick={() => setParam("page", String(page + 1))}
            >
              Next <ChevronRight size={14} />
            </EnterpriseButton>
          </div>
        </div>
      )}

      <EnterpriseModal
        isOpen={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title="Reject refund"
        subtitle={rejectTarget?.refundNumber}
        icon={<XCircle size={18} />}
        footer={
          <div className="flex justify-end gap-2">
            <EnterpriseButton
              variant="ghost"
              onClick={() => setRejectTarget(null)}
            >
              Cancel
            </EnterpriseButton>
            <EnterpriseButton
              variant="danger"
              disabled={rejectReason.trim().length < 3}
              onClick={submitReject}
            >
              Reject refund
            </EnterpriseButton>
          </div>
        }
      >
        <div className="space-y-2">
          <label className="text-[11px] font-black text-gray-500 block">
            Reason <span className="text-rose-500">*</span>
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value.slice(0, 1000))}
            rows={4}
            placeholder="Explain why this claim is refused. The customer sees this."
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6] resize-none"
          />
          <p className="text-[10px] text-gray-400">
            A rejection is final — the state machine allows no route back.
          </p>
        </div>
      </EnterpriseModal>
    </div>
  );
};

export default RefundRequestsPage;
