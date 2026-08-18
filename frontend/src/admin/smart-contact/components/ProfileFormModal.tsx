import React, { useMemo, useState } from "react";
import {
  smartContactService,
  type SmartContactProfile,
} from "../../../services/smartContact.service";
import { getErrorMessage } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import { EnterpriseButton, EnterpriseModal } from "../../shared";
import { FileUploader } from "../../../components/FileUploader";
import { AlertTriangle, ContactRound, Loader2 } from "lucide-react";

const inputClass =
  "w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6]";

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

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="space-y-3">
    <h4 className="text-[11px] font-black uppercase tracking-wider text-[#0A4DA6]">
      {title}
    </h4>
    {children}
  </div>
);

interface FormState {
  firstName: string;
  lastName: string;
  displayName: string;
  slug: string;
  employeeId: string;
  photoUrl: string;
  organization: string;
  designation: string;
  department: string;
  roleLine: string;
  primaryPhone: string;
  secondaryPhone: string;
  whatsappPhone: string;
  email: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  district: string;
  state: string;
  postalCode: string;
  country: string;
  brandId: string;
  category: string;
}

const BLANK: FormState = {
  firstName: "",
  lastName: "",
  displayName: "",
  slug: "",
  employeeId: "",
  photoUrl: "",
  organization: "Tirvona",
  designation: "",
  department: "",
  roleLine: "",
  primaryPhone: "",
  secondaryPhone: "",
  whatsappPhone: "",
  email: "",
  website: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  district: "",
  state: "",
  postalCode: "",
  country: "India",
  brandId: "tirvona",
  category: "employee",
};

/** Mirrors the server's slugify so the preview matches what will be saved. */
const previewSlug = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Create / edit form for a Smart Contact profile (spec §19).
 *
 * The slug gets more prominence than an ordinary field because it is the one
 * value here that is effectively permanent — every printed QR encodes it. On
 * edit it is locked behind an explicit confirmation, which is also what the
 * API requires.
 */
export const ProfileFormModal: React.FC<{
  profile?: SmartContactProfile;
  onClose: () => void;
  onSaved: () => void;
}> = ({ profile, onClose, onSaved }) => {
  const editing = Boolean(profile);
  const [form, setForm] = useState<FormState>(() =>
    profile
      ? {
          ...BLANK,
          ...(Object.fromEntries(
            Object.keys(BLANK).map((key) => [
              key,
              (profile as unknown as Record<string, string>)[key] ?? "",
            ]),
          ) as unknown as FormState),
        }
      : BLANK,
  );
  const [allowSlugChange, setAllowSlugChange] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const derivedSlug = useMemo(() => {
    if (form.slug) return previewSlug(form.slug);
    const name =
      form.displayName || `${form.firstName} ${form.lastName}`.trim();
    return previewSlug(name);
  }, [form.slug, form.displayName, form.firstName, form.lastName]);

  const slugLocked = editing && !allowSlugChange;

  const submit = async () => {
    setError("");
    if (!form.firstName.trim()) {
      setError("A first name is required.");
      return;
    }
    if (!form.primaryPhone.trim() && !form.email.trim()) {
      setError("Add a primary phone or an email — a contact card needs one.");
      return;
    }

    setSaving(true);
    try {
      // Empty strings are sent as-is so clearing a field actually clears it;
      // the exception is the slug, which is omitted entirely when locked so
      // the server never sees an attempted change.
      const payload: Record<string, unknown> = { ...form };
      if (slugLocked) delete payload.slug;
      else payload.slug = derivedSlug;
      if (editing && allowSlugChange) payload.allowSlugChange = true;

      if (editing && profile) {
        await smartContactService.update(profile.id, payload);
        toast.success("Profile updated");
      } else {
        await smartContactService.create(payload);
        toast.success("Profile created as a draft. Activate it when ready.");
      }
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Could not save this profile."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <EnterpriseModal
      isOpen
      onClose={onClose}
      maxWidth="3xl"
      icon={<ContactRound size={18} />}
      title={editing ? "Edit Smart Contact" : "Create Smart Contact"}
      subtitle={
        editing
          ? "Changes appear on the public page and in future vCard downloads immediately. Printed QR codes are unaffected."
          : "The profile is created as a draft. Activate it to make the public page live."
      }
      footer={
        <div className="flex justify-end gap-2">
          <EnterpriseButton variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </EnterpriseButton>
          <EnterpriseButton onClick={() => void submit()} disabled={saving}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {editing ? "Save changes" : "Create profile"}
          </EnterpriseButton>
        </div>
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-bold text-red-700 dark:text-red-300 flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Section title="Identity">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="First name *">
              <input
                className={inputClass}
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
              />
            </Field>
            <Field label="Last name">
              <input
                className={inputClass}
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
              />
            </Field>
            <Field
              label="Display name"
              hint="Shown on the contact page. Defaults to first + last name."
            >
              <input
                className={inputClass}
                value={form.displayName}
                onChange={(e) => set("displayName", e.target.value)}
              />
            </Field>
            <Field label="Employee ID">
              <input
                className={inputClass}
                value={form.employeeId}
                onChange={(e) => set("employeeId", e.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Profile slug"
            hint={
              slugLocked
                ? "Locked. Every printed QR code encodes this — changing it breaks cards already in circulation."
                : "Permanent once cards are printed. Lowercase letters, numbers and hyphens."
            }
          >
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-gray-400 shrink-0">
                tirvona.com/c/
              </span>
              <input
                className={`${inputClass} ${slugLocked ? "opacity-60" : ""}`}
                value={form.slug || derivedSlug}
                disabled={slugLocked}
                onChange={(e) => set("slug", e.target.value)}
              />
            </div>
          </Field>

          {editing && (
            <label className="flex items-start gap-2 text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={allowSlugChange}
                onChange={(e) => setAllowSlugChange(e.target.checked)}
              />
              <span>
                Allow changing the slug. Existing printed QR codes will stop
                resolving to this profile.
              </span>
            </label>
          )}

          <Field label="Photograph">
            {/*
              Reuses the platform's existing uploader, so this module never
              handles file bytes — the Cloudinary pipeline that already does
              validation and transformation stays the only upload path.
            */}
            <FileUploader
              folder="smart-contact/photos"
              currentUrl={form.photoUrl}
              onUploaded={(url) => set("photoUrl", url)}
              accept="image/*"
              label="Upload photograph"
            />
          </Field>
        </Section>

        <Section title="Organization">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Company">
              <input
                className={inputClass}
                value={form.organization}
                onChange={(e) => set("organization", e.target.value)}
              />
            </Field>
            <Field label="Designation">
              <input
                className={inputClass}
                value={form.designation}
                onChange={(e) => set("designation", e.target.value)}
                placeholder="Business Executive"
              />
            </Field>
            <Field label="Department">
              <input
                className={inputClass}
                value={form.department}
                onChange={(e) => set("department", e.target.value)}
              />
            </Field>
            <Field label="Role line" hint="e.g. Partnerships | Stay Onboarding">
              <input
                className={inputClass}
                value={form.roleLine}
                onChange={(e) => set("roleLine", e.target.value)}
              />
            </Field>
          </div>
        </Section>

        <Section title="Contact">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Primary mobile" hint="10 digits assumes +91.">
              <input
                className={inputClass}
                value={form.primaryPhone}
                onChange={(e) => set("primaryPhone", e.target.value)}
              />
            </Field>
            <Field label="Secondary mobile">
              <input
                className={inputClass}
                value={form.secondaryPhone}
                onChange={(e) => set("secondaryPhone", e.target.value)}
              />
            </Field>
            <Field label="WhatsApp number" hint="Defaults to the primary mobile.">
              <input
                className={inputClass}
                value={form.whatsappPhone}
                onChange={(e) => set("whatsappPhone", e.target.value)}
              />
            </Field>
            <Field label="Email">
              <input
                className={inputClass}
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
            <Field label="Website">
              <input
                className={inputClass}
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
                placeholder="www.tirvona.com"
              />
            </Field>
          </div>
        </Section>

        <Section title="Office address">
          <p className="text-[10px] text-gray-400 -mt-1">
            Business address only. Never a home address or personal identifiers.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Address line 1">
              <input
                className={inputClass}
                value={form.addressLine1}
                onChange={(e) => set("addressLine1", e.target.value)}
              />
            </Field>
            <Field label="Address line 2">
              <input
                className={inputClass}
                value={form.addressLine2}
                onChange={(e) => set("addressLine2", e.target.value)}
              />
            </Field>
            <Field label="City">
              <input
                className={inputClass}
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </Field>
            <Field label="District">
              <input
                className={inputClass}
                value={form.district}
                onChange={(e) => set("district", e.target.value)}
              />
            </Field>
            <Field label="State">
              <input
                className={inputClass}
                value={form.state}
                onChange={(e) => set("state", e.target.value)}
              />
            </Field>
            <Field label="Postal code">
              <input
                className={inputClass}
                value={form.postalCode}
                onChange={(e) => set("postalCode", e.target.value)}
              />
            </Field>
            <Field label="Country">
              <input
                className={inputClass}
                value={form.country}
                onChange={(e) => set("country", e.target.value)}
              />
            </Field>
          </div>
        </Section>

        <Section title="Classification">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Audience">
              <select
                className={inputClass}
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
              >
                <option value="employee">Employee</option>
                <option value="partner">Partner</option>
                <option value="district-partner">District Partner</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Brand">
              <select
                className={inputClass}
                value={form.brandId}
                onChange={(e) => set("brandId", e.target.value)}
              >
                <option value="tirvona">Tirvona</option>
                <option value="mission-ftc">Mission FTC</option>
                <option value="nep">Other NEP platform</option>
              </select>
            </Field>
          </div>
        </Section>
      </div>
    </EnterpriseModal>
  );
};
