import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CreditCard,
  Eye,
  IndianRupee,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useNotifications } from "../../contexts/NotificationContext";
import { getErrorMessage } from "../../lib/api";
import { payoutService } from "../../services";

type Ashram = { _id: string; name: string; ashramCode?: string };
type BankAccount = {
  accountHolderName: string;
  maskedAccountNumber: string;
  maskedIfsc: string;
  beneficiaryEmail?: string;
  beneficiaryPhone?: string;
  updatedAt: string;
};
type BankCoverage = { ashram: Ashram; bankAccount: BankAccount | null };
type Summary = {
  available: number;
  pending: { amount: number; count: number };
  processing: { amount: number; count: number };
  paid: { amount: number; count: number };
  failed: { amount: number; count: number };
};
type Payout = {
  _id: string;
  payoutReference: string;
  ashramId?: Ashram;
  ownerId?: { name?: string; email?: string };
  amount: number;
  mode: string;
  status: string;
  providerStatus?: string;
  providerPayoutId?: string;
  providerUtr?: string;
  failureReason?: string;
  beneficiary?: BankAccount | null;
  settlementMethod?: "razorpayx" | "manual_bank_transfer";
  createdAt: string;
};
type RevealedManualBank = {
  payoutId: string;
  payoutReference: string;
  amount: number;
  currency: string;
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
};

const emptySummary: Summary = {
  available: 0,
  pending: { amount: 0, count: 0 },
  processing: { amount: 0, count: 0 },
  paid: { amount: 0, count: 0 },
  failed: { amount: 0, count: 0 },
};
const money = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value || 0);
const label = (value: string) => value.replace(/_/g, " ").replace(/^./, (x) => x.toUpperCase());

export const PayoutManagementPage: React.FC = () => {
  const { user } = useAuth();
  const { confirmAction } = useNotifications();
  const isSuperAdmin = user?.role === "super_admin";
  const [ashrams, setAshrams] = useState<Ashram[]>([]);
  const [ashramId, setAshramId] = useState("");
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [bank, setBank] = useState<BankAccount | null>(null);
  const [bankCoverage, setBankCoverage] = useState<BankCoverage[]>([]);
  const [rows, setRows] = useState<Payout[]>([]);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [providerReady, setProviderReady] = useState<boolean | null>(null);
  const [manualRow, setManualRow] = useState<Payout | null>(null);
  const [revealReason, setRevealReason] = useState("");
  const [revealedBank, setRevealedBank] = useState<RevealedManualBank | null>(null);
  const [transferReference, setTransferReference] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [manualConfirmed, setManualConfirmed] = useState(false);
  const [form, setForm] = useState({
    accountHolderName: "",
    accountNumber: "",
    confirmAccountNumber: "",
    ifsc: "",
    beneficiaryEmail: "",
    beneficiaryPhone: "",
  });

  const selectedAshram = useMemo(
    () => ashrams.find((item) => item._id === ashramId),
    [ashrams, ashramId],
  );

  const loadAshrams = useCallback(async () => {
    const response = await payoutService.ashrams();
    const values = response.data?.success ? response.data.data || [] : [];
    setAshrams(values);
    setAshramId((current) =>
      current && values.some((item: Ashram) => item._id === current) ? current : "",
    );
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (ashramId) params.ashramId = ashramId;
      if (status) params.status = status;
      const [summaryResult, listResult, bankResult] = await Promise.allSettled([
        payoutService.summary(ashramId || undefined),
        payoutService.list(params),
        ashramId ? payoutService.bankAccount(ashramId) : payoutService.bankAccounts(),
      ]);
      if (summaryResult.status === "fulfilled")
        setSummary(summaryResult.value.data?.data || emptySummary);
      if (listResult.status === "fulfilled") {
        const data = listResult.value.data?.data;
        setRows(data?.rows || []);
        setPages(Math.max(1, data?.pages || 1));
      }
      if (bankResult.status === "fulfilled") {
        if (ashramId) {
          setBank(bankResult.value?.data?.data ?? null);
          setBankCoverage([]);
        } else {
          setBank(null);
          setBankCoverage(bankResult.value?.data?.data ?? []);
        }
      }
      const rejected = [summaryResult, listResult, bankResult].find(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      if (rejected) setError(getErrorMessage(rejected.reason, "Could not load payout data."));
    } finally {
      setLoading(false);
    }
  }, [ashramId, page, status]);

  useEffect(() => {
    void loadAshrams().catch((reason) => setError(getErrorMessage(reason, "Could not load ashrams.")));
  }, [loadAshrams]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!isSuperAdmin) return setProviderReady(null);
    void payoutService
      .providerStatus()
      .then((response) => setProviderReady(Boolean(response.data?.data?.ready)))
      .catch(() => setProviderReady(false));
  }, [isSuperAdmin]);

  const saveBank = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ashramId) return setError("Select an ashram first.");
    setWorking("bank");
    setError("");
    try {
      await payoutService.saveBankAccount(ashramId, {
        ...form,
        beneficiaryEmail: form.beneficiaryEmail || undefined,
        beneficiaryPhone: form.beneficiaryPhone || undefined,
      });
      setNotice("Bank account saved securely. Only masked details are displayed.");
      setForm({ accountHolderName: "", accountNumber: "", confirmAccountNumber: "", ifsc: "", beneficiaryEmail: "", beneficiaryPhone: "" });
      await load();
    } catch (reason) {
      setError(getErrorMessage(reason, "Could not save the bank account."));
    } finally {
      setWorking("");
    }
  };

  const requestPayout = async () => {
    if (!ashramId || summary.available <= 0) return;
    const confirmed = await confirmAction({
      title: "Request Payout",
      message: `Request the full available balance of ${money(summary.available)}?`,
      confirmLabel: "Request payout",
      tone: "primary",
    });
    if (!confirmed) return;
    setWorking("request");
    setError("");
    try {
      await payoutService.request({
        ashramId,
        amount: summary.available,
        clientRequestId: crypto.randomUUID(),
      });
      setNotice("Payout request created and the balance is reserved for processing.");
      await load();
    } catch (reason) {
      setError(getErrorMessage(reason, "Could not request the payout."));
    } finally {
      setWorking("");
    }
  };

  const payoutAction = async (row: Payout, action: "process" | "reconcile") => {
    if (action === "process") {
      const confirmed = await confirmAction({
        title: "Process RazorpayX Payout",
        message: `Send ${money(row.amount)} through RazorpayX?`,
        confirmLabel: "Send payout",
        tone: "warning",
      });
      if (!confirmed) return;
    }
    setWorking(row._id);
    setError("");
    try {
      if (action === "process") await payoutService.process(row._id);
      else await payoutService.reconcile(row._id);
      setNotice(action === "process" ? "Payout submitted safely." : "Payout status reconciled.");
      await load();
    } catch (reason) {
      setError(getErrorMessage(reason, "The payout action could not be completed."));
      await load();
    } finally {
      setWorking("");
    }
  };

  const closeManualPayment = () => {
    setManualRow(null);
    setRevealReason("");
    setRevealedBank(null);
    setTransferReference("");
    setManualNote("");
    setManualConfirmed(false);
  };

  const revealManualBankDetails = async () => {
    if (!manualRow || revealReason.trim().length < 5) return;
    setWorking(`reveal:${manualRow._id}`);
    setError("");
    try {
      const response = await payoutService.revealManualBankDetails(
        manualRow._id,
        revealReason.trim(),
      );
      setRevealedBank(response.data?.data ?? null);
    } catch (reason) {
      setError(getErrorMessage(reason, "Could not reveal beneficiary details."));
      closeManualPayment();
      await load();
    } finally {
      setWorking("");
    }
  };

  const recordManualPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!manualRow || !revealedBank || !manualConfirmed) return;
    const confirmed = await confirmAction({
      title: "Confirm Manual Transfer",
      message: `Confirm that ${money(manualRow.amount)} was transferred? This marks the payout as paid.`,
      confirmLabel: "Mark as paid",
      tone: "warning",
    });
    if (!confirmed) return;
    setWorking(`manual:${manualRow._id}`);
    setError("");
    try {
      await payoutService.recordManualPayment(manualRow._id, {
        transferReference,
        note: manualNote || undefined,
        clientRequestId: crypto.randomUUID(),
        confirmed: true,
      });
      setNotice("Manual bank transfer recorded. The payout and reserved commissions are now settled.");
      closeManualPayment();
      await load();
    } catch (reason) {
      setError(getErrorMessage(reason, "Could not record the manual payment."));
      closeManualPayment();
      await load();
    } finally {
      setWorking("");
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7fb] p-5 md:p-8 text-[#0B192C]">
      <section className="rounded-3xl border border-orange-200 bg-white p-6 mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-blue-50 p-3 text-[#0757b5]"><IndianRupee /></div>
          <div><h1 className="text-2xl font-black">Payout Management</h1><p className="text-sm text-slate-500">Secure ashram earnings, bank accounts and RazorpayX reconciliation.</p></div>
        </div>
        <div className="flex gap-2">
          <select value={ashramId} onChange={(event) => { setAshramId(event.target.value); setPage(1); }} className="rounded-xl border border-orange-200 bg-white px-4 py-2 text-sm font-bold">
            <option value="">All Ashrams</option>
            {ashrams.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
          </select>
          <button onClick={() => void load()} className="rounded-xl bg-[#0757b5] px-4 py-2 text-white flex items-center gap-2"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh</button>
        </div>
      </section>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
      {notice && <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-700">{notice}</div>}
      {isSuperAdmin && providerReady === false && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">RazorpayX payout processing is not configured. Requests remain pending; select an ashram to use the audited manual bank-transfer option.</div>}

      <div className="grid gap-4 md:grid-cols-4 mb-5">
        <Stat icon={<IndianRupee size={18} />} label="Available balance" value={money(summary.available)} />
        <Stat icon={<CreditCard size={18} />} label={`Pending (${summary.pending.count})`} value={money(summary.pending.amount)} />
        <Stat icon={<RefreshCw size={18} />} label={`Processing (${summary.processing.count})`} value={money(summary.processing.amount)} />
        <Stat icon={<ShieldCheck size={18} />} label={`Paid (${summary.paid.count})`} value={money(summary.paid.amount)} />
      </div>

      {ashramId && (
        <section className={`grid gap-5 mb-5 ${isSuperAdmin ? "" : "lg:grid-cols-[1fr_1.4fr]"}`}>
          <div className="rounded-3xl border border-orange-200 bg-white p-5">
            <h2 className="font-black flex items-center gap-2"><Building2 size={18} /> Beneficiary account</h2>
            <p className="text-xs text-slate-500 mt-1">{selectedAshram?.name}. The encrypted account is shared with your other authorized ashrams under the same legal owner.</p>
            {bank ? <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm"><b className="block">{bank.accountHolderName}</b><span>{bank.maskedAccountNumber} · {bank.maskedIfsc}</span><small className="block text-slate-500 mt-1">Updated {new Date(bank.updatedAt).toLocaleString("en-IN")}</small></div> : <p className="mt-4 text-sm text-amber-700">No payout bank account configured.</p>}
            {!isSuperAdmin && <button disabled={!bank || summary.available <= 0 || Boolean(working)} onClick={() => void requestPayout()} className="mt-4 w-full rounded-xl bg-[#0757b5] px-4 py-3 font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2"><Send size={16} /> Request full payout {summary.available > 0 ? money(summary.available) : ""}</button>}
          </div>
          {!isSuperAdmin && <form onSubmit={saveBank} className="rounded-3xl border border-orange-200 bg-white p-5">
            <h2 className="font-black">{bank ? "Replace bank account" : "Add bank account"}</h2>
            <p className="text-xs text-slate-500 mt-1">For security, enter all details again when replacing an account.</p>
            <div className="grid md:grid-cols-2 gap-3 mt-4">
              <Input label="Account holder" value={form.accountHolderName} onChange={(value) => setForm({ ...form, accountHolderName: value })} required />
              <Input label="Account number" value={form.accountNumber} onChange={(value) => setForm({ ...form, accountNumber: value.replace(/\D/g, "") })} required />
              <Input label="Confirm account number" value={form.confirmAccountNumber} onChange={(value) => setForm({ ...form, confirmAccountNumber: value.replace(/\D/g, "") })} required />
              <Input label="IFSC" value={form.ifsc} onChange={(value) => setForm({ ...form, ifsc: value.toUpperCase() })} required />
              <Input label="Beneficiary phone" value={form.beneficiaryPhone} onChange={(value) => setForm({ ...form, beneficiaryPhone: value })} />
              <Input label="Beneficiary email" type="email" value={form.beneficiaryEmail} onChange={(value) => setForm({ ...form, beneficiaryEmail: value })} />
            </div>
            <button disabled={working === "bank"} className="mt-4 rounded-xl border border-[#0757b5] px-5 py-2.5 font-bold text-[#0757b5] disabled:opacity-50">{working === "bank" ? "Saving securely…" : "Save secure bank account"}</button>
          </form>}
        </section>
      )}

      {!ashramId && (
        <section className="rounded-3xl border border-orange-200 bg-white p-5 mb-5">
          <div>
            <h2 className="font-black flex items-center gap-2"><Building2 size={18} /> All Ashrams payout coverage</h2>
            <p className="text-xs text-slate-500 mt-1">Read-only overview. Owners and admins must select one authorized ashram to create its payout request.</p>
          </div>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Ashram</th><th className="px-4 py-3">Account holder</th><th className="px-4 py-3">Bank account</th><th className="px-4 py-3">Status</th></tr></thead>
              <tbody>{bankCoverage.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-slate-400">No authorized ashrams found.</td></tr> : bankCoverage.map((item) => <tr key={item.ashram._id} className="border-t border-slate-100"><td className="px-4 py-3 font-bold">{item.ashram.name}</td><td className="px-4 py-3">{item.bankAccount?.accountHolderName || "—"}</td><td className="px-4 py-3">{item.bankAccount ? `${item.bankAccount.maskedAccountNumber} · ${item.bankAccount.maskedIfsc}` : "Not configured"}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${item.bankAccount ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{item.bankAccount ? "Ready" : "Account required"}</span></td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-orange-200 bg-white overflow-hidden">
        <div className="p-4 border-b border-orange-100 flex justify-between gap-3">
          <div><h2 className="font-black">{isSuperAdmin ? "Payout requests and approvals" : "Payout history"}</h2><p className="mt-1 text-xs text-slate-500">{isSuperAdmin ? "Review pending requests and release each approved amount through RazorpayX." : "Submitted requests remain pending until an authorized Super Admin processes them."}</p></div>
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="rounded-xl border border-orange-200 px-3 py-2 text-sm font-bold"><option value="">All statuses</option>{["pending", "processing", "paid", "failed"].map((item) => <option key={item} value={item}>{label(item)}</option>)}</select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>{["Reference", "Ashram", "Owner", "Beneficiary", "Amount", "Mode", "Status", "Provider", "Created", "Action"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={10} className="p-12 text-center text-slate-400">Loading payouts…</td></tr> : rows.length === 0 ? <tr><td colSpan={10} className="p-12 text-center text-slate-400">No payout records found.</td></tr> : rows.map((row) => (
                <tr key={row._id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-bold">{row.payoutReference}</td>
                  <td className="px-4 py-3">{row.ashramId?.name || "—"}</td>
                  <td className="px-4 py-3">{row.ownerId?.name || row.ownerId?.email || "—"}</td>
                  <td className="px-4 py-3">{row.beneficiary ? <><b className="block">{row.beneficiary.accountHolderName}</b><span className="block text-xs text-slate-500">{row.beneficiary.maskedAccountNumber} · {row.beneficiary.maskedIfsc}</span>{row.beneficiary.beneficiaryEmail && <span className="block text-xs text-slate-400">{row.beneficiary.beneficiaryEmail}</span>}{row.beneficiary.beneficiaryPhone && <span className="block text-xs text-slate-400">{row.beneficiary.beneficiaryPhone}</span>}</> : "—"}</td>
                  <td className="px-4 py-3 font-bold">{money(row.amount)}</td>
                  <td className="px-4 py-3">{row.mode}</td>
                  <td className="px-4 py-3"><Badge status={row.status} /></td>
                  <td className="px-4 py-3">{row.providerStatus || "—"}{row.providerUtr && <small className="block text-slate-400">UTR {row.providerUtr}</small>}</td>
                  <td className="px-4 py-3">{new Date(row.createdAt).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3">
                    {isSuperAdmin && row.status === "pending" ? <div className="flex min-w-[170px] flex-col gap-2">
                      <button disabled={working === row._id || providerReady !== true} title={providerReady === false ? "Configure RazorpayX payouts in the backend first" : undefined} onClick={() => void payoutAction(row, "process")} className="rounded-lg bg-[#0757b5] px-3 py-2 font-bold text-white disabled:opacity-50">{working === row._id ? "Processing..." : "Pay via RazorpayX"}</button>
                      <button disabled={!ashramId || Boolean(working)} title={!ashramId ? "Select this ashram from the page filter first" : "Reveal audited bank details and record an external transfer"} onClick={() => { setManualRow(row); setRevealReason(""); setRevealedBank(null); setTransferReference(""); setManualNote(""); setManualConfirmed(false); }} className="rounded-lg border border-[#0757b5] px-3 py-2 font-bold text-[#0757b5] disabled:opacity-40"><Eye size={14} className="mr-1 inline" /> Manual bank transfer</button>
                    </div> : isSuperAdmin && row.status === "processing" ? <button disabled={working === row._id || providerReady !== true} onClick={() => void payoutAction(row, row.providerPayoutId ? "reconcile" : "process")} className="font-bold text-[#0757b5] disabled:opacity-50">{row.providerPayoutId ? "Fetch status" : "Retry safely"}</button> : !isSuperAdmin && row.status === "pending" ? <span className="text-xs font-bold text-amber-700">Awaiting Super Admin</span> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-100 flex justify-end items-center gap-3"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-1 disabled:opacity-40">Previous</button><b>Page {page} of {pages}</b><button disabled={page >= pages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-1 disabled:opacity-40">Next</button></div>
      </section>

      {manualRow && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="manual-payout-title">
        <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div><h2 id="manual-payout-title" className="text-xl font-black">Manual bank transfer</h2><p className="mt-1 text-sm text-slate-500">{manualRow.payoutReference} · {manualRow.ashramId?.name} · {money(manualRow.amount)}</p></div>
            <button type="button" onClick={closeManualPayment} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close manual payment"><X size={18} /></button>
          </div>

          {!revealedBank ? <div className="mt-5">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Revealing full bank details is restricted to Super Admin and creates a permanent audit record. Use the details only for this payout.</div>
            <label className="mt-4 block text-sm font-bold text-slate-700">Reason for revealing bank details
              <textarea value={revealReason} onChange={(event) => setRevealReason(event.target.value)} maxLength={200} rows={3} className="mt-2 block w-full rounded-xl border border-orange-200 p-3 font-normal text-slate-900" placeholder="Example: Processing approved manual bank transfer" />
            </label>
            <button type="button" disabled={revealReason.trim().length < 5 || working === `reveal:${manualRow._id}`} onClick={() => void revealManualBankDetails()} className="mt-4 rounded-xl bg-[#0757b5] px-5 py-3 font-bold text-white disabled:opacity-40"><Eye size={16} className="mr-2 inline" />{working === `reveal:${manualRow._id}` ? "Revealing securely..." : "Reveal beneficiary bank details"}</button>
          </div> : <form onSubmit={recordManualPayment} className="mt-5">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Account holder</p><p className="font-black">{revealedBank.accountHolderName}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2"><div><p className="text-xs font-bold uppercase text-slate-500">Account number</p><p className="select-all font-mono text-lg font-black">{revealedBank.accountNumber}</p></div><div><p className="text-xs font-bold uppercase text-slate-500">IFSC</p><p className="select-all font-mono text-lg font-black">{revealedBank.ifsc}</p></div></div>
              <p className="mt-3 text-xs text-red-700">Do not copy these details into chat, email, logs, screenshots, or notes.</p>
            </div>
            <div className="mt-4 grid gap-4">
              <Input label="Bank transfer reference / UTR" value={transferReference} onChange={(value) => setTransferReference(value.toUpperCase().replace(/[^A-Z0-9/_-]/g, ""))} required />
              <label className="text-xs font-bold text-slate-600">Internal note (optional)<textarea value={manualNote} onChange={(event) => setManualNote(event.target.value)} maxLength={500} rows={3} className="mt-1 block w-full rounded-xl border border-orange-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
              <label className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800"><input type="checkbox" checked={manualConfirmed} onChange={(event) => setManualConfirmed(event.target.checked)} className="mt-1" />I confirm the exact amount of {money(manualRow.amount)} has already been transferred to the beneficiary account shown above.</label>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-3"><button type="button" onClick={closeManualPayment} className="rounded-xl border px-5 py-3 font-bold">Cancel</button><button disabled={!manualConfirmed || transferReference.length < 6 || working === `manual:${manualRow._id}`} className="rounded-xl bg-green-700 px-5 py-3 font-bold text-white disabled:opacity-40">{working === `manual:${manualRow._id}` ? "Recording payment..." : "Confirm and mark paid"}</button></div>
          </form>}
        </div>
      </div>}
    </div>
  );
};

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => <div className="rounded-2xl border border-orange-200 bg-white p-4"><div className="text-[#0757b5]">{icon}</div><small className="block mt-2 text-slate-500">{label}</small><b className="text-xl">{value}</b></div>;
const Input = ({ label, value, onChange, required, type = "text" }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) => <label className="text-xs font-bold text-slate-600">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} autoComplete="off" className="mt-1 block w-full rounded-xl border border-orange-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>;
const Badge = ({ status }: { status: string }) => <span className={`rounded-full px-2.5 py-1 text-xs font-black ${status === "paid" ? "bg-green-100 text-green-700" : status === "failed" ? "bg-red-100 text-red-700" : status === "processing" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>{label(status)}</span>;

export default PayoutManagementPage;
