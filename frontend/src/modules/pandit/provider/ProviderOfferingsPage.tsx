/**
 * Provider Offerings Page: list, create and edit offerings.
 * Route: /provider/offerings
 *
 * Backend:
 *   GET   /api/v2/provider/offerings        list
 *   POST  /api/v2/provider/offerings        create
 *   PATCH /api/v2/provider/offerings/:id    update / pause / activate
 *   GET   /api/v2/rituals                   published ritual catalogue
 */

import { Paginated } from "../../../components/shared/Pagination";
import React, { useCallback, useEffect, useState } from "react";
import { BookOpen, CalendarDays, Clock, Edit2, Plus, RefreshCw, Users } from "lucide-react";
import { providerSelfService, ritualCatalogService } from "../services/provider.service";
import type { CreateOfferingInput, Ritual, RitualVariant } from "../types/provider.types";
import { getErrorMessage } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import {
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  Field,
  Modal,
  PageContainer,
  PageHeader,
  Skeleton,
  StatusBadge,
  Toggle,
  formatMinor,
  inputClass,
} from "../ui";

const FULFILMENT_LABELS: Record<string, string> = {
  LOCAL_HOME: "At the devotee's home, in your service cities",
  DESTINATION_PROVIDER_HOME: "At the devotee's home in another city (you travel)",
  AT_DESTINATION: "At a sacred destination or venue",
  ON_BEHALF: "Performed on behalf of the devotee",
  CORPORATE: "Corporate or group event",
};
const FULFILMENT_TYPES = Object.keys(FULFILMENT_LABELS);

type OfferingView = {
  id: string;
  ritualVariantId?: string;
  fulfilmentType: string;
  title?: string | null;
  description?: string | null;
  durationMinutes: number;
  teamSize?: number;
  minNoticeHours?: number;
  indicativeFee?: { amountMinor: number; currency?: string };
  baseProfessionalFeeMinor?: number;
  currency?: string;
  inclusions?: string[];
  samagriIncluded?: boolean;
  voluntaryDakshinaAllowed?: boolean;
  status: string;
  serviceType?: "INDIVIDUAL" | "GROUP" | "KATHA";
  groupCapacity?: number;
  kathaDetails?: { kathaName?: string; totalDays?: number; dailyHours?: number; includesSamagri?: boolean; yajamanRequirement?: string };
  ritual?: { titles?: Record<string, string> } | null;
  variant?: { titles?: Record<string, string> } | null;
};

const feeMinorOf = (o: OfferingView) => o.indicativeFee?.amountMinor ?? o.baseProfessionalFeeMinor ?? 0;
const nameOf = (o: OfferingView) => o.title || o.ritual?.titles?.en || Object.values(o.ritual?.titles ?? {})[0] || "Puja service";

type FieldErrors = Partial<Record<"variant" | "duration" | "fee" | "team" | "notice" | "inclusions", string>>;

// ─── Offering form ────────────────────────────────────────────────────────────

const OfferingFormModal: React.FC<{
  offering: OfferingView | null;
  rituals: Ritual[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ offering, rituals, onClose, onSaved }) => {
  const isNew = !offering;

  const [selectedVariantId, setSelectedVariantId] = useState(offering?.ritualVariantId || "");
  const [fulfilmentType, setFulfilmentType] = useState(offering?.fulfilmentType || "LOCAL_HOME");
  const [serviceType, setServiceType] = useState<"INDIVIDUAL" | "GROUP" | "KATHA">(offering?.serviceType || "INDIVIDUAL");
  const [groupCapacity, setGroupCapacity] = useState(String(offering?.groupCapacity ?? 25));
  const [kathaName, setKathaName] = useState(offering?.kathaDetails?.kathaName || "Shrimad Bhagwat Katha");
  const [kathaDays, setKathaDays] = useState(String(offering?.kathaDetails?.totalDays ?? 7));
  const [kathaHours, setKathaHours] = useState(String(offering?.kathaDetails?.dailyHours ?? 4));
  const [title, setTitle] = useState(offering?.title || "");
  const [description, setDescription] = useState(offering?.description || "");
  const [durationMinutes, setDurationMinutes] = useState(String(offering?.durationMinutes ?? 60));
  const [baseFee, setBaseFee] = useState(offering ? String(feeMinorOf(offering) / 100) : "");
  const [teamSize, setTeamSize] = useState(String(offering?.teamSize ?? 1));
  const [minNoticeHours, setMinNoticeHours] = useState(String(offering?.minNoticeHours ?? 24));
  const [inclusions, setInclusions] = useState((offering?.inclusions ?? []).join("\n"));
  const [samagriIncluded, setSamagriIncluded] = useState(offering?.samagriIncluded ?? false);
  const [dakshinaAllowed, setDakshinaAllowed] = useState(offering?.voluntaryDakshinaAllowed ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const allVariants: Array<{ variant: RitualVariant; ritual: Ritual }> = rituals.flatMap((r) => (r.variants || []).map((v) => ({ variant: v, ritual: r })));

  const validate = (): { ok: boolean; inclusionList: string[] } => {
    const next: FieldErrors = {};
    const inclusionList = inclusions.split("\n").map((l) => l.trim()).filter(Boolean);
    if (isNew && !selectedVariantId) next.variant = "Choose the ritual this service is for.";
    const duration = Number(durationMinutes);
    if (!Number.isInteger(duration) || duration < 1 || duration > 2880) next.duration = "Enter a whole number of minutes between 1 and 2880.";
    const fee = Number(baseFee);
    if (baseFee.trim() === "" || !Number.isFinite(fee) || fee < 0) next.fee = "Enter your fee in rupees (0 or more).";
    const team = Number(teamSize);
    if (!Number.isInteger(team) || team < 1 || team > 50) next.team = "Enter a whole number between 1 and 50.";
    const notice = Number(minNoticeHours);
    if (!Number.isInteger(notice) || notice < 0 || notice > 2160) next.notice = "Enter whole hours between 0 and 2160.";
    if (inclusionList.length > 20 || inclusionList.some((l) => l.length > 200)) next.inclusions = "Up to 20 lines, each under 200 characters.";
    setErrors(next);
    return { ok: Object.keys(next).length === 0, inclusionList };
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const { ok, inclusionList } = validate();
    if (!ok) return;

    setSaving(true);
    try {
      const shared: any = {
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        serviceType,
        groupCapacity: serviceType === "GROUP" ? Number(groupCapacity) || 25 : undefined,
        kathaDetails: serviceType === "KATHA" ? {
          kathaName: kathaName.trim() || "Bhagwat Katha",
          totalDays: Number(kathaDays) || 7,
          dailyHours: Number(kathaHours) || 4,
          includesSamagri: samagriIncluded,
        } : undefined,
        durationMinutes: Number(durationMinutes),
        teamSize: Number(teamSize),
        minNoticeHours: Number(minNoticeHours),
        baseProfessionalFeeMinor: Math.round(Number(baseFee) * 100),
        inclusions: inclusionList,
        samagriIncluded,
        voluntaryDakshinaAllowed: dakshinaAllowed,
      };
      if (isNew) {
        const data: CreateOfferingInput = { ritualVariantId: selectedVariantId, fulfilmentType, ...shared, status: "ACTIVE" };
        await providerSelfService.createOffering(data);
        toast.success("Service created.");
      } else {
        await providerSelfService.updateOffering(offering!.id, shared);
        toast.success("Service updated.");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save the service."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? "New service" : "Edit service"}
      description="Devotees see this on your public profile."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="offering-form" loading={saving}>
            {saving ? "Saving…" : isNew ? "Create service" : "Save changes"}
          </Button>
        </>
      }
    >
      <form id="offering-form" onSubmit={handleSave} className="space-y-5" noValidate>
        {error && <ErrorNotice message={error} />}

        <fieldset className="space-y-4">
          <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">What you offer</legend>
          {isNew ? (
            <Field label="Ritual" required error={errors.variant} hint={allVariants.length === 0 ? "No published rituals are available yet. Ask Tirvona to publish the ritual catalogue." : undefined}>
              <select className={inputClass} value={selectedVariantId} onChange={(e) => setSelectedVariantId(e.target.value)}>
                <option value="">Select a ritual…</option>
                {allVariants.map(({ variant, ritual }) => (
                  <option key={variant.id} value={variant.id}>
                    {ritual.name} · {variant.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700 dark:bg-slate-900 dark:text-gray-300">
              {nameOf(offering!)} · {FULFILMENT_LABELS[offering!.fulfilmentType] || offering!.fulfilmentType}
              <span className="block text-xs text-gray-500">The ritual and where it is performed cannot be changed after the service is created.</span>
            </p>
          )}
          {isNew && (
            <Field label="Where it is performed" required>
              <select className={inputClass} value={fulfilmentType} onChange={(e) => setFulfilmentType(e.target.value)}>
                {FULFILMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {FULFILMENT_LABELS[t]}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Ceremony format" required>
            <select
              className={inputClass}
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value as any)}
            >
              <option value="INDIVIDUAL">Individual / Family Puja</option>
              <option value="GROUP">Group Puja (Multiple Yajamans)</option>
              <option value="KATHA">Katha Ceremony (Bhagwat / Ram Katha / Shiv Puran)</option>
            </select>
          </Field>

          {serviceType === "GROUP" && (
            <Field label="Group capacity (Max Yajamans)" required hint="Maximum number of devotees who can participate together.">
              <input
                type="number"
                min={2}
                max={500}
                className={inputClass}
                value={groupCapacity}
                onChange={(e) => setGroupCapacity(e.target.value)}
              />
            </Field>
          )}

          {serviceType === "KATHA" && (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">Katha Configuration</p>
              <Field label="Katha Name" required>
                <input
                  type="text"
                  className={inputClass}
                  value={kathaName}
                  onChange={(e) => setKathaName(e.target.value)}
                  placeholder="e.g. Shrimad Bhagwat Katha Gyan Yajna"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Duration (Total Days)" required>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    className={inputClass}
                    value={kathaDays}
                    onChange={(e) => setKathaDays(e.target.value)}
                  />
                </Field>
                <Field label="Daily Session Hours" required>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    className={inputClass}
                    value={kathaHours}
                    onChange={(e) => setKathaHours(e.target.value)}
                  />
                </Field>
              </div>
            </div>
          )}

          <Field label="Custom title" hint="Optional. Replaces the ritual name on your profile.">
            <input type="text" className={inputClass} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Full Vivah ceremony with Saptapadi" />
          </Field>
          <Field label="Description" hint="What the devotee can expect.">
            <textarea rows={3} className={inputClass} value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Price and time</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Your fee (₹)" required error={errors.fee} hint="Voluntary dakshina is separate.">
              <input type="number" inputMode="decimal" min={0} step={50} className={inputClass} value={baseFee} onChange={(e) => setBaseFee(e.target.value)} placeholder="1500" />
            </Field>
            <Field label="Duration (minutes)" required error={errors.duration}>
              <input type="number" inputMode="numeric" min={1} max={2880} className={inputClass} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
            </Field>
            <Field label="Priests in the team" error={errors.team}>
              <input type="number" inputMode="numeric" min={1} max={50} className={inputClass} value={teamSize} onChange={(e) => setTeamSize(e.target.value)} />
            </Field>
            <Field label="Notice needed (hours)" error={errors.notice} hint="Bookings sooner than this are refused.">
              <input type="number" inputMode="numeric" min={0} className={inputClass} value={minNoticeHours} onChange={(e) => setMinNoticeHours(e.target.value)} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Inclusions</legend>
          <Field label="What is included" error={errors.inclusions} hint="One item per line, for example “Havan kund and samagri”.">
            <textarea rows={4} className={inputClass} value={inclusions} onChange={(e) => setInclusions(e.target.value)} />
          </Field>
          <Toggle checked={samagriIncluded} onChange={setSamagriIncluded} label="Puja samagri included" description="You bring the materials." />
          <Toggle checked={dakshinaAllowed} onChange={setDakshinaAllowed} label="Accept voluntary dakshina" description="Devotees may offer extra, separate from your fee." />
        </fieldset>
      </form>
    </Modal>
  );
};

// ─── Offering card ────────────────────────────────────────────────────────────

const OfferingCard: React.FC<{
  offering: OfferingView;
  onEdit: (o: OfferingView) => void;
  onToggle: (o: OfferingView) => void;
  toggling: boolean;
}> = ({ offering, onEdit, onToggle, toggling }) => (
  <Card as="article" className="p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h2 className="break-words text-base font-extrabold text-[#0B192C] dark:text-white">{nameOf(offering)}</h2>
          <StatusBadge status={offering.status} />
          {(offering.serviceType === "GROUP" || offering.groupCapacity) && (
            <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-800 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300">
              👥 Group Puja · Max {offering.groupCapacity || 25} Devotees
            </span>
          )}
          {(offering.serviceType === "KATHA" || offering.kathaDetails) && (
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
              📜 {offering.kathaDetails?.kathaName || "Katha Service"} ({offering.kathaDetails?.totalDays || 7} Days)
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">{FULFILMENT_LABELS[offering.fulfilmentType] || offering.fulfilmentType}</p>
        {offering.description && <p className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">{offering.description}</p>}
      </div>
      <p className="text-right text-xl font-black text-[#0B192C] dark:text-white">{formatMinor(feeMinorOf(offering), offering.indicativeFee?.currency || offering.currency || "INR")}</p>
    </div>
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-gray-100 pt-3 text-sm text-gray-600 dark:border-slate-800 dark:text-gray-400">
      <li className="flex items-center gap-1.5">
        <Clock size={14} aria-hidden="true" />
        {offering.durationMinutes} min
      </li>
      {offering.teamSize && offering.teamSize > 1 ? (
        <li className="flex items-center gap-1.5">
          <Users size={14} aria-hidden="true" />
          {offering.teamSize} priests
        </li>
      ) : null}
      {offering.minNoticeHours ? (
        <li className="flex items-center gap-1.5">
          <CalendarDays size={14} aria-hidden="true" />
          {offering.minNoticeHours}h notice
        </li>
      ) : null}
    </ul>
    <div className="mt-4 flex flex-wrap gap-2">
      <Button variant="outline" className="!min-h-[40px]" onClick={() => onEdit(offering)}>
        <Edit2 size={14} aria-hidden="true" />
        Edit
      </Button>
      <Button variant="outline" className="!min-h-[40px]" loading={toggling} onClick={() => onToggle(offering)}>
        {offering.status === "ACTIVE" ? "Pause" : "Activate"}
      </Button>
    </div>
  </Card>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export const ProviderOfferingsPage: React.FC = () => {
  const [offerings, setOfferings] = useState<OfferingView[]>([]);
  const [rituals, setRituals] = useState<Ritual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOffering, setModalOffering] = useState<OfferingView | null | undefined>(undefined); // undefined = closed
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [offeringsRes, ritualsRes] = await Promise.allSettled([providerSelfService.listOfferings(), ritualCatalogService.list({ limit: 50 } as any)]);
    if (offeringsRes.status === "fulfilled" && offeringsRes.value.data?.success) {
      setOfferings((offeringsRes.value.data.data as any[]) || []);
    } else if (offeringsRes.status === "rejected") {
      setError(getErrorMessage(offeringsRes.reason, "Failed to load your services."));
    }
    if (ritualsRes.status === "fulfilled" && ritualsRes.value.data?.success) {
      // The list holds locale-keyed titles; each ritual's variants are a separate call.
      const label = (t: Record<string, string> | undefined, fallback: string) => t?.en || Object.values(t ?? {})[0] || fallback;
      const listed: any[] = ritualsRes.value.data.data || [];
      const withVariants = await Promise.all(
        listed.map(async (r) => {
          let variants: any[] = [];
          try {
            const v = await ritualCatalogService.getVariants(r.id);
            variants = v.data?.data || [];
          } catch {
            variants = [];
          }
          return {
            ...r,
            name: label(r.titles, r.slug),
            variants: variants.map((x) => ({ ...x, name: label(x.titles, x.code) })),
          } as Ritual;
        }),
      );
      setRituals(withVariants.filter((r) => (r.variants || []).length > 0));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (offering: OfferingView) => {
    const next = offering.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setTogglingId(offering.id);
    try {
      await providerSelfService.updateOffering(offering.id, { status: next });
      setOfferings((prev) => prev.map((o) => (o.id === offering.id ? { ...o, status: next } : o)));
      toast.success(next === "ACTIVE" ? "Service is active." : "Service paused. Devotees can no longer book it.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update the service."));
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        eyebrow="Provider workspace"
        title="Your services"
        description="The pujas and ceremonies devotees can book from your profile."
        actions={
          <Button onClick={() => setModalOffering(null)}>
            <Plus size={16} aria-hidden="true" />
            New service
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : error ? (
        <ErrorNotice message={error} onRetry={load} />
      ) : offerings.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen size={26} />}
            title="No services yet"
            description="Create your first service to start appearing in the devotee directory."
            action={
              <Button onClick={() => setModalOffering(null)}>
                <Plus size={16} aria-hidden="true" />
                Create first service
              </Button>
            }
          />
        </Card>
      ) : (
        <Paginated items={offerings} pageSize={10}>
          {(pageItems) => (
          <ul className="space-y-4">
            {pageItems.map((o) => (
              <li key={o.id}>
                <OfferingCard offering={o} onEdit={setModalOffering} onToggle={handleToggle} toggling={togglingId === o.id} />
              </li>
            ))}
          </ul>
          )}
        </Paginated>
      )}

      {!loading && !error && (
        <Button variant="ghost" onClick={load} className="mx-auto">
          <RefreshCw size={14} aria-hidden="true" />
          Refresh
        </Button>
      )}

      {modalOffering !== undefined && <OfferingFormModal offering={modalOffering} rituals={rituals} onClose={() => setModalOffering(undefined)} onSaved={load} />}
    </PageContainer>
  );
};

export default ProviderOfferingsPage;
