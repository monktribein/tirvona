import React, { useCallback, useEffect, useState } from "react";
import { BookOpen, Plus, RefreshCw } from "lucide-react";
import { ritualAdminService } from "../services/provider.service";
import { getErrorMessage } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import {
  Button,
  Card,
  ConfirmDialog,
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
} from "../ui";

const PAGE_SIZE = 20;

const FULFILMENT_TYPES = [
  { value: "LOCAL_HOME", label: "At the devotee's home (local)" },
  { value: "DESTINATION_PROVIDER_HOME", label: "At the devotee's home (provider travels)" },
  { value: "AT_DESTINATION", label: "At a destination" },
  { value: "ON_BEHALF", label: "On behalf of the devotee" },
  { value: "INSTITUTION_AUTHORIZED", label: "Institution authorized" },
  { value: "CORPORATE", label: "Corporate or group event" },
];

// A ritual moves DRAFT -> DOMAIN_REVIEW -> APPROVED -> PUBLISHED. Only published rituals can be offered by providers.
const NEXT_STEP: Record<string, { action: "submit-review" | "approve" | "publish"; label: string } | undefined> = {
  DRAFT: { action: "submit-review", label: "Submit for review" },
  DOMAIN_REVIEW: { action: "approve", label: "Approve" },
  APPROVED: { action: "publish", label: "Publish" },
};

const STATUS_FILTERS: Array<[string, string]> = [
  ["", "All"],
  ["DRAFT", "Draft"],
  ["DOMAIN_REVIEW", "In review"],
  ["APPROVED", "Approved"],
  ["PUBLISHED", "Published"],
  ["ARCHIVED", "Archived"],
];

const titleOf = (t?: Record<string, string>, fallback = "") => t?.en || Object.values(t ?? {})[0] || fallback;
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export const AdminRitualCataloguePage: React.FC = () => {
  const [rituals, setRituals] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<any | null>(null);

  // New ritual
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<"title" | "summary" | "types" | "duration", string>>>({});
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState("");
  const [duration, setDuration] = useState("60");
  const [types, setTypes] = useState<string[]>(["LOCAL_HOME"]);
  const [variantName, setVariantName] = useState("Standard");

  // New variant for an existing ritual
  const [variantTarget, setVariantTarget] = useState<any | null>(null);
  const [newVariantName, setNewVariantName] = useState("");
  const [variantError, setVariantError] = useState<string | null>(null);
  const [variantSaving, setVariantSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ritualAdminService.list({ status: status || undefined, page, limit: PAGE_SIZE });
      setRituals(res.data?.data ?? []);
      setTotal(res.data?.meta?.total ?? res.data?.data?.length ?? 0);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load the ritual catalogue."));
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  const transition = async (id: string, action: "submit-review" | "approve" | "publish" | "archive", done?: () => void) => {
    setBusyId(id);
    try {
      await ritualAdminService.transition(id, action);
      toast.success(action === "archive" ? "Ritual archived." : "Ritual updated.");
      done?.();
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not update the ritual."));
    } finally {
      setBusyId(null);
    }
  };

  const openCreate = () => {
    setTitle("");
    setSummary("");
    setCategory("");
    setDuration("60");
    setTypes(["LOCAL_HOME"]);
    setVariantName("Standard");
    setErrors({});
    setCreateError(null);
    setCreateOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const next: typeof errors = {};
    if (!title.trim()) next.title = "Enter the ritual's English title.";
    if (!summary.trim()) next.summary = "Enter a short English summary.";
    if (!types.length) next.types = "Choose at least one place it can be performed.";
    const minutes = Number(duration);
    if (duration && (!Number.isInteger(minutes) || minutes < 1 || minutes > 2880)) next.duration = "Enter whole minutes between 1 and 2880.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const res = await ritualAdminService.create({
        titles: { en: title.trim() },
        summary: { en: summary.trim() },
        category: category.trim() || undefined,
        applicableFulfilmentTypes: types,
        defaultDurationMinutes: duration ? minutes : undefined,
      });
      const id = res.data?.data?.id;
      // Providers choose a variant, so every new ritual starts with one.
      if (id && variantName.trim()) {
        const code = slugify(variantName) || "standard";
        await ritualAdminService.createVariant(id, { code: code.length < 2 ? "standard" : code, titles: { en: variantName.trim() }, scope: {} });
      }
      toast.success("Ritual saved as a draft. Submit, approve and publish it to make it available to providers.");
      setCreateOpen(false);
      setPage(1);
      await load();
    } catch (err) {
      setCreateError(getErrorMessage(err, "Failed to create the ritual."));
    } finally {
      setSaving(false);
    }
  };

  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!variantTarget) return;
    const name = newVariantName.trim();
    const code = slugify(name);
    if (name.length < 2 || code.length < 2) return setVariantError("Enter a variant name of at least 2 letters.");
    setVariantSaving(true);
    setVariantError(null);
    try {
      await ritualAdminService.createVariant(variantTarget.id, { code, titles: { en: name }, scope: {} });
      toast.success("Variant added.");
      setVariantTarget(null);
    } catch (err) {
      setVariantError(getErrorMessage(err, "Could not add the variant."));
    } finally {
      setVariantSaving(false);
    }
  };

  const toggleType = (value: string) => setTypes((prev) => (prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]));
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Pandit & Acharya"
        title="Ritual catalogue"
        description="The pujas providers can offer. A ritual must be published before it appears in a provider's service list."
        actions={
          <>
            <Button onClick={openCreate}>
              <Plus size={16} aria-hidden="true" />
              New ritual
            </Button>
            <Button variant="outline" onClick={load} aria-label="Refresh the list">
              <RefreshCw size={16} className={cx(loading && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
              Refresh
            </Button>
          </>
        }
      />

      <div role="tablist" aria-label="Ritual status" className="flex flex-wrap gap-2 border-b border-gray-200 pb-3 dark:border-slate-800">
        {STATUS_FILTERS.map(([value, label]) => (
          <button
            key={value || "all"}
            role="tab"
            type="button"
            aria-selected={status === value}
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
            className={cx(
              "min-h-[44px] rounded-full px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28]",
              status === value ? "bg-[#0B192C] text-white" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-800",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <ErrorNotice message={error} onRetry={load} />}

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : rituals.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen size={26} />}
            title="No rituals here yet"
            description="Create the first ritual, then take it through review to publish it."
            action={
              <Button onClick={openCreate}>
                <Plus size={16} aria-hidden="true" />
                New ritual
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {rituals.map((r) => {
            const next = NEXT_STEP[r.status];
            return (
              <li key={r.id}>
                <Card as="article" className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="break-words text-base font-extrabold text-[#0B192C] dark:text-white">{titleOf(r.titles, r.slug)}</h2>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">{titleOf(r.summary)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {next && (
                      <Button loading={busyId === r.id} onClick={() => transition(r.id, next.action)}>
                        {next.label}
                      </Button>
                    )}
                    {r.status !== "ARCHIVED" && (
                      <Button variant="outline" onClick={() => { setVariantTarget(r); setNewVariantName(""); setVariantError(null); }}>
                        Add variant
                      </Button>
                    )}
                    {r.status !== "ARCHIVED" && (
                      <Button variant="outline" className="!border-rose-300 !text-rose-700" onClick={() => setArchiveTarget(r)}>
                        Archive
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {!loading && <Pagination page={page} pageCount={pageCount} onChange={setPage} />}

      <ConfirmDialog
        open={!!archiveTarget}
        title="Archive this ritual?"
        confirmLabel="Archive ritual"
        loading={!!archiveTarget && busyId === archiveTarget.id}
        description={archiveTarget ? `${titleOf(archiveTarget.titles, archiveTarget.slug)} will no longer be offered. Providers' existing services built on it stop being bookable.` : ""}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => archiveTarget && transition(archiveTarget.id, "archive", () => setArchiveTarget(null))}
      />

      <Modal
        open={!!variantTarget}
        onClose={() => setVariantTarget(null)}
        title="Add a variant"
        description={variantTarget ? titleOf(variantTarget.titles, variantTarget.slug) : undefined}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setVariantTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" form="variant-form" loading={variantSaving}>
              Add variant
            </Button>
          </>
        }
      >
        <form id="variant-form" onSubmit={handleAddVariant} className="space-y-4" noValidate>
          {variantError && <ErrorNotice message={variantError} />}
          <Field label="Variant name" required hint="For example Standard, Extended or Grand.">
            <input type="text" className={inputClass} value={newVariantName} maxLength={100} onChange={(e) => setNewVariantName(e.target.value)} />
          </Field>
        </form>
      </Modal>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New ritual"
        description="Saved as a draft until it is reviewed and published."
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="ritual-form" loading={saving}>
              Create draft
            </Button>
          </>
        }
      >
        <form id="ritual-form" onSubmit={handleCreate} className="space-y-4" noValidate>
          {createError && <ErrorNotice message={createError} />}
          <Field label="Title (English)" required error={errors.title}>
            <input type="text" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Griha Pravesh Puja" />
          </Field>
          <Field label="Summary (English)" required error={errors.summary}>
            <textarea rows={3} className={inputClass} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Category">
              <input type="text" className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. home" />
            </Field>
            <Field label="Default duration (minutes)" error={errors.duration}>
              <input type="number" inputMode="numeric" min={1} max={2880} className={inputClass} value={duration} onChange={(e) => setDuration(e.target.value)} />
            </Field>
          </div>
          <Field label="First variant name" hint="Providers choose a variant when they create a service.">
            <input type="text" className={inputClass} value={variantName} onChange={(e) => setVariantName(e.target.value)} />
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold text-gray-800 dark:text-gray-200">
              Where it can be performed <span className="text-rose-600" aria-hidden="true">*</span>
              <span className="sr-only"> (required)</span>
            </legend>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {FULFILMENT_TYPES.map((t) => (
                <label key={t.value} className="flex min-h-[44px] items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" className="h-4 w-4" checked={types.includes(t.value)} onChange={() => toggleType(t.value)} />
                  {t.label}
                </label>
              ))}
            </div>
            {errors.types && (
              <p role="alert" className="mt-1 text-xs font-semibold text-rose-700">
                {errors.types}
              </p>
            )}
          </fieldset>
          <Notice tone="info">Super Admin can approve their own ritual. Other content managers cannot approve what they wrote.</Notice>
        </form>
      </Modal>
    </PageContainer>
  );
};

export default AdminRitualCataloguePage;
