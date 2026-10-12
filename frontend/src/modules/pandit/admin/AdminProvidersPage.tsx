import React, { useCallback, useEffect, useState } from "react";
import { Eye, RefreshCw, Search, ShieldCheck, UserPlus, Users } from "lucide-react";
import { providerAdminService } from "../services/provider.service";
import { getErrorMessage } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import type { ProviderProfile } from "../types/provider.types";
import { PROVIDER_TYPE_LABELS, VERIFICATION_LEVEL_LABELS } from "../types/provider.types";
import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorNotice,
  Field,
  Modal,
  Notice,
  PageContainer,
  PageHeader,
  Pagination,
  Skeleton,
  StatusBadge,
  cx,
  inputClass,
  type Column,
} from "../ui";

const PAGE_SIZE = 20;

/** The only reason codes the server accepts for suspending or reinstating a provider. */
const ACTION_REASONS: Array<[string, string]> = [
  ["COMPLIANCE_VIOLATION", "Violation of Tirvona's provider code"],
  ["FEAR_BASED_SELLING", "Fear-based selling of services"],
  ["OUTCOME_GUARANTEE_CLAIM", "Guaranteeing outcomes"],
  ["FRAUD_SUSPECTED", "Fraud suspected"],
  ["CUSTOMER_SAFETY", "Customer safety concern"],
  ["VERIFICATION_LAPSED", "Verification lapsed"],
  ["OTHER", "Other"],
];

const LANGUAGES = ["Sanskrit", "Hindi", "English", "Tamil", "Telugu", "Kannada", "Malayalam", "Bengali", "Marathi", "Gujarati", "Punjabi", "Odia"];
const PHONE = /^\+?[0-9][0-9\s-]{6,17}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ProviderRow = ProviderProfile & { activeOfferingCount?: number; isPubliclyListed?: boolean };

interface CreateForm {
  name: string;
  type: string;
  phone: string;
  email: string;
  password: string;
  city: string;
  state: string;
  experience: string;
  traditions: string;
  languages: string[];
  bio: string;
}
const EMPTY_CREATE: CreateForm = { name: "", type: "PANDIT", phone: "", email: "", password: "", city: "", state: "", experience: "", traditions: "", languages: ["Sanskrit", "Hindi"], bio: "" };

export const AdminProvidersPage: React.FC = () => {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Private profile inspection
  const [inspecting, setInspecting] = useState<any | null>(null);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [inspectLoading, setInspectLoading] = useState(false);

  // Suspend / reinstate
  const [actionTarget, setActionTarget] = useState<ProviderRow | null>(null);
  const [actionType, setActionType] = useState<"suspend" | "reinstate">("suspend");
  const [actionReason, setActionReason] = useState(ACTION_REASONS[0][0]);
  const [actionNote, setActionNote] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Onboarding
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_CREATE);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CreateForm, string>>>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await providerAdminService.list({
        q: searchQuery || undefined,
        status: statusFilter || undefined,
        verificationLevel: levelFilter || undefined,
        page,
      });
      if (res.data?.success) {
        setProviders(res.data.data || []);
        setTotal(res.data.meta?.total ?? res.data.data?.length ?? 0);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load the provider registry."));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, levelFilter, page]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const handleInspect = async (providerId: string) => {
    setInspecting(null);
    setInspectOpen(true);
    setInspectLoading(true);
    try {
      const res = await providerAdminService.getById(providerId);
      if (res.data?.success) setInspecting(res.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not open the confidential profile."));
      setInspectOpen(false);
    } finally {
      setInspectLoading(false);
    }
  };

  const openAction = (p: ProviderRow, type: "suspend" | "reinstate") => {
    setActionTarget(p);
    setActionType(type);
    setActionReason(type === "suspend" ? ACTION_REASONS[0][0] : "OTHER");
    setActionNote("");
  };

  const confirmAction = async () => {
    if (!actionTarget) return;
    setActionSubmitting(true);
    try {
      const body = { reasonCode: actionReason, note: actionNote.trim() || undefined };
      if (actionType === "suspend") {
        await providerAdminService.suspend(actionTarget.id, body);
        toast.success(`${actionTarget.displayName} suspended.`);
      } else {
        await providerAdminService.reinstate(actionTarget.id, body);
        toast.success(`${actionTarget.displayName} reinstated. They can verify and go live again.`);
      }
      setActionTarget(null);
      loadProviders();
    } catch (err) {
      toast.error(getErrorMessage(err, `Could not ${actionType} this provider.`));
    } finally {
      setActionSubmitting(false);
    }
  };

  const setField = <K extends keyof CreateForm>(key: K, value: CreateForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const errs: Partial<Record<keyof CreateForm, string>> = {};
    if (form.name.trim().length < 2) errs.name = "Enter the provider's name (at least 2 characters).";
    if (!EMAIL.test(form.email.trim())) errs.email = "Enter a valid email address. The provider signs in with it.";
    if (!PHONE.test(form.phone.trim())) errs.phone = "Enter a valid phone number, for example +91 98765 43210.";
    if (form.password.length < 8) errs.password = "Use at least 8 characters.";
    if (form.experience && (!Number.isInteger(Number(form.experience)) || Number(form.experience) < 0 || Number(form.experience) > 80)) errs.experience = "Enter whole years between 0 and 80.";
    if (!form.languages.length) errs.languages = "Choose at least one language.";
    setFormErrors(errs);
    if (Object.keys(errs).length) return;

    setCreateSubmitting(true);
    try {
      const res = await providerAdminService.create({
        displayName: form.name.trim(),
        providerType: form.type,
        phone: form.phone.trim(),
        email: form.email.trim(),
        password: form.password,
        homeCity: form.city.trim() || undefined,
        homeState: form.state.trim() || undefined,
        experienceYears: form.experience ? Number(form.experience) : undefined,
        traditions: form.traditions.split(",").map((s) => s.trim()).filter(Boolean),
        languages: form.languages,
        bio: form.bio.trim() || undefined,
      });
      if (res.data?.success) {
        toast.success("Provider onboarded. Share the password securely so they can sign in.");
        setCreateOpen(false);
        setForm(EMPTY_CREATE);
        setFormErrors({});
        loadProviders();
      }
    } catch (err) {
      setCreateError(getErrorMessage(err, "Failed to onboard the provider."));
    } finally {
      setCreateSubmitting(false);
    }
  };

  const columns: Column<ProviderRow>[] = [
    {
      key: "provider",
      header: "Provider",
      primary: true,
      cell: (p) => (
        <span className="flex min-w-0 items-center gap-3">
          <Avatar name={p.displayName} src={p.avatarUrl} size={40} />
          <span className="min-w-0">
            <span className="block truncate font-bold text-[#0B192C] dark:text-white">{p.displayName}</span>
            <span className="block font-mono text-[11px] text-gray-500">{p.id.slice(-8)}</span>
          </span>
        </span>
      ),
    },
    {
      key: "type",
      header: "Type and city",
      cell: (p) => (
        <span>
          <span className="block font-semibold">{PROVIDER_TYPE_LABELS[p.providerType] || p.providerType}</span>
          <span className="text-xs text-gray-500">{[p.homeCity, p.homeState].filter(Boolean).join(", ") || "City not set"}</span>
        </span>
      ),
    },
    { key: "verification", header: "Verification", cell: (p) => <StatusBadge status={p.verificationLevel} label={VERIFICATION_LEVEL_LABELS[p.verificationLevel]} /> },
    {
      key: "status",
      header: "Account",
      cell: (p) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={p.status} />
          {p.isPubliclyListed && <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Listed</span>}
        </span>
      ),
    },
  ];

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Pandit & Acharya"
        icon={<Users size={14} />}
        title="Providers"
        description="Onboard providers, review their private details and suspend or reinstate accounts."
        actions={
          <>
            <Button onClick={() => { setForm(EMPTY_CREATE); setFormErrors({}); setCreateError(null); setCreateOpen(true); }}>
              <UserPlus size={16} aria-hidden="true" />
              Onboard provider
            </Button>
            <Button variant="outline" onClick={loadProviders} aria-label="Refresh the list">
              <RefreshCw size={16} className={loading ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden="true" />
              Refresh
            </Button>
          </>
        }
      />

      <Card className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[1fr,12rem,14rem]" as="section">
        <div>
          <label htmlFor="provider-search" className="sr-only">
            Search providers
          </label>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input id="provider-search" type="search" className={cx(inputClass, "pl-10")} placeholder="Search by name or city" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="provider-status" className="sr-only">
            Account status
          </label>
          <select id="provider-status" className={inputClass} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="ONBOARDING">Onboarding</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
        <div>
          <label htmlFor="provider-level" className="sr-only">
            Verification level
          </label>
          <select id="provider-level" className={inputClass} value={levelFilter} onChange={(e) => { setLevelFilter(e.target.value); setPage(1); }}>
            <option value="">All verification levels</option>
            {Object.entries(VERIFICATION_LEVEL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {error && <ErrorNotice message={error} onRetry={loadProviders} />}

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5" aria-busy="true">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : providers.length === 0 ? (
          <EmptyState icon={<Users size={26} />} title="No providers found" description="Change the filters or onboard a provider." />
        ) : (
          <DataTable
            caption="Providers"
            columns={columns}
            rows={providers}
            rowKey={(p) => p.id}
            actions={(p) => (
              <>
                <Button variant="outline" className="!min-h-[40px] !px-3" onClick={() => handleInspect(p.id)}>
                  <Eye size={14} aria-hidden="true" />
                  Inspect
                </Button>
                {p.status === "SUSPENDED" ? (
                  <Button className="!min-h-[40px] !px-3" onClick={() => openAction(p, "reinstate")}>
                    Reinstate
                  </Button>
                ) : (
                  <Button variant="outline" className="!min-h-[40px] !px-3 !border-rose-300 !text-rose-700" onClick={() => openAction(p, "suspend")}>
                    Suspend
                  </Button>
                )}
              </>
            )}
          />
        )}
      </Card>
      {!loading && <Pagination page={page} pageCount={pageCount} onChange={setPage} />}

      {/* ── Confidential profile ───────────────────────────────────────── */}
      <Modal open={inspectOpen} onClose={() => setInspectOpen(false)} title="Confidential provider profile" size="md" footer={<Button onClick={() => setInspectOpen(false)}>Close</Button>}>
        {inspectLoading ? (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-6" />
            <Skeleton className="h-6" />
            <Skeleton className="h-6" />
          </div>
        ) : inspecting ? (
          <div className="space-y-4">
            <Notice tone="warning">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={14} aria-hidden="true" />
                This view is private to authorized staff and is recorded in the audit trail.
              </span>
            </Notice>
            <dl className="divide-y divide-gray-100 rounded-xl border border-gray-200 text-sm dark:divide-slate-800 dark:border-slate-700">
              {(
                [
                  ["Display name", inspecting.displayName],
                  ["Legal name", inspecting.legalName],
                  ["Contact phone", inspecting.contactPhone],
                  ["Contact email", inspecting.contactEmail],
                  ["Account id", inspecting.userId],
                  ["Status", inspecting.status],
                  ["Profile completion", inspecting.profileCompletionPercent != null ? `${inspecting.profileCompletionPercent}%` : null],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 p-3">
                  <dt className="shrink-0 text-gray-500">{label}</dt>
                  <dd className="min-w-0 break-words text-right font-semibold text-[#0B192C] dark:text-white">{value || "Not provided"}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </Modal>

      {/* ── Suspend / reinstate ────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!actionTarget}
        title={actionType === "suspend" ? `Suspend ${actionTarget?.displayName ?? ""}?` : `Reinstate ${actionTarget?.displayName ?? ""}?`}
        tone={actionType === "suspend" ? "danger" : "primary"}
        confirmLabel={actionType === "suspend" ? "Suspend provider" : "Reinstate provider"}
        loading={actionSubmitting}
        description={
          actionType === "suspend"
            ? "Their services are hidden immediately and new bookings are blocked. Existing bookings are not cancelled automatically."
            : "The provider returns to Inactive. They must still be verified and go live again."
        }
        onCancel={() => setActionTarget(null)}
        onConfirm={confirmAction}
      >
        <Field label="Reason" required>
          <select className={inputClass} value={actionReason} onChange={(e) => setActionReason(e.target.value)}>
            {ACTION_REASONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Internal note" hint="Stored in the audit trail. Up to 500 characters.">
          <textarea rows={2} maxLength={500} className={inputClass} value={actionNote} onChange={(e) => setActionNote(e.target.value)} />
        </Field>
      </ConfirmDialog>

      {/* ── Onboard ────────────────────────────────────────────────────── */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Onboard a Pandit or Acharya"
        description="Creates a login account and a provider profile."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="onboard-form" loading={createSubmitting}>
              {createSubmitting ? "Onboarding…" : "Create and onboard"}
            </Button>
          </>
        }
      >
        <form id="onboard-form" onSubmit={handleCreate} className="space-y-4" noValidate>
          {createError && <ErrorNotice message={createError} />}
          <Field label="Full name or honorific" required error={formErrors.name}>
            <input type="text" className={inputClass} value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="e.g. Acharya Ramanand Shastri" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Provider type" required>
              <select className={inputClass} value={form.type} onChange={(e) => setField("type", e.target.value)}>
                {Object.entries(PROVIDER_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Experience (years)" error={formErrors.experience}>
              <input type="number" inputMode="numeric" min={0} max={80} className={inputClass} value={form.experience} onChange={(e) => setField("experience", e.target.value)} />
            </Field>
          </div>

          <fieldset className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-slate-800">
            <legend className="px-1 text-xs font-bold uppercase tracking-wide text-gray-500">Sign-in details</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Email" required error={formErrors.email}>
                <input type="email" autoComplete="off" className={inputClass} value={form.email} onChange={(e) => setField("email", e.target.value)} placeholder="acharya@example.com" />
              </Field>
              <Field label="Phone" required error={formErrors.phone}>
                <input type="tel" autoComplete="off" inputMode="tel" className={inputClass} value={form.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="+91 98765 43210" />
              </Field>
            </div>
            <Field label="Password" required error={formErrors.password} hint="The provider signs in with this and their email or phone. Share it securely.">
              <div className="flex gap-2">
                <input type={showPassword ? "text" : "password"} autoComplete="new-password" className={inputClass} value={form.password} onChange={(e) => setField("password", e.target.value)} />
                <Button variant="outline" className="shrink-0" onClick={() => setShowPassword((v) => !v)} aria-pressed={showPassword}>
                  {showPassword ? "Hide" : "Show"}
                </Button>
              </div>
            </Field>
          </fieldset>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="City">
              <input type="text" className={inputClass} value={form.city} onChange={(e) => setField("city", e.target.value)} placeholder="e.g. Varanasi" />
            </Field>
            <Field label="State">
              <input type="text" className={inputClass} value={form.state} onChange={(e) => setField("state", e.target.value)} placeholder="e.g. Uttar Pradesh" />
            </Field>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold text-gray-800 dark:text-gray-200">
              Languages <span className="text-rose-600" aria-hidden="true">*</span>
              <span className="sr-only"> (required)</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((lang) => {
                const on = form.languages.includes(lang);
                return (
                  <button
                    key={lang}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setField("languages", on ? form.languages.filter((l) => l !== lang) : [...form.languages, lang])}
                    className={cx(
                      "min-h-[40px] rounded-full border px-3.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28]",
                      on ? "border-[#0B192C] bg-[#0B192C] text-white" : "border-gray-300 bg-white text-gray-700 dark:border-slate-600 dark:bg-slate-900 dark:text-gray-300",
                    )}
                  >
                    {on ? "✓ " : ""}
                    {lang}
                  </button>
                );
              })}
            </div>
            {formErrors.languages && (
              <p role="alert" className="mt-1.5 text-xs font-semibold text-rose-700">
                {formErrors.languages}
              </p>
            )}
          </fieldset>

          <Field label="Traditions" hint="Separate with commas, for example Smartha, Rigveda.">
            <input type="text" className={inputClass} value={form.traditions} onChange={(e) => setField("traditions", e.target.value)} />
          </Field>
          <Field label="Biography">
            <textarea rows={3} className={inputClass} value={form.bio} maxLength={1000} onChange={(e) => setField("bio", e.target.value)} />
          </Field>
        </form>
      </Modal>
    </PageContainer>
  );
};

export default AdminProvidersPage;
