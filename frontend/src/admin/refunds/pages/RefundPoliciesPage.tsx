import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ashramService, refundPolicyService } from "../../../services";
import { getErrorMessage } from "../../../lib/api";
import { useNotifications } from "../../../contexts/NotificationContext";
import { formatCurrency } from "../../../utils/format";
import { humanizeLabel } from "../../../utils/labels";
import {
  EnterpriseButton,
  EnterpriseModal,
  EnterprisePageHeader,
} from "../../shared";
import { REFUND_MODULES } from "../refund.types";
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Plus,
  RefreshCw,
  ScrollText,
  Trash2,
  X,
} from "lucide-react";

interface Window {
  label: string;
  hoursBefore: number;
  refundPercent: number;
}

interface Policy {
  _id?: string;
  name: string;
  description?: string;
  module: string;
  ashramId?: string | null;
  isActive?: boolean;
  priority?: number;
  cancellationWindows?: Window[];
  defaultRefundPercent?: number;
  processingFee?: { type?: string; value?: number; maxAmount?: number };
  refundPlatformFee?: boolean;
  refundGst?: boolean;
  refundAddOns?: boolean;
  refundDonation?: boolean;
  autoApproveBelow?: number;
  requiresSecondApprovalAbove?: number;
  claimWindowHours?: number;
}

const BLANK: Policy = {
  name: "",
  description: "",
  module: "global",
  ashramId: null,
  isActive: true,
  priority: 0,
  cancellationWindows: [
    { label: "72 hours or more", hoursBefore: 72, refundPercent: 100 },
    { label: "24 hours or more", hoursBefore: 24, refundPercent: 50 },
  ],
  defaultRefundPercent: 0,
  processingFee: { type: "none", value: 0, maxAmount: 0 },
  refundPlatformFee: false,
  refundGst: false,
  refundAddOns: true,
  refundDonation: false,
  autoApproveBelow: 0,
  requiresSecondApprovalAbove: 0,
  claimWindowHours: 0,
};

const Toggle: React.FC<{
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, hint, checked, disabled, onChange }) => (
  <label
    className={`flex items-start gap-2.5 p-3 rounded-2xl border transition-colors ${
      disabled
        ? "border-gray-100 dark:border-slate-800 opacity-55 cursor-not-allowed"
        : "border-gray-200 dark:border-slate-700 hover:border-[#0A4DA6]/50 cursor-pointer"
    }`}
  >
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-0.5 accent-[#0A4DA6]"
    />
    <span className="min-w-0">
      <span className="block text-xs font-bold text-[#0B192C] dark:text-white">
        {label}
      </span>
      {hint && (
        <span className="block text-[10px] text-gray-500 leading-relaxed">
          {hint}
        </span>
      )}
    </span>
  </label>
);

const Field: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, hint, children }) => (
  <div className="space-y-1">
    <label className="text-[11px] font-black text-gray-500 block">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
  </div>
);

const inputClass =
  "w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6]";

export const RefundPoliciesPage: React.FC = () => {
  const navigate = useNavigate();
  const { addNotification } = useNotifications();

  const [policies, setPolicies] = useState<Policy[]>([]);
  const [ashrams, setAshrams] = useState<{ _id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Policy | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Policy | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await refundPolicyService.list();
      setPolicies(res.data?.data ?? []);
      setError("");
    } catch (err) {
      setPolicies([]);
      setError(getErrorMessage(err, "Refund policies could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Ashram list powers the property-scoped option; a failure just means that
    // scope is unavailable, not that the page is broken.
    ashramService
      .search({ limit: "100" })
      .then((res) => setAshrams(res.data?.data ?? []))
      .catch(() => setAshrams([]));
  }, [load]);

  const set = (patch: Partial<Policy>) =>
    setDraft((current) => (current ? { ...current, ...patch } : current));

  const setWindow = (index: number, patch: Partial<Window>) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            cancellationWindows: (current.cancellationWindows ?? []).map((w, i) =>
              i === index ? { ...w, ...patch } : w,
            ),
          }
        : current,
    );

  /**
   * GST can only be refunded alongside the platform fee it was charged on —
   * the server rejects the other combination outright, so the form makes it
   * unreachable rather than letting an operator hit a 400.
   */
  const setPlatformFee = (value: boolean) =>
    set({ refundPlatformFee: value, ...(value ? {} : { refundGst: false }) });

  const valid =
    draft !== null &&
    draft.name.trim().length >= 2 &&
    (draft.cancellationWindows ?? []).every(
      (w) => w.refundPercent >= 0 && w.refundPercent <= 100 && w.hoursBefore >= 0,
    ) &&
    new Set((draft.cancellationWindows ?? []).map((w) => w.hoursBefore)).size ===
      (draft.cancellationWindows ?? []).length;

  const save = async () => {
    if (!draft || !valid) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      ...draft,
      ashramId: draft.ashramId || undefined,
    };
    delete payload._id;
    try {
      if (draft._id) await refundPolicyService.update(draft._id, payload);
      else await refundPolicyService.create(payload);
      addNotification(
        draft._id ? "Policy updated" : "Policy created",
        `${draft.name} saved.`,
        "success",
      );
      setDraft(null);
      await load();
    } catch (err) {
      addNotification(
        "Policy not saved",
        getErrorMessage(err, "Check the rules and try again."),
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget?._id) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    // Optimistic: the row disappears, and returns if the server refuses.
    const previous = policies;
    setPolicies((current) => current.filter((p) => p._id !== target._id));
    try {
      await refundPolicyService.remove(target._id!);
      addNotification("Policy removed", `${target.name} deactivated.`, "info");
    } catch (err) {
      setPolicies(previous);
      addNotification(
        "Could not remove",
        getErrorMessage(err, "Please try again."),
        "error",
      );
    }
  };

  return (
    <div className="space-y-6 text-left">
      <EnterprisePageHeader
        title="Refund policies"
        subtitle="Global, module and property rules that price every refund"
        icon={<ScrollText size={20} />}
        badgeText={`${policies.length} configured`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <EnterpriseButton
              variant="ghost"
              size="sm"
              icon={<ArrowLeft size={14} />}
              onClick={() => navigate("/admin/refunds")}
            >
              Queue
            </EnterpriseButton>
            <EnterpriseButton
              variant="outline"
              size="sm"
              icon={<RefreshCw size={14} />}
              onClick={load}
            >
              Refresh
            </EnterpriseButton>
            <EnterpriseButton
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => setDraft({ ...BLANK })}
            >
              New policy
            </EnterpriseButton>
          </div>
        }
      />

      <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-2xl p-4 text-[11px] text-[#0B192C] dark:text-blue-200 leading-relaxed">
        <strong className="font-black">How a policy is chosen:</strong> the most
        specific match wins — a property rule beats a module rule, which beats
        the global one. Within the same scope the higher priority wins. Exactly
        one policy prices a refund, and it is snapshotted onto the calculation,
        so editing a policy never changes a refund that already settled.
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-500/10 dark:border-rose-500/30 px-4 py-3">
          <AlertTriangle size={16} className="text-rose-600 mt-0.5 shrink-0" />
          <p className="text-xs text-rose-800 dark:text-rose-300">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-32 rounded-[28px] bg-gray-100 dark:bg-slate-900 animate-pulse"
            />
          ))}
        </div>
      ) : policies.length === 0 ? (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] py-16 text-center space-y-3">
          <ScrollText size={30} className="mx-auto text-gray-300" />
          <p className="text-sm font-bold text-[#0B192C] dark:text-white">
            No refund policy configured
          </p>
          <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
            Until one exists the platform uses a conservative built-in default:
            100% at 72h, 75% at 48h, 50% at 24h, with the platform fee, GST and
            donations retained.
          </p>
          <EnterpriseButton
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => setDraft({ ...BLANK })}
          >
            Create the first policy
          </EnterpriseButton>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {policies.map((policy) => (
            <div
              key={policy._id}
              className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-5 shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-[#0B192C] dark:text-white truncate">
                    {policy.name}
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    {humanizeLabel(policy.module)}
                    {policy.ashramId ? " · property-scoped" : ""} · priority{" "}
                    {policy.priority ?? 0}
                  </p>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border shrink-0 ${
                    policy.isActive === false
                      ? "bg-gray-100 text-gray-500 border-gray-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300"
                  }`}
                >
                  {policy.isActive === false ? "Inactive" : "Active"}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(policy.cancellationWindows ?? []).map((w, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#0A4DA6] dark:text-blue-300 text-[10px] font-black"
                  >
                    {w.hoursBefore}h → {w.refundPercent}%
                  </span>
                ))}
                <span className="px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 text-[10px] font-black">
                  else {policy.defaultRefundPercent ?? 0}%
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                {[
                  ["Add-ons", policy.refundAddOns !== false],
                  ["Donation", policy.refundDonation === true],
                  ["Platform fee", policy.refundPlatformFee === true],
                  ["GST", policy.refundGst === true],
                ].map(([label, on]) => (
                  <div key={String(label)} className="flex justify-between gap-2">
                    <dt className="text-gray-500">{label as string}</dt>
                    <dd
                      className={`font-bold ${on ? "text-emerald-600" : "text-gray-400"}`}
                    >
                      {on ? "Refunded" : "Retained"}
                    </dd>
                  </div>
                ))}
                {policy.processingFee?.type &&
                  policy.processingFee.type !== "none" && (
                    <div className="flex justify-between gap-2 col-span-2">
                      <dt className="text-gray-500">Processing fee</dt>
                      <dd className="font-bold text-[#0B192C] dark:text-white">
                        {policy.processingFee.type === "percent"
                          ? `${policy.processingFee.value}%`
                          : formatCurrency(policy.processingFee.value ?? 0)}
                      </dd>
                    </div>
                  )}
                {(policy.autoApproveBelow ?? 0) > 0 && (
                  <div className="flex justify-between gap-2 col-span-2">
                    <dt className="text-gray-500">Auto-approve below</dt>
                    <dd className="font-bold text-[#0B192C] dark:text-white">
                      {formatCurrency(policy.autoApproveBelow ?? 0)}
                    </dd>
                  </div>
                )}
                {(policy.requiresSecondApprovalAbove ?? 0) > 0 && (
                  <div className="flex justify-between gap-2 col-span-2">
                    <dt className="text-gray-500">Second approver above</dt>
                    <dd className="font-bold text-[#0B192C] dark:text-white">
                      {formatCurrency(policy.requiresSecondApprovalAbove ?? 0)}
                    </dd>
                  </div>
                )}
              </dl>

              <div className="flex items-center gap-2 pt-1">
                <EnterpriseButton
                  size="sm"
                  variant="outline"
                  onClick={() => setDraft({ ...BLANK, ...policy })}
                >
                  Edit
                </EnterpriseButton>
                <EnterpriseButton
                  size="sm"
                  variant="danger"
                  icon={<Trash2 size={13} />}
                  onClick={() => setDeleteTarget(policy)}
                >
                  Remove
                </EnterpriseButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor */}
      <EnterpriseModal
        isOpen={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?._id ? "Edit refund policy" : "New refund policy"}
        subtitle="Rules are applied at the moment a refund is raised"
        icon={<ScrollText size={18} />}
        maxWidth="2xl"
        footer={
          <div className="flex justify-end gap-2">
            <EnterpriseButton variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </EnterpriseButton>
            <EnterpriseButton
              variant="primary"
              disabled={!valid || saving}
              icon={saving ? <Loader2 size={14} className="animate-spin" /> : undefined}
              onClick={save}
            >
              {draft?._id ? "Save changes" : "Create policy"}
            </EnterpriseButton>
          </div>
        }
      >
        {draft && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Policy name">
                <input
                  value={draft.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder="Ashram standard cancellation"
                  className={inputClass}
                />
              </Field>
              <Field label="Applies to">
                <select
                  value={draft.module}
                  onChange={(e) => set({ module: e.target.value })}
                  className={`${inputClass} cursor-pointer`}
                >
                  <option value="global">Global — every module</option>
                  {REFUND_MODULES.map((m) => (
                    <option key={m} value={m}>
                      {humanizeLabel(m)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Property scope"
                hint="Optional. A property rule overrides the module rule."
              >
                <select
                  value={draft.ashramId ?? ""}
                  onChange={(e) => set({ ashramId: e.target.value || null })}
                  disabled={draft.module === "global"}
                  className={`${inputClass} cursor-pointer disabled:opacity-50`}
                >
                  <option value="">All properties</option>
                  {ashrams.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Priority" hint="Higher wins within the same scope.">
                <input
                  type="number"
                  min={0}
                  value={draft.priority ?? 0}
                  onChange={(e) => set({ priority: Number(e.target.value) })}
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-[#0B192C] dark:text-white">
                  Cancellation windows
                </h4>
                <EnterpriseButton
                  size="sm"
                  variant="outline"
                  icon={<Plus size={12} />}
                  onClick={() =>
                    set({
                      cancellationWindows: [
                        ...(draft.cancellationWindows ?? []),
                        { label: "", hoursBefore: 0, refundPercent: 0 },
                      ],
                    })
                  }
                >
                  Add
                </EnterpriseButton>
              </div>
              <p className="text-[10px] text-gray-400">
                The most generous window the request qualifies for is applied.
                Each threshold must be unique.
              </p>
              <div className="space-y-2">
                {(draft.cancellationWindows ?? []).map((w, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <div className="flex-1">
                      <Field label="Label">
                        <input
                          value={w.label}
                          onChange={(e) => setWindow(i, { label: e.target.value })}
                          placeholder="72 hours or more"
                          className={inputClass}
                        />
                      </Field>
                    </div>
                    <div className="w-28">
                      <Field label="Hours before">
                        <input
                          type="number"
                          min={0}
                          value={w.hoursBefore}
                          onChange={(e) =>
                            setWindow(i, { hoursBefore: Number(e.target.value) })
                          }
                          className={inputClass}
                        />
                      </Field>
                    </div>
                    <div className="w-24">
                      <Field label="Refund %">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={w.refundPercent}
                          onChange={(e) =>
                            setWindow(i, { refundPercent: Number(e.target.value) })
                          }
                          className={inputClass}
                        />
                      </Field>
                    </div>
                    <button
                      onClick={() =>
                        set({
                          cancellationWindows: (draft.cancellationWindows ?? []).filter(
                            (_, index) => index !== i,
                          ),
                        })
                      }
                      aria-label="Remove window"
                      className="p-2 mb-0.5 text-gray-400 hover:text-rose-500 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <Field
                label="Outside every window"
                hint="Applied when no window matches."
              >
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={draft.defaultRefundPercent ?? 0}
                  onChange={(e) =>
                    set({ defaultRefundPercent: Number(e.target.value) })
                  }
                  className={`${inputClass} max-w-[140px]`}
                />
              </Field>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-black text-[#0B192C] dark:text-white">
                What comes back
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Toggle
                  label="Add-on services"
                  hint="Meals, prasad, locker and parking extras."
                  checked={draft.refundAddOns !== false}
                  onChange={(v) => set({ refundAddOns: v })}
                />
                <Toggle
                  label="Donation"
                  hint="Voluntary contributions to the trust."
                  checked={draft.refundDonation === true}
                  onChange={(v) => set({ refundDonation: v })}
                />
                <Toggle
                  label="Platform fee"
                  hint="Tirvona's own service charge."
                  checked={draft.refundPlatformFee === true}
                  onChange={setPlatformFee}
                />
                <Toggle
                  label="GST on the platform fee"
                  hint={
                    draft.refundPlatformFee
                      ? "Returned with the fee it was charged on."
                      : "Unavailable — GST can only be refunded with the platform fee."
                  }
                  checked={draft.refundGst === true}
                  disabled={draft.refundPlatformFee !== true}
                  onChange={(v) => set({ refundGst: v })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-black text-[#0B192C] dark:text-white">
                Processing fee
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Type">
                  <select
                    value={draft.processingFee?.type ?? "none"}
                    onChange={(e) =>
                      set({
                        processingFee: {
                          ...draft.processingFee,
                          type: e.target.value,
                        },
                      })
                    }
                    className={`${inputClass} cursor-pointer`}
                  >
                    <option value="none">No fee</option>
                    <option value="flat">Flat amount</option>
                    <option value="percent">Percentage</option>
                  </select>
                </Field>
                <Field label="Value">
                  <input
                    type="number"
                    min={0}
                    disabled={(draft.processingFee?.type ?? "none") === "none"}
                    value={draft.processingFee?.value ?? 0}
                    onChange={(e) =>
                      set({
                        processingFee: {
                          ...draft.processingFee,
                          value: Number(e.target.value),
                        },
                      })
                    }
                    className={`${inputClass} disabled:opacity-50`}
                  />
                </Field>
                <Field label="Cap (₹)" hint="0 means no cap.">
                  <input
                    type="number"
                    min={0}
                    disabled={draft.processingFee?.type !== "percent"}
                    value={draft.processingFee?.maxAmount ?? 0}
                    onChange={(e) =>
                      set({
                        processingFee: {
                          ...draft.processingFee,
                          maxAmount: Number(e.target.value),
                        },
                      })
                    }
                    className={`${inputClass} disabled:opacity-50`}
                  />
                </Field>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-black text-[#0B192C] dark:text-white">
                Approval
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field
                  label="Auto-approve below (₹)"
                  hint="0 keeps every claim manual."
                >
                  <input
                    type="number"
                    min={0}
                    value={draft.autoApproveBelow ?? 0}
                    onChange={(e) =>
                      set({ autoApproveBelow: Number(e.target.value) })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field
                  label="Second approver above (₹)"
                  hint="0 disables dual approval."
                >
                  <input
                    type="number"
                    min={0}
                    value={draft.requiresSecondApprovalAbove ?? 0}
                    onChange={(e) =>
                      set({
                        requiresSecondApprovalAbove: Number(e.target.value),
                      })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field
                  label="Claim window (hours)"
                  hint="Hours after the service date a claim is still accepted. 0 = no limit."
                >
                  <input
                    type="number"
                    min={0}
                    value={draft.claimWindowHours ?? 0}
                    onChange={(e) =>
                      set({ claimWindowHours: Number(e.target.value) })
                    }
                    className={inputClass}
                  />
                </Field>
              </div>
              <Toggle
                label="Policy is active"
                hint="Inactive policies are never selected."
                checked={draft.isActive !== false}
                onChange={(v) => set({ isActive: v })}
              />
            </div>

            {!valid && draft.name.trim().length >= 2 && (
              <p className="text-[11px] text-amber-700 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 rounded-xl px-3 py-2">
                Two windows share the same threshold, or a percentage is outside
                0–100. The server rejects both.
              </p>
            )}
          </div>
        )}
      </EnterpriseModal>

      <EnterpriseModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Remove policy"
        subtitle={deleteTarget?.name}
        icon={<Trash2 size={18} />}
        footer={
          <div className="flex justify-end gap-2">
            <EnterpriseButton variant="ghost" onClick={() => setDeleteTarget(null)}>
              Keep
            </EnterpriseButton>
            <EnterpriseButton variant="danger" onClick={remove}>
              Remove policy
            </EnterpriseButton>
          </div>
        }
      >
        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
          The policy is deactivated, not erased — refunds already priced by it
          keep their snapshot, so historic calculations stay explainable. New
          refunds will fall through to the next matching policy.
        </p>
      </EnterpriseModal>
    </div>
  );
};

export default RefundPoliciesPage;
