import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Landmark,
  Loader2,
  RefreshCw,
  Search,
  Send,
  Smartphone,
  XCircle,
} from "lucide-react";
import {
  EnterpriseButton,
  EnterpriseModal,
  EnterprisePageHeader,
} from "../../shared";
import { getErrorMessage } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import { formatCurrency, formatDateTimeIN } from "../../../utils/format";
import {
  WITHDRAWAL_STATUS_LABEL,
  WITHDRAWAL_STATUS_TONE,
  walletAdminService,
  type WalletWithdrawal,
  type WithdrawalStatus,
} from "../../../services/wallet.service";

const PAGE_SIZE = 20;
const inr = (v: number) => formatCurrency(v ?? 0, "INR");
const field =
  "w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-[#0B192C] dark:text-white outline-none focus:border-[#F28C28] focus:ring-2 focus:ring-[#F28C28]/20";

const TABS: { key: WithdrawalStatus | ""; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "paid", label: "Paid" },
  { key: "rejected", label: "Rejected" },
  { key: "cancelled", label: "Cancelled" },
  { key: "", label: "All" },
];

type Action = { kind: "approve" | "reject" | "paid"; row: WalletWithdrawal } | null;

const person = (row: WalletWithdrawal) =>
  typeof row.userId === "object" && row.userId ? row.userId : null;

const CopyValue: React.FC<{ label: string; value?: string }> = ({ label, value }) =>
  value ? (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 dark:bg-slate-900 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase text-gray-400">{label}</p>
        <p className="text-sm font-extrabold text-[#0B192C] dark:text-white break-all">{value}</p>
      </div>
      <button
        type="button"
        title={`Copy ${label}`}
        onClick={() =>
          navigator.clipboard
            ?.writeText(value)
            .then(() => toast.success(`${label} copied`))
            .catch(() => undefined)
        }
        className="p-1.5 rounded-lg text-gray-400 hover:text-[#F28C28] hover:bg-white dark:hover:bg-slate-800 shrink-0"
      >
        <Copy size={14} />
      </button>
    </div>
  ) : null;

/**
 * The transfer-request queue. A pilgrim asks for wallet money in their bank
 * or UPI; finance approves it, sends the money from the company account, and
 * records the UTR here. Rejecting returns the amount to the pilgrim's wallet.
 */
export const AdminWithdrawalsPage: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<WithdrawalStatus | "">("pending");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<WalletWithdrawal[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<Action>(null);
  const [input, setInput] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setTerm(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(handle);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await walletAdminService.withdrawals({
        page,
        limit: PAGE_SIZE,
        status: status || undefined,
        search: term || undefined,
      });
      setRows(res.data.data ?? []);
      setTotal(res.data.total ?? 0);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not load transfer requests."));
    } finally {
      setLoading(false);
    }
  }, [page, status, term]);

  useEffect(() => {
    load();
  }, [load]);

  const open = (kind: "approve" | "reject" | "paid", row: WalletWithdrawal) => {
    setAction({ kind, row });
    setInput("");
    setNote("");
    setError("");
  };

  const submit = async () => {
    if (!action) return;
    const { kind, row } = action;
    if (kind === "reject" && input.trim().length < 3) return setError("Give the pilgrim a reason (at least 3 characters).");
    if (kind === "paid" && input.trim().length < 3) return setError("Enter the bank / UPI transaction reference (UTR).");
    setSaving(true);
    setError("");
    try {
      if (kind === "approve") await walletAdminService.approve(row._id, note.trim() || undefined);
      if (kind === "reject") await walletAdminService.reject(row._id, input.trim());
      if (kind === "paid") await walletAdminService.markPaid(row._id, input.trim(), note.trim() || undefined);
      setAction(null);
      load();
    } catch (err) {
      setError(getErrorMessage(err, "Could not update this request."));
    } finally {
      setSaving(false);
    }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const titles = {
    approve: "Approve transfer request",
    reject: "Reject transfer request",
    paid: "Mark as transferred",
  } as const;

  return (
    <div className="space-y-6">
      <EnterprisePageHeader
        title="Wallet Transfer Requests"
        subtitle="Pilgrims asking for wallet money in their bank account or UPI"
        icon={<Landmark size={22} />}
        actions={
          <div className="flex flex-wrap gap-2">
            <EnterpriseButton variant="outline" icon={<ArrowLeft size={14} />} onClick={() => navigate("/admin/wallets")}>
              All wallets
            </EnterpriseButton>
            <EnterpriseButton variant="outline" icon={<RefreshCw size={14} />} onClick={load}>
              Refresh
            </EnterpriseButton>
          </div>
        }
      />

      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => {
                  setStatus(t.key);
                  setPage(1);
                }}
                className={`rounded-full px-4 py-1.5 text-xs font-bold border transition-colors ${
                  status === t.key
                    ? "bg-[#F28C28] text-white border-[#F28C28]"
                    : "border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative lg:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className={`${field} pl-9`}
              placeholder="Request no., name, email or phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="py-14 flex justify-center text-gray-400">
            <Loader2 className="animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-14 text-center text-sm text-gray-500">No requests here.</p>
        ) : (
          <div className="grid gap-3">
            {rows.map((w) => {
              const u = person(w);
              return (
                <article key={w._id} className="rounded-3xl border border-gray-100 dark:border-slate-800 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xl font-black text-[#0B192C] dark:text-white tabular-nums">{inr(w.amount)}</p>
                      <p className="text-xs font-bold text-[#0B192C] dark:text-gray-200">
                        {u?.name || u?.email || u?.phone || "Pilgrim"}
                        <span className="font-medium text-gray-500"> · {[u?.email, u?.phone].filter(Boolean).join(" · ")}</span>
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {w.requestNumber} · requested {formatDateTimeIN(w.createdAt)}
                      </p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${WITHDRAWAL_STATUS_TONE[w.status]}`}>
                      {WITHDRAWAL_STATUS_LABEL[w.status]}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {w.method === "upi" ? (
                      <>
                        <CopyValue label="UPI ID" value={w.upiId} />
                        <CopyValue label="Name" value={w.accountHolderName} />
                      </>
                    ) : (
                      <>
                        <CopyValue label="Account holder" value={w.accountHolderName} />
                        <CopyValue label="Account number" value={w.accountNumber} />
                        <CopyValue label="IFSC" value={w.ifsc} />
                        <CopyValue label="Bank" value={w.bankName} />
                      </>
                    )}
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-500">
                    {w.method === "upi" ? <Smartphone size={12} /> : <Landmark size={12} />}
                    {w.method === "upi" ? "UPI transfer" : "Bank transfer (NEFT/IMPS)"}
                  </p>
                  {w.customerNote && (
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                      <b>Pilgrim's note:</b> {w.customerNote}
                    </p>
                  )}
                  {w.adminNote && (
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                      <b>Admin note:</b> {w.adminNote}
                    </p>
                  )}
                  {w.status === "paid" && (
                    <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                      Paid {formatDateTimeIN(w.paidAt)} · UTR {w.payoutReference}
                      {typeof w.paidBy === "object" && w.paidBy?.name ? ` · by ${w.paidBy.name}` : ""}
                    </p>
                  )}
                  {w.status === "rejected" && (
                    <p className="mt-1 text-xs text-red-600">Rejected: {w.rejectionReason} (amount returned to wallet)</p>
                  )}

                  {["pending", "approved"].includes(w.status) && (
                    <div className="mt-4 flex flex-wrap gap-2 justify-end">
                      <EnterpriseButton size="sm" variant="danger" icon={<XCircle size={13} />} onClick={() => open("reject", w)}>
                        Reject
                      </EnterpriseButton>
                      {w.status === "pending" && (
                        <EnterpriseButton size="sm" variant="secondary" icon={<CheckCircle2 size={13} />} onClick={() => open("approve", w)}>
                          Approve
                        </EnterpriseButton>
                      )}
                      <EnterpriseButton size="sm" variant="success" icon={<Send size={13} />} onClick={() => open("paid", w)}>
                        Mark as transferred
                      </EnterpriseButton>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              Page {page} of {pages} · {total} requests
            </span>
            <div className="flex gap-2">
              <EnterpriseButton size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={14} />
              </EnterpriseButton>
              <EnterpriseButton size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight size={14} />
              </EnterpriseButton>
            </div>
          </div>
        )}
      </div>

      {action && (
        <EnterpriseModal
          isOpen
          onClose={() => setAction(null)}
          title={titles[action.kind]}
          subtitle={`${action.row.requestNumber} · ${inr(action.row.amount)}`}
          footer={
            <div className="flex justify-end gap-2">
              <EnterpriseButton variant="outline" onClick={() => setAction(null)}>
                Back
              </EnterpriseButton>
              <EnterpriseButton
                variant={action.kind === "reject" ? "danger" : action.kind === "paid" ? "success" : "primary"}
                loading={saving}
                disabled={saving}
                onClick={submit}
              >
                {action.kind === "approve" ? "Approve" : action.kind === "reject" ? "Reject and refund wallet" : "Confirm transfer"}
              </EnterpriseButton>
            </div>
          }
        >
          {action.kind === "approve" && (
            <p className="text-gray-600 dark:text-gray-300">
              Approving tells the pilgrim the transfer is on its way. Send the
              money from the company account, then use "Mark as transferred"
              with the UTR.
            </p>
          )}
          {action.kind === "reject" && (
            <>
              <p className="text-gray-600 dark:text-gray-300">
                {inr(action.row.amount)} goes back to the pilgrim's wallet and
                they are told why.
              </p>
              <textarea className={field} rows={3} placeholder="Reason shown to the pilgrim" value={input} onChange={(e) => setInput(e.target.value)} maxLength={500} />
            </>
          )}
          {action.kind === "paid" && (
            <>
              <p className="text-gray-600 dark:text-gray-300">
                Only mark this after the money has left the company account.
                The pilgrim sees the reference.
              </p>
              <input className={field} placeholder="UTR / transaction reference" value={input} onChange={(e) => setInput(e.target.value)} maxLength={80} />
            </>
          )}
          {action.kind !== "reject" && (
            <textarea className={field} rows={2} placeholder="Internal note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          )}
          {error && (
            <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>
          )}
        </EnterpriseModal>
      )}
    </div>
  );
};

export default AdminWithdrawalsPage;
