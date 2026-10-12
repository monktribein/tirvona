/**
 * Pandit withdrawals queue: finance pays out what pandits request from their wallets.
 * Route: /admin/pandits/withdrawals
 *
 * Flow: REQUESTED -> (PROCESSING) -> PAID with the bank UTR, or REJECTED (money returns to the pandit's balance).
 */
import React, { useCallback, useEffect, useState } from "react";
import { Eye, Landmark, RefreshCw, Wallet } from "lucide-react";
import { providerWalletAdminService } from "../services/provider.service";
import { getErrorMessage } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorNotice,
  Field,
  Modal,
  PageContainer,
  PageHeader,
  Pagination,
  Skeleton,
  StatusBadge,
  formatMinor,
  inputClass,
  type Column,
} from "../ui";

const PAGE_SIZE = 20;
const STATUSES = ["REQUESTED", "PROCESSING", "PAID", "REJECTED", "CANCELLED"];
const inr = (minor?: number | null) => formatMinor(minor ?? 0) ?? "₹0";
const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : "";

type Action = { kind: "pay" | "reject"; row: any } | null;

export const AdminPanditWithdrawalsPage: React.FC = () => {
  const [overview, setOverview] = useState<any | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("REQUESTED");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [details, setDetails] = useState<{ row: any; data: any } | null>(null);
  const [action, setAction] = useState<Action>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, ov] = await Promise.all([
        providerWalletAdminService.withdrawals({ status: status || undefined, page, limit: PAGE_SIZE }),
        providerWalletAdminService.overview(),
      ]);
      setRows(list.data.data || []);
      setTotal(list.data.meta?.total ?? 0);
      setOverview(ov.data.data);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load withdrawals."));
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  const reveal = async (row: any) => {
    try {
      const res = await providerWalletAdminService.revealDestination(row.id);
      setDetails({ row, data: res.data.data });
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not load the bank details."));
    }
  };

  const markProcessing = async (row: any) => {
    try {
      await providerWalletAdminService.markProcessing(row.id);
      toast.success(`${row.withdrawalNumber} marked as processing.`);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not update the withdrawal."));
    }
  };

  const submitAction = async () => {
    if (!action) return;
    if (text.trim().length < (action.kind === "pay" ? 4 : 3)) {
      toast.error(action.kind === "pay" ? "Enter the bank UTR / UPI reference." : "Enter a reason.");
      return;
    }
    setBusy(true);
    try {
      if (action.kind === "pay") await providerWalletAdminService.markPaid(action.row.id, text.trim());
      else await providerWalletAdminService.reject(action.row.id, text.trim());
      toast.success(action.kind === "pay" ? "Marked as paid. The pandit has been notified." : "Rejected. The amount is back in the pandit's wallet.");
      setAction(null);
      setText("");
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not update the withdrawal."));
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<any>[] = [
    {
      key: "who",
      header: "Pandit",
      primary: true,
      cell: (r) => (
        <div>
          <p className="font-bold text-[#0B192C] dark:text-white">{r.provider?.displayName || "Provider"}</p>
          <p className="text-xs text-gray-500">{r.withdrawalNumber}</p>
        </div>
      ),
    },
    { key: "amount", header: "Amount", cell: (r) => <span className="font-black tabular-nums">{inr(r.amountMinor)}</span> },
    {
      key: "to",
      header: "Destination",
      cell: (r) => (
        <div>
          <p>{r.destination?.label}</p>
          <p className="text-xs text-gray-500">{r.destination?.accountHolderName}</p>
        </div>
      ),
    },
    { key: "requested", header: "Requested", cell: (r) => <span className="whitespace-nowrap text-gray-600 dark:text-gray-400">{when(r.createdAt)}</span> },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <div>
          <StatusBadge status={r.status} />
          {r.payoutReference && <p className="mt-1 text-xs text-gray-500">UTR {r.payoutReference}</p>}
          {r.rejectionReason && <p className="mt-1 text-xs text-rose-700">{r.rejectionReason}</p>}
          {r.note && <p className="mt-1 text-xs text-gray-500">Note: {r.note}</p>}
        </div>
      ),
    },
  ];

  const open = (r: any) => r.status === "REQUESTED" || r.status === "PROCESSING";

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Pandits & Acharyas"
        icon={<Wallet size={20} />}
        title="Pandit withdrawals"
        description="Pay pandits what they withdraw from their wallets. Transfer the amount, then record the bank UTR."
        actions={
          <Button variant="outline" onClick={load}>
            <RefreshCw size={16} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <section aria-label="Totals" className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          { label: "Open requests", value: overview ? String(overview.openWithdrawals) : null },
          { label: "Waiting to be paid", value: overview ? inr(overview.withdrawingMinor) : null },
          { label: "Available in wallets", value: overview ? inr(overview.availableMinor) : null },
          { label: "On 72h hold", value: overview ? inr(overview.pendingMinor) : null },
          { label: "Paid out to date", value: overview ? inr(overview.paidOutMinor) : null },
        ].map((t) => (
          <Card key={t.label} className="p-4">
            <p className="text-xs font-semibold text-gray-500">{t.label}</p>
            <p className="mt-1 text-xl font-black tabular-nums text-[#0B192C] dark:text-white">{t.value ?? <Skeleton className="h-6 w-20" />}</p>
          </Card>
        ))}
      </section>

      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <Field label="Status" className="w-full sm:w-56">
            <select
              className={inputClass}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {error ? (
          <ErrorNotice message={error} onRetry={load} />
        ) : loading && rows.length === 0 ? (
          <div className="space-y-3">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<Landmark size={24} />} title="No withdrawals here" description="Requests from pandits will appear in this queue." />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(r) => r.id}
              caption="Pandit withdrawal requests"
              actions={(r) =>
                open(r) ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" className="!min-h-[36px] !px-3" onClick={() => reveal(r)}>
                      <Eye size={14} aria-hidden="true" />
                      Bank details
                    </Button>
                    {r.status === "REQUESTED" && (
                      <Button variant="ghost" className="!min-h-[36px] !px-3" onClick={() => markProcessing(r)}>
                        Processing
                      </Button>
                    )}
                    <Button className="!min-h-[36px] !px-3" onClick={() => { setText(""); setAction({ kind: "pay", row: r }); }}>
                      Mark paid
                    </Button>
                    <Button variant="danger" className="!min-h-[36px] !px-3" onClick={() => { setText(""); setAction({ kind: "reject", row: r }); }}>
                      Reject
                    </Button>
                  </div>
                ) : null
              }
            />
            <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} onChange={setPage} />
          </>
        )}
      </Card>

      <Modal
        open={!!details}
        onClose={() => setDetails(null)}
        title="Transfer details"
        description={details ? `${details.row.withdrawalNumber} · ${inr(details.row.amountMinor)}. Viewing is recorded in the audit log.` : undefined}
        size="sm"
        footer={
          <Button variant="outline" onClick={() => setDetails(null)}>
            Close
          </Button>
        }
      >
        {details && (
          <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">Name</dt>
            <dd className="font-semibold">{details.data.accountHolderName}</dd>
            {details.data.method === "BANK" ? (
              <>
                <dt className="text-gray-500">Account</dt>
                <dd className="font-mono font-semibold select-all">{details.data.accountNumber}</dd>
                <dt className="text-gray-500">IFSC</dt>
                <dd className="font-mono font-semibold select-all">{details.data.ifsc}</dd>
                {details.data.bankName && (
                  <>
                    <dt className="text-gray-500">Bank</dt>
                    <dd>{details.data.bankName}</dd>
                  </>
                )}
              </>
            ) : (
              <>
                <dt className="text-gray-500">UPI id</dt>
                <dd className="font-mono font-semibold select-all">{details.data.upiId}</dd>
              </>
            )}
          </dl>
        )}
      </Modal>

      <Modal
        open={!!action}
        onClose={() => setAction(null)}
        title={action?.kind === "pay" ? "Mark withdrawal as paid" : "Reject withdrawal"}
        description={
          action
            ? action.kind === "pay"
              ? `Confirm you transferred ${inr(action.row.amountMinor)} to ${action.row.provider?.displayName || "the pandit"}.`
              : `${inr(action.row.amountMinor)} will return to the pandit's available balance.`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setAction(null)}>
              Back
            </Button>
            <Button variant={action?.kind === "reject" ? "danger" : "primary"} loading={busy} onClick={submitAction}>
              {action?.kind === "pay" ? "Mark paid" : "Reject"}
            </Button>
          </>
        }
      >
        <Field label={action?.kind === "pay" ? "Bank UTR / UPI reference" : "Reason (shown to the pandit)"} required>
          <input className={inputClass} value={text} onChange={(e) => setText(e.target.value)} maxLength={action?.kind === "pay" ? 64 : 300} data-autofocus />
        </Field>
      </Modal>
    </PageContainer>
  );
};

export default AdminPanditWithdrawalsPage;
