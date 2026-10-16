/* oxlint-disable react/only-export-components -- shared kit for the restaurant and admin food consoles */
import React, { useEffect, useState } from "react";
import { BadgeCheck, Clock, ShieldAlert } from "lucide-react";
import { EnterpriseButton } from "../../admin/shared/components/EnterpriseButton";
import { Field, Pill, inputClass } from "../marketplace/ui";
import { foodService } from "../../services/food.service";
import type { FoodZone } from "../../services/food.service";
import type {
  FoodOutletInput,
  FoodPartnerOutlet,
  FoodVendor,
} from "../../services/foodPartner.service";

export const VENDOR_STATUS_LABEL: Record<FoodVendor["status"], string> = {
  pending_verification: "Awaiting approval",
  active: "Approved & live",
  suspended: "Suspended",
  rejected: "Rejected",
};

export const VendorStatusPill: React.FC<{ status: FoodVendor["status"] }> = ({ status }) => (
  <Pill
    label={VENDOR_STATUS_LABEL[status] ?? status}
    tone={
      status === "active"
        ? "green"
        : status === "pending_verification"
          ? "saffron"
          : "red"
    }
  />
);

const BANNER: Record<
  FoodVendor["status"],
  { tone: string; Icon: typeof Clock; title: string; text: string }
> = {
  pending_verification: {
    tone: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-300",
    Icon: Clock,
    title: "Your restaurant is waiting for Tirvona approval",
    text: "You can set up your kitchen, menu and inventory now. Customers will see it only after Super Admin approves it.",
  },
  active: {
    tone: "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300",
    Icon: BadgeCheck,
    title: "Your restaurant is approved and live",
    text: "Open kitchens with available dishes are shown to customers on the Food page.",
  },
  suspended: {
    tone: "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-300",
    Icon: ShieldAlert,
    title: "Your restaurant is suspended",
    text: "It is hidden from customers and cannot take new orders. Contact Tirvona support to resolve this.",
  },
  rejected: {
    tone: "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-300",
    Icon: ShieldAlert,
    title: "Your application was not approved",
    text: "Update your details and contact Tirvona support to be reviewed again.",
  },
};

export const VendorStatusBanner: React.FC<{ status: FoodVendor["status"] }> = ({ status }) => {
  const copy = BANNER[status];
  if (!copy) return null;
  return (
    <div className={`rounded-2xl border p-4 flex items-start gap-3 ${copy.tone}`} role="status">
      <copy.Icon size={20} className="shrink-0 mt-0.5" />
      <div className="text-xs space-y-0.5">
        <p className="font-black">{copy.title}</p>
        <p className="leading-relaxed">{copy.text}</p>
      </div>
    </div>
  );
};

export const useFoodZones = () => {
  const [zones, setZones] = useState<FoodZone[]>([]);
  useEffect(() => {
    foodService.getZones().then(setZones).catch(() => setZones([]));
  }, []);
  return zones;
};

export const FAMILIES = [
  ["THALI", "Thali (थाली)"],
  ["BOWL", "Bowl (बाउल)"],
  ["COMBO", "Combo (कॉम्बो)"],
] as const;

export const DIETARY_TAGS = [
  ["vegetarian", "Pure Vegetarian"],
  ["satvik", "100% Satvik"],
  ["jain", "Jain"],
  ["no_onion_garlic", "No Onion/Garlic"],
  ["no_ginger_garlic", "No Ginger/Garlic"],
  ["spicy", "Spicy"],
  ["non_spicy", "Non-Spicy"],
] as const;

export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

/** Digits only: phone fields keep +, spaces and dashes, which the API accepts. */
const cleanPhone = (value: string) => value.replace(/[^\d+\s-]/g, "");

const emptyOutlet = (): FoodOutletInput => ({
  brandName: "",
  address: "",
  serviceZoneCodes: [],
  fulfilmentModes: ["pickup", "vendor_delivery"],
  openTime: "08:00",
  closeTime: "22:00",
  contactPhone: "",
  minOrderPaise: 9900,
  avgPrepMinutes: 20,
  capacityPerHour: 50,
  description: "",
});

/** Create or edit one kitchen/outlet. */
export const OutletForm: React.FC<{
  initial?: FoodPartnerOutlet;
  submitLabel: string;
  busy?: boolean;
  onSubmit: (value: FoodOutletInput) => void | Promise<unknown>;
  onCancel?: () => void;
}> = ({ initial, submitLabel, busy, onSubmit, onCancel }) => {
  const zones = useFoodZones();
  const [form, setForm] = useState<FoodOutletInput>(() =>
    initial
      ? {
          brandName: initial.brandName,
          address: initial.address,
          serviceZoneCodes: initial.serviceZoneCodes ?? [],
          fulfilmentModes: initial.fulfilmentModes ?? [],
          openTime: initial.openTime,
          closeTime: initial.closeTime,
          contactPhone: initial.contactPhone ?? "",
          minOrderPaise: initial.minOrderPaise,
          avgPrepMinutes: initial.avgPrepMinutes,
          capacityPerHour: initial.capacityPerHour,
          description: initial.description ?? "",
        }
      : emptyOutlet(),
  );
  const set = <K extends keyof FoodOutletInput>(key: K, value: FoodOutletInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const toggle = (key: "serviceZoneCodes" | "fulfilmentModes", value: string) =>
    setForm((f) => {
      const list = (f[key] ?? []) as string[];
      return {
        ...f,
        [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
      };
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const { contactPhone, description, ...rest } = form;
    onSubmit({
      ...rest,
      ...(contactPhone?.trim() ? { contactPhone: contactPhone.trim() } : {}),
      description: description?.trim() ?? "",
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Kitchen / outlet name" required>
          <input className={inputClass} required minLength={2} maxLength={120} value={form.brandName} onChange={(e) => set("brandName", e.target.value)} placeholder="e.g. Radha Rasoi, Raman Reti" />
        </Field>
        <Field label="Kitchen phone">
          <input className={inputClass} inputMode="tel" value={form.contactPhone ?? ""} onChange={(e) => set("contactPhone", cleanPhone(e.target.value))} placeholder="+91 98xxx xxxxx" />
        </Field>
      </div>
      <Field label="Full address" required>
        <input className={inputClass} required minLength={5} maxLength={300} value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Shop no., street, landmark, city" />
      </Field>
      <Field label="Short description" hint="Shown to customers on your outlet card.">
        <textarea className={inputClass} rows={2} maxLength={1000} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
      </Field>

      <Field label="Delivery zones you serve" required>
        <div className="flex flex-wrap gap-2">
          {zones.length === 0 && <span className="text-xs text-gray-400">Loading zones…</span>}
          {zones.map((z) => {
            const on = form.serviceZoneCodes.includes(z.zoneCode);
            return (
              <button
                key={z.zoneCode}
                type="button"
                onClick={() => toggle("serviceZoneCodes", z.zoneCode)}
                aria-pressed={on}
                className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold border transition-all ${on ? "bg-[#F28C28] border-[#F28C28] text-white" : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:border-[#F28C28]"}`}
              >
                {z.name}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="How customers receive food">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["pickup", "Pickup"],
              ["vendor_delivery", "Delivery by kitchen"],
              ["stay_delivery", "Delivery to ashram / stay"],
            ] as const
          ).map(([value, label]) => {
            const on = (form.fulfilmentModes ?? []).includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggle("fulfilmentModes", value)}
                aria-pressed={on}
                className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold border transition-all ${on ? "bg-[#0B192C] border-[#0B192C] text-white" : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300"}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </Field>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Field label="Opens">
          <input type="time" className={inputClass} value={form.openTime} onChange={(e) => set("openTime", e.target.value)} />
        </Field>
        <Field label="Closes">
          <input type="time" className={inputClass} value={form.closeTime} onChange={(e) => set("closeTime", e.target.value)} />
        </Field>
        <Field label="Min order (₹)">
          <input type="number" min={0} className={inputClass} value={(form.minOrderPaise ?? 0) / 100} onChange={(e) => set("minOrderPaise", Math.round(Number(e.target.value || 0) * 100))} />
        </Field>
        <Field label="Prep time (min)">
          <input type="number" min={1} max={240} className={inputClass} value={form.avgPrepMinutes} onChange={(e) => set("avgPrepMinutes", Number(e.target.value || 1))} />
        </Field>
        <Field label="Orders / hour">
          <input type="number" min={1} max={5000} className={inputClass} value={form.capacityPerHour} onChange={(e) => set("capacityPerHour", Number(e.target.value || 1))} />
        </Field>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <EnterpriseButton variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </EnterpriseButton>
        )}
        <EnterpriseButton type="submit" size="sm" loading={busy} disabled={busy || form.serviceZoneCodes.length === 0}>
          {submitLabel}
        </EnterpriseButton>
      </div>
      {form.serviceZoneCodes.length === 0 && (
        <p className="text-[10px] text-amber-600 text-right">Select at least one delivery zone.</p>
      )}
    </form>
  );
};

/** Business, contact, FSSAI and payout details of one restaurant. */
export const VendorDetailsForm: React.FC<{
  vendor: FoodVendor;
  busy?: boolean;
  onSubmit: (value: Partial<FoodVendor>) => void | Promise<unknown>;
}> = ({ vendor, busy, onSubmit }) => {
  const [form, setForm] = useState({
    businessName: vendor.businessName ?? "",
    contactName: vendor.contactName ?? "",
    contactPhone: vendor.contactPhone ?? "",
    contactEmail: vendor.contactEmail ?? "",
    fssaiReference: vendor.fssaiReference ?? "",
    bankAccountHolderName: vendor.bankAccountHolderName ?? "",
    bankName: vendor.bankName ?? "",
    // The saved account number is never sent back: type it again only to change it.
    bankAccountNumber: "",
    bankIfscCode: vendor.bankIfscCode ?? "",
  });
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Empty optional fields are left out: the API rejects blank phone/email.
    const payload: Record<string, string> = { businessName: form.businessName.trim() };
    for (const [k, v] of Object.entries(form)) {
      if (k !== "businessName" && v.trim()) payload[k] = v.trim();
    }
    onSubmit(payload);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Restaurant / business name" required>
          <input className={inputClass} required minLength={2} maxLength={120} value={form.businessName} onChange={(e) => set("businessName", e.target.value)} />
        </Field>
        <Field label="Contact person">
          <input className={inputClass} maxLength={120} value={form.contactName} onChange={(e) => set("contactName", e.target.value)} />
        </Field>
        <Field label="Contact phone">
          <input className={inputClass} inputMode="tel" value={form.contactPhone} onChange={(e) => set("contactPhone", cleanPhone(e.target.value))} />
        </Field>
        <Field label="Contact email">
          <input type="email" className={inputClass} value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
        </Field>
        <Field label="FSSAI licence number" hint="Needed before payouts are released.">
          <input className={inputClass} maxLength={40} value={form.fssaiReference} onChange={(e) => set("fssaiReference", e.target.value)} />
        </Field>
      </div>
      <div className="pt-2 border-t border-gray-100 dark:border-slate-800 space-y-1">
        <p className="text-xs font-black text-[#0B192C] dark:text-white">Where Tirvona sends your earnings</p>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          Customers pay Tirvona. After each settlement, Tirvona transfers your food value minus commission and GST on commission to this bank account.
          {vendor.hasBankDetails ? (
            <span className="text-emerald-600 font-bold"> Saved: account ending {vendor.bankAccountLast4}.</span>
          ) : (
            <span className="text-amber-600 font-bold"> Add these details to receive payouts.</span>
          )}
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Bank account holder">
          <input className={inputClass} value={form.bankAccountHolderName} onChange={(e) => set("bankAccountHolderName", e.target.value)} />
        </Field>
        <Field label="Bank name">
          <input className={inputClass} value={form.bankName} onChange={(e) => set("bankName", e.target.value)} />
        </Field>
        <Field label="Account number" hint={vendor.hasBankDetails ? "Leave empty to keep the saved account." : "9 to 18 digits."}>
          <input
            className={inputClass}
            inputMode="numeric"
            autoComplete="off"
            maxLength={18}
            placeholder={vendor.hasBankDetails ? `•••• ${vendor.bankAccountLast4}` : ""}
            value={form.bankAccountNumber}
            onChange={(e) => set("bankAccountNumber", e.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <Field label="IFSC code" hint="11 characters, e.g. HDFC0001234.">
          <input className={inputClass} maxLength={11} value={form.bankIfscCode} onChange={(e) => set("bankIfscCode", e.target.value.toUpperCase())} />
        </Field>
      </div>
      <div className="flex justify-end">
        <EnterpriseButton type="submit" size="sm" loading={busy} disabled={busy}>
          Save details
        </EnterpriseButton>
      </div>
    </form>
  );
};
