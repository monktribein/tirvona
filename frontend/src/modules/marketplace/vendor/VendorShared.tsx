/* oxlint-disable react/only-export-components -- seller console shared pieces */
import React, { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { AlertTriangle, BadgeCheck, Clock, ShieldAlert } from "lucide-react";
import { vendorApi } from "../../../services/marketplace.service";
import { EnterpriseButton } from "../../../admin/shared/components/EnterpriseButton";
import { FileUploader } from "../../../components/FileUploader";
import { Field, PanelState, inputClass, useAction, useRemote } from "../ui";

export interface VendorProfile {
  _id: string;
  storeName: string;
  slug: string;
  legalBusinessName?: string;
  businessType?: string;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: {
    line1?: string;
    line2?: string;
    landmark?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  logoUrl?: string;
  gstin?: string;
  status: string;
  rejectionReason?: string;
  suspensionReason?: string;
  documents?: Array<{
    _id: string;
    type: string;
    fileUrl: string;
    fileName?: string;
    documentNumberMasked?: string;
    status: "pending" | "verified" | "rejected";
    reviewNote?: string;
    createdAt?: string;
  }>;
  bankAccounts?: Array<{ _id: string; verificationStatus?: string }>;
  missingDocuments?: string[];
}

/** The caller's own store; state is "missing" when they have no store yet (API returns null). */
export const useVendorProfile = () => {
  const remote = useRemote<VendorProfile>(() => vendorApi.profile(), []);
  return remote.state === "ready" && !remote.data ? { ...remote, state: "missing" as const } : remote;
};

/** Renders children only when the caller has a store; otherwise sends them to onboarding. */
export const RequireStore: React.FC<{ children: (vendor: VendorProfile, reload: () => void) => React.ReactNode }> = ({
  children,
}) => {
  const { data, state, error, reload } = useVendorProfile();
  if (state === "missing") return <Navigate to="/vendor/onboarding" replace />;
  if (state !== "ready" || !data) return <PanelState state={state} error={error} onRetry={reload} />;
  return <>{children(data, reload)}</>;
};

const STATUS_COPY: Record<string, { tone: "info" | "warn" | "bad" | "ok"; title: string; text: string }> = {
  draft: {
    tone: "info",
    title: "Waiting for Tirvona to approve your shop",
    text: "You can add products as drafts now. Documents, address and bank details are optional and can be added any time.",
  },
  pending_verification: {
    tone: "warn",
    title: "Your vendor application is under review",
    text: "Tirvona is reviewing your shop. You can prepare products as drafts meanwhile.",
  },
  under_review: {
    tone: "warn",
    title: "Your vendor application is under review",
    text: "A Tirvona reviewer is checking your application. We will notify you once it is decided.",
  },
  approved: {
    tone: "ok",
    title: "Approved! One step left",
    text: "Activate your store to start selling. You can add a bank account later, before requesting a payout.",
  },
  suspended: {
    tone: "bad",
    title: "Your store is currently suspended",
    text: "Your products are hidden from customers. Contact Tirvona support to resolve this.",
  },
  rejected: {
    tone: "bad",
    title: "Your application was not approved",
    text: "Fix the issue below, update your details or documents, and submit again.",
  },
  deactivated: {
    tone: "bad",
    title: "This store is deactivated",
    text: "It no longer sells on Tirvona. Contact support if you want to reopen it.",
  },
};

export const VendorStatusBanner: React.FC<{ vendor: VendorProfile; showAction?: boolean }> = ({ vendor, showAction = true }) => {
  const copy = STATUS_COPY[vendor.status];
  if (!copy) return null;
  const reason = vendor.status === "rejected" ? vendor.rejectionReason : vendor.status === "suspended" ? vendor.suspensionReason : undefined;
  const tone =
    copy.tone === "bad"
      ? "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-300"
      : copy.tone === "warn"
        ? "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-300"
        : copy.tone === "ok"
          ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300"
          : "bg-orange-50 border-orange-200 text-orange-900 dark:bg-orange-950/30 dark:border-orange-900 dark:text-orange-200";
  const Icon = copy.tone === "bad" ? ShieldAlert : copy.tone === "warn" ? Clock : copy.tone === "ok" ? BadgeCheck : AlertTriangle;
  return (
    <div className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${tone}`} role="status">
      <Icon size={20} className="shrink-0" />
      <div className="flex-1 min-w-0 text-xs space-y-0.5">
        <p className="font-black">{copy.title}</p>
        <p className="leading-relaxed">{copy.text}</p>
        {reason && (
          <p className="font-bold">
            Reason: <span className="font-semibold">{reason}</span>
          </p>
        )}
      </div>
      {showAction && ["draft", "rejected", "approved"].includes(vendor.status) && (
        <Link
          to="/vendor/onboarding"
          className="shrink-0 px-4 py-2 rounded-full bg-[#F28C28] hover:bg-[#D97706] text-white text-xs font-extrabold text-center"
        >
          {vendor.status === "approved" ? "Activate store" : "Continue application"}
        </Link>
      )}
    </div>
  );
};

export const BUSINESS_TYPES = [
  ["individual", "Individual"],
  ["proprietorship", "Sole proprietorship"],
  ["partnership", "Partnership"],
  ["llp", "LLP"],
  ["private_limited", "Private limited company"],
  ["trust", "Trust"],
  ["society", "Society"],
  ["temple", "Temple"],
  ["other", "Other"],
] as const;

const emptyProfile = {
  storeName: "",
  legalBusinessName: "",
  businessType: "individual",
  description: "",
  contactEmail: "",
  contactPhone: "",
  logoUrl: "",
  gstin: "",
  line1: "",
  line2: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
};

/**
 * Store profile form, used both to create a store (Become a Seller) and to
 * edit it. Legal fields lock once the store is submitted, as the backend does.
 */
export const StoreProfileForm: React.FC<{ vendor?: VendorProfile | null; onSaved: () => void }> = ({ vendor, onSaved }) => {
  const [form, setForm] = useState(() =>
    vendor
      ? {
          ...emptyProfile,
          storeName: vendor.storeName ?? "",
          legalBusinessName: vendor.legalBusinessName ?? "",
          businessType: vendor.businessType ?? "individual",
          description: vendor.description ?? "",
          contactEmail: vendor.contactEmail ?? "",
          contactPhone: vendor.contactPhone ?? "",
          logoUrl: vendor.logoUrl ?? "",
          gstin: vendor.gstin ?? "",
          line1: vendor.address?.line1 ?? "",
          line2: vendor.address?.line2 ?? "",
          landmark: vendor.address?.landmark ?? "",
          city: vendor.address?.city ?? "",
          state: vendor.address?.state ?? "",
          pincode: vendor.address?.pincode ?? "",
        }
      : emptyProfile,
  );
  const { busy, run } = useAction();
  const legalLocked = Boolean(vendor && !["draft", "rejected"].includes(vendor.status));
  const set = (key: keyof typeof emptyProfile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const hasAddress = form.line1 || form.city || form.state || form.pincode;
    const payload: Record<string, unknown> = {
      storeName: form.storeName.trim(),
      description: form.description.trim() || undefined,
      contactEmail: form.contactEmail.trim() || undefined,
      contactPhone: form.contactPhone.replace(/\s+/g, "") || undefined,
      logoUrl: form.logoUrl || undefined,
      ...(hasAddress
        ? {
            address: {
              line1: form.line1.trim(),
              line2: form.line2.trim() || undefined,
              landmark: form.landmark.trim() || undefined,
              city: form.city.trim(),
              state: form.state.trim(),
              pincode: form.pincode.trim(),
            },
          }
        : {}),
    };
    if (!legalLocked) {
      payload.legalBusinessName = form.legalBusinessName.trim() || undefined;
      payload.businessType = form.businessType;
      payload.gstin = form.gstin.trim() || undefined;
    }
    run(
      "save",
      () => (vendor ? vendorApi.updateProfile(payload) : vendorApi.createProfile(payload)),
      onSaved,
      vendor ? "Store profile saved" : "Your store has been created",
    );
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label="Store name" required hint="Shown to customers on your public store page.">
        <input className={inputClass} value={form.storeName} onChange={set("storeName")} minLength={3} maxLength={80} required />
      </Field>
      <Field label="Business type">
        <select className={inputClass} value={form.businessType} onChange={set("businessType")} disabled={legalLocked}>
          {BUSINESS_TYPES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Legal business name" hint={legalLocked ? "Locked after verification. Contact support to change it." : undefined}>
        <input className={inputClass} value={form.legalBusinessName} onChange={set("legalBusinessName")} maxLength={160} disabled={legalLocked} />
      </Field>
      <Field label="GSTIN" hint={legalLocked ? "Locked after verification." : "Optional. 15-character GST number."}>
        <input className={`${inputClass} uppercase`} value={form.gstin} onChange={set("gstin")} maxLength={15} disabled={legalLocked} />
      </Field>
      <Field label="Store description" className="sm:col-span-2">
        <textarea className={inputClass} rows={3} value={form.description} onChange={set("description")} maxLength={2000} />
      </Field>
      <Field label="Contact email" hint="Private: used by Tirvona, never shown to customers.">
        <input type="email" className={inputClass} value={form.contactEmail} onChange={set("contactEmail")} />
      </Field>
      <Field label="Contact phone" required hint="Private. Required before you submit for verification.">
        <input className={inputClass} value={form.contactPhone} onChange={set("contactPhone")} inputMode="tel" pattern="\+?[0-9 ]{10,15}" />
      </Field>
      <Field label="Address line 1" className="sm:col-span-2" hint="Only the city and state appear on your public store page.">
        <input className={inputClass} value={form.line1} onChange={set("line1")} maxLength={200} />
      </Field>
      <Field label="Address line 2">
        <input className={inputClass} value={form.line2} onChange={set("line2")} maxLength={200} />
      </Field>
      <Field label="Landmark">
        <input className={inputClass} value={form.landmark} onChange={set("landmark")} maxLength={120} />
      </Field>
      <Field label="City">
        <input className={inputClass} value={form.city} onChange={set("city")} maxLength={80} />
      </Field>
      <Field label="State">
        <input className={inputClass} value={form.state} onChange={set("state")} maxLength={80} />
      </Field>
      <Field label="Pincode">
        <input className={inputClass} value={form.pincode} onChange={set("pincode")} inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} />
      </Field>
      <div className="sm:col-span-2">
        <FileUploader
          folder="marketplace/stores"
          label="Store logo"
          accept="image/*"
          currentUrl={form.logoUrl || undefined}
          onUploaded={(url) => setForm((f) => ({ ...f, logoUrl: url }))}
        />
      </div>
      <div className="sm:col-span-2 flex justify-end">
        <EnterpriseButton type="submit" loading={busy === "save"}>
          {vendor ? "Save store profile" : "Create my store"}
        </EnterpriseButton>
      </div>
    </form>
  );
};
