import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Download, Eye, FileText, IndianRupee, Landmark, Percent, RefreshCw } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "../../lib/toast";
import { EnterpriseButton } from "../shared/components/EnterpriseButton";
import { EnterpriseModal } from "../shared/components/EnterpriseModal";
import { EnterprisePageHeader } from "../shared/components/EnterprisePageHeader";
import { askReason, Chips, Empty, Field, inputClass, Pager, Panel, PanelState, ResponsiveTable, Stat, useAction, useRemote } from "../../modules/marketplace/ui";
import { yatraFinance } from "../../modules/yatra/services/yatra.service";
import { dateLong, dateTimeIst, rupees, StatusPill, YatraGate } from "../../modules/yatra/yatraUi";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "payables", label: "Payables" },
  { value: "payouts", label: "Payouts" },
  { value: "rules", label: "Commission rules" },
  { value: "razorpay", label: "Razorpay reconciliation" },
  { value: "reports", label: "Reports" },
];
const PAYEE_LABEL: Record<string, string> = { operator: "Partner", ride_partner: "Ride partner" };
const APPLIES_LABEL: Record<string, string> = { yatra_booking: "Tour bookings", ride: "Local rides", addon_referral: "Meal & puja referrals" };
const CHANNEL_LABEL: Record<string, string> = { any: "Every channel", MARKETPLACE: "Tirvona website", DIRECT: "Partner's own sales" };
const pct = (bps: number) => `${(Number(bps || 0) / 100).toFixed(2).replace(/\.00$/, "")}%`;
const istToday = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() + 330 * 60_000 - n * 86_400_000).toISOString().slice(0, 10);
const openSigned = async (p: Promise<any>) => {
  const res = await p;
  window.open(res.data.data.url, "_blank", "noopener,noreferrer");
};

/**
 * Yatra Finance Center (Super Admin and Finance Manager). Every number comes
 * from Tirvona's own ledgers. Nothing on this page sends money: transfers are
 * made in the bank outside Tirvona and only recorded here.
 */
export const YatraFinanceCenterPage: React.FC = () => {
  const initial = new URLSearchParams(window.location.search).get("tab") ?? "overview";
  const [tab, setTab] = useState(TABS.some((t) => t.value === initial) ? initial : "overview");
  const { user } = useAuth();
  return (
    <YatraGate>
      <div className="space-y-5">
        <EnterprisePageHeader
          title="Yatra Finance Center"
          subtitle="Collections, Tirvona commission, what is owed to partners and ride partners, and manual payouts. Nothing here sends money automatically."
          icon={<IndianRupee size={20} />}
          actions={user?.role === "super_admin" ? <Link to="/admin/yatra/collections" className="text-xs font-bold text-[#F28C28] hover:underline">Collections & ledger →</Link> : undefined}
        />
        <div className="overflow-x-auto -mx-1 px-1"><Chips value={tab} onChange={setTab} options={TABS} /></div>
        {tab === "overview" && <Overview onTab={setTab} />}
        {tab === "payables" && <Payables />}
        {tab === "payouts" && <Payouts />}
        {tab === "rules" && <Rules />}
        {tab === "razorpay" && <Razorpay />}
        {tab === "reports" && <Reports />}
      </div>
    </YatraGate>
  );
};

// ================================================================= overview
const Overview: React.FC<{ onTab: (t: string) => void }> = ({ onTab }) => {
  const [range, setRange] = useState({ from: "", to: "" });
  const d = useRemote<any>(() => yatraFinance.dashboard(range), [range.from, range.to]);
  return (
    <>
      <div className="flex flex-wrap gap-3 items-end">
        <Field label="From"><input type="date" className={inputClass} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></Field>
        <Field label="To"><input type="date" className={inputClass} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></Field>
        {(range.from || range.to) && <EnterpriseButton variant="ghost" onClick={() => setRange({ from: "", to: "" })}>All time</EnterpriseButton>}
      </div>
      {d.state !== "ready" || !d.data ? <PanelState state={d.state} error={d.error} onRetry={d.reload} /> : (
        <>
          {d.data.bookingsAwaitingRule > 0 && (
            <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3 text-xs font-semibold text-amber-800 dark:text-amber-200 flex flex-wrap gap-2 items-center justify-between">
              <span>{d.data.bookingsAwaitingRule} confirmed booking{d.data.bookingsAwaitingRule === 1 ? " has" : "s have"} no commission rule, so the partner earning is not posted yet.</span>
              <EnterpriseButton size="sm" onClick={() => onTab("rules")}>Fix in Commission rules</EnterpriseButton>
            </div>
          )}
          <Panel title="Money collected by Tirvona">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat label="Gross collected" value={rupees(d.data.collections.total)} hint="All customer payments. This is not revenue." icon={<IndianRupee size={16} />} />
              <Stat label="Tour bookings" value={rupees(d.data.collections.bookings)} hint={`${d.data.collections.confirmedBookings} paid bookings`} />
              <Stat label="Meal & puja add-ons" value={rupees(d.data.collections.addOns)} />
              <Stat label="Local rides" value={rupees(d.data.collections.rides)} />
              <Stat label="Refunded to wallets" value={rupees(d.data.refunds.toWallet)} />
              <Stat label="Unusable payments returned" value={rupees(d.data.refunds.unusablePaymentsReturned)} tone={d.data.refunds.unusablePaymentsReturned ? "warn" : undefined} />
            </div>
          </Panel>
          <Panel title="Tirvona revenue (commission)">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat label="Commission earned" value={rupees(d.data.tirvona.commission)} tone="ok" icon={<Percent size={16} />} hint="Tirvona's revenue, excluding GST" />
              <Stat label="GST on commission" value={rupees(d.data.tirvona.gstOnCommission)} hint="Collected for the government" />
              <Stat label="TDS withheld" value={rupees(d.data.tirvona.tdsWithheld)} hint="To deposit against the payee's PAN" />
            </div>
          </Panel>
          <Panel title="Owed and paid out">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat label="Owed to partners" value={rupees(d.data.payables.organisers)} hint="Delivered journeys, not yet paid" />
              <Stat label="Owed to ride partners" value={rupees(d.data.payables.ridePartners)} hint="Completed rides, not yet paid" />
              <Stat label="Not yet delivered" value={rupees(d.data.payables.notYetDelivered.organisers + d.data.payables.notYetDelivered.ridePartners)} hint="Becomes payable after the journey ends" />
              <Stat label="Payouts in progress" value={rupees(d.data.transfers.pending)} hint={`${d.data.transfers.pendingCount} request${d.data.transfers.pendingCount === 1 ? "" : "s"}`} tone={d.data.transfers.pendingCount ? "warn" : undefined} />
              <Stat label="Transferred" value={rupees(d.data.transfers.completed)} icon={<Landmark size={16} />} />
              <Stat label="Awaiting bank check" value={d.data.transfers.awaitingReconciliation} tone={d.data.transfers.awaitingReconciliation ? "warn" : undefined} />
              <Stat label="Bank differences" value={rupees(d.data.transfers.reconciliationDifferences)} tone={d.data.transfers.reconciliationDifferences ? "warn" : undefined} />
            </div>
          </Panel>
          <Panel title="Razorpay settlement (latest runs)" actions={<EnterpriseButton size="sm" variant="ghost" onClick={() => onTab("razorpay")}>Open</EnterpriseButton>}>
            {!d.data.razorpaySettlement.length ? <p className="text-xs text-gray-500">No reconciliation has run yet.</p> : (
              <ResponsiveTable
                rows={d.data.razorpaySettlement}
                rowKey={(r: any) => r.periodDate}
                columns={[
                  { header: "Day", cell: (r: any) => r.periodDate },
                  { header: "Status", cell: (r: any) => <StatusPill status={r.status} /> },
                  { header: "Checked", cell: (r: any) => r.checked },
                  { header: "Matched", cell: (r: any) => r.matched },
                  { header: "Settled", cell: (r: any) => r.settled, hideOnMobile: true },
                  { header: "Mismatches", cell: (r: any) => <span className={r.mismatches ? "font-black text-rose-600" : ""}>{r.mismatches}</span> },
                ]}
              />
            )}
          </Panel>
        </>
      )}
    </>
  );
};

// ================================================================= payables
const Payables: React.FC = () => {
  const [type, setType] = useState("");
  const list = useRemote<any[]>(() => yatraFinance.payees(type || undefined), [type]);
  const [statement, setStatement] = useState<any>(null);
  const [payout, setPayout] = useState<any>(null);
  const [adjust, setAdjust] = useState<any>(null);
  return (
    <Panel>
      <div className="space-y-3">
        <Chips value={type} onChange={setType} options={[{ value: "", label: "Everyone" }, { value: "operator", label: "Partners" }, { value: "ride_partner", label: "Ride partners" }]} />
        {list.state !== "ready" ? <PanelState state={list.state} error={list.error} onRetry={list.reload} /> : !list.data?.length ? <Empty title="No approved partners or ride partners yet" /> : (
          <ResponsiveTable
            rows={list.data}
            rowKey={(p) => `${p.payeeType}:${p.payeeId}`}
            columns={[
              { header: "Payee", cell: (p) => <div><p className="font-black">{p.name}</p><p className="text-[10px] text-gray-500">{PAYEE_LABEL[p.payeeType]}</p></div> },
              { header: "Can be paid", cell: (p) => <b className="tabular-nums">{rupees(p.available)}</b> },
              { header: "Not yet delivered", cell: (p) => rupees(p.pending), hideOnMobile: true },
              { header: "In open payout", cell: (p) => rupees(p.inOpenPayouts), hideOnMobile: true },
              { header: "Paid out", cell: (p) => rupees(p.transfers), hideOnMobile: true },
              {
                header: "Actions",
                cell: (p) => (
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    <EnterpriseButton size="sm" variant="ghost" icon={<FileText size={12} />} onClick={() => setStatement(p)}>Statement</EnterpriseButton>
                    {p.requestable > 0 && <EnterpriseButton size="sm" onClick={() => setPayout(p)}>Create payout</EnterpriseButton>}
                    <EnterpriseButton size="sm" variant="ghost" onClick={() => setAdjust(p)}>Adjust</EnterpriseButton>
                  </div>
                ),
              },
            ]}
          />
        )}
      </div>
      {statement && <StatementModal payee={statement} onClose={() => setStatement(null)} />}
      {payout && <CreatePayoutModal payee={payout} onClose={() => setPayout(null)} onDone={() => { setPayout(null); list.reload(); }} />}
      {adjust && <AdjustModal payee={adjust} onClose={() => setAdjust(null)} onDone={() => { setAdjust(null); list.reload(); }} />}
    </Panel>
  );
};

const ENTRY_LABEL: Record<string, string> = {
  gross_earning: "Sale (gross)",
  commission: "Tirvona commission",
  tax_on_commission: "GST on commission",
  tds: "TDS",
  refund_deduction: "Refund to customer",
  commission_reversal: "Commission returned",
  tax_reversal: "GST returned",
  tds_reversal: "TDS returned",
  referral_earning: "Referral earning",
  adjustment: "Adjustment",
  transfer: "Payout transfer",
};

const StatementModal: React.FC<{ payee: any; onClose: () => void }> = ({ payee, onClose }) => {
  const [page, setPage] = useState(1);
  const s = useRemote<any[]>(() => yatraFinance.payee(payee.payeeType, payee.payeeId, { page, limit: 20 }), [page]);
  return (
    <EnterpriseModal isOpen onClose={onClose} title={payee.name} subtitle={`${PAYEE_LABEL[payee.payeeType]} statement`}>
      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <p>Can be paid: <b>{rupees(payee.available)}</b></p>
        <p>Not yet delivered: <b>{rupees(payee.pending)}</b></p>
        <p>Commission: <b>{rupees(payee.commission)}</b></p>
        <p>TDS: <b>{rupees(payee.tds)}</b></p>
      </div>
      {s.state !== "ready" ? <PanelState state={s.state} error={s.error} onRetry={s.reload} /> : !s.data?.length ? <p className="text-xs text-gray-500">No entries yet.</p> : (
        <>
          <ul className="divide-y divide-gray-50 dark:divide-slate-800">
            {s.data.map((e) => (
              <li key={e.id} className="py-2 flex justify-between gap-3 text-xs">
                <div className="min-w-0"><p className="font-bold">{ENTRY_LABEL[e.entryType] ?? e.entryType}</p><p className="text-[10px] text-gray-500 truncate">{dateTimeIst(e.createdAt)} · {e.reference || e.description}</p></div>
                <span className={`font-black tabular-nums shrink-0 ${e.direction === "debit" ? "text-rose-600" : "text-emerald-600"}`}>{e.direction === "debit" ? "−" : "+"}{rupees(e.amount)}</span>
              </li>
            ))}
          </ul>
          <Pager page={page} limit={20} total={s.meta.total} onPage={setPage} />
        </>
      )}
    </EnterpriseModal>
  );
};

const CreatePayoutModal: React.FC<{ payee: any; onClose: () => void; onDone: () => void }> = ({ payee, onClose, onDone }) => {
  const [amount, setAmount] = useState(String(payee.requestable));
  const [note, setNote] = useState("");
  const { busy, run } = useAction();
  return (
    <EnterpriseModal isOpen onClose={onClose} title={`Payout for ${payee.name}`} subtitle={`Up to ${rupees(payee.requestable)} can be paid now`}>
      <form onSubmit={(e) => { e.preventDefault(); run("create", () => yatraFinance.createPayout({ payeeType: payee.payeeType, payeeId: payee.payeeId, amount: Number(amount), note: note || undefined }), onDone, "Payout created. Review and approve it in Payouts."); }} className="space-y-3">
        <Field label="Amount (₹)" required><input type="number" min={1} max={payee.requestable} step="0.01" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
        <Field label="Note"><input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><EnterpriseButton type="button" variant="ghost" onClick={onClose}>Close</EnterpriseButton><EnterpriseButton type="submit" disabled={busy === "create"}>Create payout</EnterpriseButton></div>
      </form>
    </EnterpriseModal>
  );
};

const AdjustModal: React.FC<{ payee: any; onClose: () => void; onDone: () => void }> = ({ payee, onClose, onDone }) => {
  const [f, setF] = useState({ direction: "credit", amount: "", reason: "" });
  const { busy, run } = useAction();
  return (
    <EnterpriseModal isOpen onClose={onClose} title={`Adjust ${payee.name}`} subtitle="Adds a ledger row with your reason. It is written to the audit log.">
      <form onSubmit={(e) => { e.preventDefault(); run("adjust", () => yatraFinance.adjust({ payeeType: payee.payeeType, payeeId: payee.payeeId, direction: f.direction, amount: Number(f.amount), reason: f.reason }), onDone, "Adjustment recorded."); }} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Type" required><select className={inputClass} value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value })}><option value="credit">Add to what Tirvona owes</option><option value="debit">Deduct from what Tirvona owes</option></select></Field>
        <Field label="Amount (₹)" required><input type="number" min={1} step="0.01" className={inputClass} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></Field>
        <Field label="Reason" required className="sm:col-span-2"><input className={inputClass} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} required minLength={5} /></Field>
        <div className="sm:col-span-2 flex justify-end gap-2"><EnterpriseButton type="button" variant="ghost" onClick={onClose}>Close</EnterpriseButton><EnterpriseButton type="submit" disabled={busy === "adjust"}>Record adjustment</EnterpriseButton></div>
      </form>
    </EnterpriseModal>
  );
};

// ================================================================== payouts
const Payouts: React.FC = () => {
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const list = useRemote<any[]>(() => yatraFinance.payouts({ status: status || undefined, page, limit: 20 }), [status, page]);
  const [transfer, setTransfer] = useState<any>(null);
  const [reconcile, setReconcile] = useState<any>(null);
  const { busy, run } = useAction();
  const review = (p: any, action: "start_review" | "approve" | "reject") => {
    const note = action === "reject" ? askReason("Why is this payout rejected? The payee will see it.") : "";
    if (note === null) return;
    if (action === "approve" && !window.confirm(`Approve ${rupees(p.amount)} for ${p.payeeName}? You will then make the transfer in the bank and record it here.`)) return;
    run(p.id, () => yatraFinance.reviewPayout(p.id, action, note || undefined), list.reload, action === "approve" ? "Approved. Make the bank transfer, then record it." : "Saved.");
  };
  return (
    <Panel>
      <div className="space-y-3">
        <Chips
          value={status}
          onChange={(v) => { setStatus(v); setPage(1); }}
          options={[{ value: "pending", label: "New" }, { value: "under_review", label: "Under review" }, { value: "approved", label: "Approved · to transfer" }, { value: "transfer_recorded", label: "To reconcile" }, { value: "reconciled", label: "Reconciled" }, { value: "rejected", label: "Rejected" }, { value: "cancelled", label: "Cancelled" }, { value: "", label: "All" }]}
        />
        <p className="text-[11px] text-gray-500">Tirvona never sends money from here. After approval, make the NEFT / RTGS / IMPS / UPI transfer from the bank, then record its UTR and proof. Only Finance can record a transfer.</p>
        {list.state !== "ready" ? <PanelState state={list.state} error={list.error} onRetry={list.reload} /> : !list.data?.length ? <Empty title="No payouts here" /> : (
          <>
            <ResponsiveTable
              rows={list.data}
              rowKey={(p) => p.id}
              columns={[
                { header: "Payout", cell: (p) => <div><p className="font-black">{p.payoutNumber}</p><p className="text-[10px] text-gray-500">{dateLong(p.createdAt)}</p></div> },
                { header: "Payee", cell: (p) => <div><p className="font-bold">{p.payeeName}</p><p className="text-[10px] text-gray-500">{PAYEE_LABEL[p.payeeType]}</p></div> },
                { header: "Amount", cell: (p) => <b className="tabular-nums">{rupees(p.amount)}</b> },
                { header: "Pay to", cell: (p) => <span className="text-[11px]">{p.bank ? p.bank.upiId || `${p.bank.bankName || "Bank"} ••${p.bank.accountNumberLast4} · ${p.bank.ifsc}` : "—"}</span>, hideOnMobile: true },
                { header: "Transfer", cell: (p) => (p.transfer ? <span className="text-[11px]">{p.transfer.method.toUpperCase()} {p.transfer.reference}{p.reconciliation?.difference ? <b className="text-rose-600"> · diff {rupees(p.reconciliation.difference)}</b> : ""}</span> : "—"), hideOnMobile: true },
                { header: "Status", cell: (p) => <StatusPill status={p.status} /> },
                {
                  header: "Actions",
                  cell: (p) => (
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {p.status === "pending" && <EnterpriseButton size="sm" variant="ghost" disabled={busy === p.id} onClick={() => review(p, "start_review")}>Start review</EnterpriseButton>}
                      {["pending", "under_review"].includes(p.status) && <EnterpriseButton size="sm" variant="success" disabled={busy === p.id} onClick={() => review(p, "approve")}>Approve</EnterpriseButton>}
                      {["pending", "under_review", "approved"].includes(p.status) && <EnterpriseButton size="sm" variant="ghost" disabled={busy === p.id} onClick={() => review(p, "reject")}>Reject</EnterpriseButton>}
                      {p.status === "approved" && <EnterpriseButton size="sm" disabled={busy === p.id} onClick={() => setTransfer(p)}>Record transfer</EnterpriseButton>}
                      {p.status === "transfer_recorded" && <EnterpriseButton size="sm" onClick={() => setReconcile(p)}>Reconcile</EnterpriseButton>}
                      {p.transfer?.hasProof && <EnterpriseButton size="sm" variant="ghost" icon={<Eye size={12} />} onClick={() => openSigned(yatraFinance.payoutProof(p.id))}>Proof</EnterpriseButton>}
                    </div>
                  ),
                },
              ]}
            />
            <Pager page={page} limit={20} total={list.meta.total} onPage={setPage} />
          </>
        )}
      </div>
      {transfer && <TransferModal payout={transfer} onClose={() => setTransfer(null)} onDone={() => { setTransfer(null); list.reload(); }} />}
      {reconcile && <ReconcileModal payout={reconcile} onClose={() => setReconcile(null)} onDone={() => { setReconcile(null); list.reload(); }} />}
    </Panel>
  );
};

const TransferModal: React.FC<{ payout: any; onClose: () => void; onDone: () => void }> = ({ payout, onClose, onDone }) => {
  const [f, setF] = useState({ method: "neft", transferDate: istToday(), reference: "", amount: String(payout.amount), note: "" });
  const [proof, setProof] = useState<File | null>(null);
  const { busy, run } = useAction();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = new FormData();
    Object.entries(f).forEach(([k, v]) => v && form.append(k, v));
    if (proof) form.append("proof", proof);
    run("transfer", () => yatraFinance.recordTransfer(payout.id, form), onDone, "Transfer recorded.");
  };
  return (
    <EnterpriseModal isOpen onClose={onClose} title={`Record transfer · ${payout.payoutNumber}`} subtitle={`${payout.payeeName} · ${rupees(payout.amount)}`}>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {payout.bank && <p className="sm:col-span-2 text-xs rounded-xl bg-gray-50 dark:bg-slate-800 p-2.5">Pay to: <b>{payout.bank.accountHolderName}</b> · {payout.bank.upiId || `${payout.bank.bankName || "Bank"} ••${payout.bank.accountNumberLast4} · ${payout.bank.ifsc}`}</p>}
        <Field label="Method" required><select className={inputClass} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{["neft", "rtgs", "imps", "upi", "bank_transfer"].map((m) => <option key={m} value={m}>{m === "bank_transfer" ? "Bank transfer" : m.toUpperCase()}</option>)}</select></Field>
        <Field label="Transfer date" required><input type="date" max={istToday()} className={inputClass} value={f.transferDate} onChange={(e) => setF({ ...f, transferDate: e.target.value })} required /></Field>
        <Field label="Bank reference (UTR)" required><input className={inputClass} value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value.toUpperCase() })} required minLength={6} maxLength={40} pattern="[A-Za-z0-9-]+" /></Field>
        <Field label="Amount sent (₹)" required hint="Must equal the approved amount"><input type="number" step="0.01" className={inputClass} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></Field>
        <Field label="Proof (bank screenshot or PDF)" className="sm:col-span-2" hint="Kept private; viewed through a short-lived signed link."><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className={inputClass} onChange={(e) => setProof(e.target.files?.[0] ?? null)} /></Field>
        <Field label="Note" className="sm:col-span-2"><input className={inputClass} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <div className="sm:col-span-2 flex justify-end gap-2"><EnterpriseButton type="button" variant="ghost" onClick={onClose}>Close</EnterpriseButton><EnterpriseButton type="submit" disabled={busy === "transfer"}>Record transfer</EnterpriseButton></div>
      </form>
    </EnterpriseModal>
  );
};

const ReconcileModal: React.FC<{ payout: any; onClose: () => void; onDone: () => void }> = ({ payout, onClose, onDone }) => {
  const [bankAmount, setBankAmount] = useState(String(payout.transfer?.amount ?? payout.amount));
  const [note, setNote] = useState("");
  const { busy, run } = useAction();
  const difference = Math.round((Number(bankAmount) - Number(payout.transfer?.amount ?? 0)) * 100) / 100;
  return (
    <EnterpriseModal isOpen onClose={onClose} title={`Reconcile ${payout.payoutNumber}`} subtitle={`UTR ${payout.transfer?.reference} · recorded ${rupees(payout.transfer?.amount)}`}>
      <form onSubmit={(e) => { e.preventDefault(); run("rec", () => yatraFinance.reconcilePayout(payout.id, { bankAmount: Number(bankAmount), note: note || undefined }), onDone, "Payout reconciled."); }} className="space-y-3">
        <Field label="Amount on the bank statement (₹)" required><input type="number" min={0} step="0.01" className={inputClass} value={bankAmount} onChange={(e) => setBankAmount(e.target.value)} required /></Field>
        {difference !== 0 && <p role="alert" className="text-xs font-semibold text-rose-600">Difference of {rupees(difference)}. Explain it below; it stays visible on the dashboard.</p>}
        <Field label="Note" required={difference !== 0}><input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} required={difference !== 0} minLength={difference !== 0 ? 3 : undefined} /></Field>
        <div className="flex justify-end gap-2"><EnterpriseButton type="button" variant="ghost" onClick={onClose}>Close</EnterpriseButton><EnterpriseButton type="submit" disabled={busy === "rec"}>Mark reconciled</EnterpriseButton></div>
      </form>
    </EnterpriseModal>
  );
};

// ==================================================================== rules
const Rules: React.FC = () => {
  const [status, setStatus] = useState("active");
  const rules = useRemote<any[]>(() => yatraFinance.rules({ status: status || undefined }), [status]);
  const awaiting = useRemote<any[]>(() => yatraFinance.awaitingRule(), []);
  const payees = useRemote<any[]>(() => yatraFinance.payees(), []);
  const [open, setOpen] = useState(false);
  const { busy, run } = useAction();
  const name = (r: any) => {
    const id = r.operatorId ?? r.ridePartnerId;
    if (!id) return r.appliesTo === "ride" ? "All ride partners" : "All partners";
    return payees.data?.find((p) => p.payeeId === id)?.name ?? "One payee";
  };
  return (
    <>
      {awaiting.state === "ready" && !!awaiting.data?.length && (
        <Panel title={`Bookings without a commission rule (${awaiting.data.length})`}>
          <p className="text-xs text-gray-500 mb-2">These were confirmed while no rule matched. Add the right rule below, then apply it to each booking; the partner earning is posted then.</p>
          <ResponsiveTable
            rows={awaiting.data}
            rowKey={(b: any) => b.id}
            columns={[
              { header: "Booking", cell: (b: any) => <span className="font-black">{b.bookingReference}</span> },
              { header: "Channel", cell: (b: any) => b.source },
              { header: "Paid", cell: (b: any) => rupees(b.amountPaid) },
              { header: "Departs", cell: (b: any) => (b.departAt ? dateLong(b.departAt) : "—"), hideOnMobile: true },
              { header: "", cell: (b: any) => <EnterpriseButton size="sm" disabled={busy === b.id} onClick={() => run(b.id, () => yatraFinance.applyRule(b.id), awaiting.reload, "Rule applied.")}>Apply current rule</EnterpriseButton> },
            ]}
          />
        </Panel>
      )}
      <Panel title="Commission rules" actions={<EnterpriseButton size="sm" onClick={() => setOpen(true)}>New rule or new version</EnterpriseButton>}>
        <div className="space-y-3">
          <p className="text-[11px] text-gray-500">Each booking, ride and add-on keeps the rule that applied when it was created. Saving a rule for the same scope creates a new version and retires the old one; past bookings do not change. The most specific rule wins (one partner or partner, then channel, then everyone).</p>
          <Chips value={status} onChange={setStatus} options={[{ value: "active", label: "Active" }, { value: "retired", label: "History" }, { value: "", label: "All" }]} />
          {rules.state !== "ready" ? <PanelState state={rules.state} error={rules.error} onRetry={rules.reload} /> : !rules.data?.length ? <Empty title="No rules yet" text="Until a rule exists, confirmed bookings wait in the list above and no commission is assumed." /> : (
            <ResponsiveTable
              rows={rules.data}
              rowKey={(r) => r.id}
              columns={[
                { header: "Applies to", cell: (r) => <div><p className="font-black">{APPLIES_LABEL[r.appliesTo]}</p><p className="text-[10px] text-gray-500">{r.name || `v${r.version}`}</p></div> },
                { header: "Who", cell: (r) => <span className="text-[11px]">{name(r)} · {CHANNEL_LABEL[r.channel] ?? r.channel}</span> },
                { header: "Commission", cell: (r) => <b>{pct(r.commissionBps)}{r.flatFee ? ` + ${rupees(r.flatFee)}` : ""}</b> },
                { header: "GST / TDS", cell: (r) => `${pct(r.taxOnCommissionBps)} / ${pct(r.tdsBps)}`, hideOnMobile: true },
                { header: "Version", cell: (r) => `v${r.version}`, hideOnMobile: true },
                { header: "Since", cell: (r) => dateLong(r.effectiveFrom), hideOnMobile: true },
                { header: "Status", cell: (r) => <StatusPill status={r.status} /> },
                { header: "", cell: (r) => (r.status === "active" ? <EnterpriseButton size="sm" variant="ghost" disabled={busy === r.id} onClick={() => { if (window.confirm("Retire this rule? New bookings in its scope fall back to a broader rule, or wait for one.")) run(r.id, () => yatraFinance.retireRule(r.id), rules.reload, "Rule retired."); }}>Retire</EnterpriseButton> : null) },
              ]}
            />
          )}
        </div>
      </Panel>
      {open && <RuleModal payees={payees.data ?? []} onClose={() => setOpen(false)} onDone={() => { setOpen(false); rules.reload(); awaiting.reload(); }} />}
    </>
  );
};

const RuleModal: React.FC<{ payees: any[]; onClose: () => void; onDone: () => void }> = ({ payees, onClose, onDone }) => {
  const [f, setF] = useState({ appliesTo: "yatra_booking", channel: "any", payeeId: "", name: "", commission: "", flatFee: "", gst: "18", tds: "", note: "" });
  const { busy, run } = useAction();
  const forRide = f.appliesTo === "ride";
  const choices = payees.filter((p) => p.payeeType === (forRide ? "ride_partner" : "operator"));
  const bps = (v: string) => Math.round(Number(v || 0) * 100);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(
      "rule",
      () =>
        yatraFinance.createRule({
          appliesTo: f.appliesTo,
          channel: f.appliesTo === "yatra_booking" ? f.channel : undefined,
          operatorId: !forRide && f.payeeId ? f.payeeId : undefined,
          ridePartnerId: forRide && f.payeeId ? f.payeeId : undefined,
          name: f.name || undefined,
          commissionBps: bps(f.commission),
          flatFee: f.flatFee ? Number(f.flatFee) : undefined,
          taxOnCommissionBps: bps(f.gst),
          tdsBps: bps(f.tds),
          note: f.note || undefined,
        }),
      onDone,
      "Rule saved. Existing bookings keep their own rule.",
    );
  };
  return (
    <EnterpriseModal isOpen onClose={onClose} title="Commission rule" subtitle="A new version replaces the active rule for the same scope from now on.">
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Applies to" required><select className={inputClass} value={f.appliesTo} onChange={(e) => setF({ ...f, appliesTo: e.target.value, payeeId: "" })}>{Object.entries(APPLIES_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        {f.appliesTo === "yatra_booking" ? (
          <Field label="Sales channel"><select className={inputClass} value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}>{Object.entries(CHANNEL_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        ) : <div className="hidden sm:block" />}
        {f.appliesTo !== "addon_referral" && (
          <Field label={forRide ? "Ride partner" : "Partner"} className="sm:col-span-2" hint="Leave as everyone for the default rule.">
            <select className={inputClass} value={f.payeeId} onChange={(e) => setF({ ...f, payeeId: e.target.value })}><option value="">Everyone</option>{choices.map((p) => <option key={p.payeeId} value={p.payeeId}>{p.name}</option>)}</select>
          </Field>
        )}
        <Field label="Commission (%)" required><input type="number" min={0} max={100} step="0.01" className={inputClass} value={f.commission} onChange={(e) => setF({ ...f, commission: e.target.value })} required /></Field>
        <Field label="Flat fee per booking (₹)"><input type="number" min={0} step="0.01" className={inputClass} value={f.flatFee} onChange={(e) => setF({ ...f, flatFee: e.target.value })} /></Field>
        <Field label="GST on commission (%)"><input type="number" min={0} max={100} step="0.01" className={inputClass} value={f.gst} onChange={(e) => setF({ ...f, gst: e.target.value })} /></Field>
        <Field label="TDS on gross (%)"><input type="number" min={0} max={100} step="0.01" className={inputClass} value={f.tds} onChange={(e) => setF({ ...f, tds: e.target.value })} /></Field>
        <Field label="Name"><input className={inputClass} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Pilot partners 2026" /></Field>
        <Field label="Note"><input className={inputClass} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <div className="sm:col-span-2 flex justify-end gap-2"><EnterpriseButton type="button" variant="ghost" onClick={onClose}>Close</EnterpriseButton><EnterpriseButton type="submit" disabled={busy === "rule"}>Save rule</EnterpriseButton></div>
      </form>
    </EnterpriseModal>
  );
};

// ================================================================= razorpay
const Razorpay: React.FC = () => {
  const runs = useRemote<any[]>(() => yatraFinance.reconciliationRuns(), []);
  const [day, setDay] = useState(daysAgo(2));
  const [detail, setDetail] = useState<any>(null);
  const { busy, run } = useAction();
  return (
    <Panel title="Razorpay settlement reconciliation">
      <div className="space-y-3">
        <p className="text-[11px] text-gray-500">Checks every Yatra payment captured on a day (India time) against Razorpay and its settlement report. This is separate from partner and ride partner payout reconciliation.</p>
        <div className="flex flex-wrap gap-3 items-end">
          <Field label="Day"><input type="date" max={istToday()} className={inputClass} value={day} onChange={(e) => setDay(e.target.value)} /></Field>
          <EnterpriseButton icon={<RefreshCw size={14} />} disabled={busy === "run" || !day} onClick={() => run("run", () => yatraFinance.runReconciliation(day), runs.reload, "Reconciliation finished.")}>Run for this day</EnterpriseButton>
        </div>
        {runs.state !== "ready" ? <PanelState state={runs.state} error={runs.error} onRetry={runs.reload} /> : !runs.data?.length ? <Empty title="No runs yet" /> : (
          <ResponsiveTable
            rows={runs.data}
            rowKey={(r) => r.id}
            onRowClick={(r) => setDetail(r)}
            columns={[
              { header: "Day", cell: (r) => <span className="font-black">{r.periodDate}</span> },
              { header: "Status", cell: (r) => <StatusPill status={r.status} /> },
              { header: "Collected", cell: (r) => rupees(r.collectedAmount) },
              { header: "Checked / matched", cell: (r) => `${r.checkedCount} / ${r.matchedCount}` },
              { header: "Settled", cell: (r) => `${r.settledCount} · ${rupees(r.settledAmount)}`, hideOnMobile: true },
              { header: "Mismatches", cell: (r) => <span className={r.mismatches.length ? "font-black text-rose-600" : ""}>{r.mismatches.length}</span> },
              { header: "Ran", cell: (r) => (r.ranAt ? dateTimeIst(r.ranAt) : "—"), hideOnMobile: true },
            ]}
          />
        )}
      </div>
      {detail && (
        <EnterpriseModal isOpen onClose={() => setDetail(null)} title={`Razorpay · ${detail.periodDate}`} subtitle={detail.note || undefined}>
          {!detail.mismatches.length ? <p className="text-xs text-gray-500">No mismatches.</p> : (
            <ul className="divide-y divide-gray-50 dark:divide-slate-800">
              {detail.mismatches.map((m: any) => (
                <li key={m.paymentId || m.orderId} className="py-2 text-xs"><p className="font-black break-all">{m.paymentId || m.orderId}</p><p className="text-gray-500">{rupees(m.amount)} · {m.issue}{m.unapplied ? " · returned to wallet" : ""}</p></li>
              ))}
            </ul>
          )}
        </EnterpriseModal>
      )}
    </Panel>
  );
};

// ================================================================== reports
const Reports: React.FC = () => {
  const [range, setRange] = useState({ from: daysAgo(30), to: istToday() });
  const report = useRemote<any[]>(() => yatraFinance.report(range.from, range.to), [range.from, range.to]);
  const [downloading, setDownloading] = useState(false);
  const download = async () => {
    setDownloading(true);
    try {
      const res = await yatraFinance.reportCsv(range.from, range.to);
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tirvona-yatra-finance-${range.from}-to-${range.to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("The report could not be downloaded.");
    } finally {
      setDownloading(false);
    }
  };
  const total = (k: string) => (report.data ?? []).reduce((t, r) => t + Number(r[k] ?? 0), 0);
  return (
    <Panel title="Date-wise report" actions={<EnterpriseButton size="sm" variant="outline" icon={<Download size={12} />} disabled={downloading} onClick={download}>Download CSV</EnterpriseButton>}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <Field label="From"><input type="date" className={inputClass} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></Field>
          <Field label="To"><input type="date" className={inputClass} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></Field>
        </div>
        {report.state !== "ready" ? <PanelState state={report.state} error={report.error} onRetry={report.reload} /> : !report.data?.length ? <Empty title="No money moved in this range" /> : (
          <>
            <ResponsiveTable
              rows={report.data}
              rowKey={(r) => r.date}
              columns={[
                { header: "Date", cell: (r) => <span className="font-black">{r.date}</span> },
                { header: "Collected", cell: (r) => rupees(r.collections) },
                { header: "Refunds", cell: (r) => rupees(r.refunds) },
                { header: "Commission", cell: (r) => rupees(r.commission) },
                { header: "GST", cell: (r) => rupees(r.gstOnCommission), hideOnMobile: true },
                { header: "Transfers", cell: (r) => rupees(r.transfers), hideOnMobile: true },
              ]}
            />
            <p className="text-xs font-bold">Totals · collected {rupees(total("collections"))} · refunds {rupees(total("refunds"))} · commission {rupees(total("commission"))} · transfers {rupees(total("transfers"))}</p>
          </>
        )}
      </div>
    </Panel>
  );
};
