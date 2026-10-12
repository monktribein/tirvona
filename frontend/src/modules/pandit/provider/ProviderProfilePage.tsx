/**
 * Provider Profile Page: create and edit the provider's own profile.
 * Routes: /provider/profile (edit) and /provider/profile/new (create)
 *
 *   GET   /api/v2/provider/profile   prefill the form
 *   POST  /api/v2/provider/profile   create
 *   PATCH /api/v2/provider/profile   update
 */

import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bed, Bus, Car, Save, Upload, X } from "lucide-react";
import { providerSelfService } from "../services/provider.service";
import type { ProviderProfile, CreateProviderProfileInput } from "../types/provider.types";
import { PROVIDER_TYPES, PROVIDER_TYPE_LABELS, STAY_ARRANGEMENT_LABELS, TRAVEL_MODE_LABELS, type TravelProfile } from "../types/provider.types";
import { getErrorMessage } from "../../../lib/api";
import { uploadService } from "../../../services";
import { toast } from "../../../lib/toast";
import { Avatar, Button, ErrorNotice, Field, LoadingBlock, PageContainer, SectionCard, Toggle, cx, inputClass } from "../ui";

const TRAVEL_MODE_ICONS: Record<string, React.ReactNode> = {
  TRAIN: <Bus size={16} aria-hidden="true" />,
  FLIGHT: <span aria-hidden="true">✈</span>,
  ROAD: <Car size={16} aria-hidden="true" />,
};

/** Only the travel fields the server accepts, with blanks left out. */
const cleanTravel = (t: TravelProfile): TravelProfile => {
  const out: TravelProfile = { willingToTravel: Boolean(t.willingToTravel) };
  if (!t.willingToTravel) return out;
  out.overnightOk = Boolean(t.overnightOk);
  out.modes = (t.modes ?? []).filter((m) => m in TRAVEL_MODE_LABELS);
  if (t.maxDistanceKm != null && String(t.maxDistanceKm) !== "") out.maxDistanceKm = Number(t.maxDistanceKm);
  if (t.overnightOk && t.stayArrangement) out.stayArrangement = t.stayArrangement;
  if (t.notes?.trim()) out.notes = t.notes.trim();
  if (t.minNoticeHours != null) out.minNoticeHours = t.minNoticeHours;
  if (t.regions?.length) out.regions = t.regions;
  return out;
};

/** Mirrors the backend's controlled language list. */
const SUPPORTED_LANGUAGES = [
  "Sanskrit", "Hindi", "English", "Tamil", "Telugu", "Kannada", "Malayalam", "Bengali", "Marathi",
  "Gujarati", "Punjabi", "Odia", "Assamese", "Maithili", "Bhojpuri", "Nepali", "Urdu",
];

const PHONE = /^\+?[0-9][0-9\s-]{6,17}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_AVATAR_BYTES = 10 * 1024 * 1024;

type Errors = Partial<Record<"displayName" | "legalName" | "languages" | "experience" | "email" | "phone" | "travel" | "distance", string>>;

// ─── TagInput ─────────────────────────────────────────────────────────────────

const TagInput: React.FC<{
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  maxItems?: number;
  id?: string;
  "aria-describedby"?: string;
}> = ({ value, onChange, placeholder = "Type and press Enter", maxItems = 30, id, "aria-describedby": describedBy }) => {
  const [input, setInput] = useState("");

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed) && value.length < maxItems) onChange([...value, trimmed]);
    setInput("");
  };

  return (
    <div className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-xl border border-gray-300 bg-white p-2 focus-within:border-[#F28C28] focus-within:ring-2 focus-within:ring-[#F28C28]/30 dark:border-slate-700 dark:bg-slate-900">
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-[#FFF4E5] py-0.5 pl-2.5 pr-1 text-sm font-medium text-[#92400E] dark:bg-[#F28C28]/15 dark:text-[#FFA44D]">
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            aria-label={`Remove ${tag}`}
            className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-[#FFE4C4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28] dark:hover:bg-[#F28C28]/25"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        id={id}
        aria-describedby={describedBy}
        className="min-w-[140px] flex-1 bg-transparent px-1 py-1 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={value.length < maxItems ? placeholder : "Limit reached"}
        disabled={value.length >= maxItems}
      />
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const ProviderProfilePage: React.FC = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [typeLocked, setTypeLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [travel, setTravel] = useState<TravelProfile>({ willingToTravel: false, overnightOk: false, modes: [] });
  const setTravelField = (patch: Partial<TravelProfile>) => setTravel((t) => ({ ...t, ...patch }));

  const [form, setForm] = useState<CreateProviderProfileInput>({
    displayName: "",
    providerType: "PANDIT",
    bio: "",
    avatarUrl: "",
    languages: [],
    specializations: [],
    traditions: [],
    experienceYears: undefined,
    homeCity: "",
    homeState: "",
    contactEmail: "",
    contactPhone: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await providerSelfService.getProfile();
      if (res.data?.success) {
        const p = res.data.data as ProviderProfile;
        setForm({
          displayName: p.displayName,
          legalName: p.legalName,
          providerType: p.providerType,
          bio: p.bio || "",
          avatarUrl: p.avatarUrl || "",
          languages: p.languages || [],
          specializations: p.specializations || [],
          traditions: p.traditions || [],
          experienceYears: p.experienceYears,
          homeCity: p.homeCity || "",
          homeState: p.homeState || "",
          contactEmail: p.contactEmail || "",
          contactPhone: p.contactPhone || "",
        });
        setTravel({ willingToTravel: false, overnightOk: false, modes: [], ...(p.travelProfile ?? {}) });
        setTypeLocked(p.verificationLevel !== "UNVERIFIED");
        setIsNew(false);
      }
    } catch (err: any) {
      if (err?.response?.status === 404) setIsNew(true);
      else setError(getErrorMessage(err, "Failed to load your profile."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key: keyof CreateProviderProfileInput, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast.error("Please choose a JPG, PNG or WebP image.");
    if (file.size > MAX_AVATAR_BYTES) return toast.error("That image is larger than 10 MB.");
    setAvatarUploading(true);
    try {
      const url = await uploadService.file(file, "provider-avatars");
      set("avatarUrl", url);
      toast.success("Photo uploaded. Save your profile to publish it.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Photo upload failed."));
    } finally {
      setAvatarUploading(false);
    }
  };

  const validate = (): boolean => {
    const next: Errors = {};
    if (!form.displayName?.trim() || form.displayName.trim().length < 2) next.displayName = "Enter the name devotees will see (at least 2 characters).";
    if (form.legalName && form.legalName.trim().length < 2) next.legalName = "Enter your full legal name or leave this empty.";
    if (!form.languages?.length) next.languages = "Choose at least one language.";
    if (form.experienceYears != null && (!Number.isInteger(form.experienceYears) || form.experienceYears < 0 || form.experienceYears > 80)) next.experience = "Enter whole years between 0 and 80.";
    if (form.contactEmail && !EMAIL.test(form.contactEmail)) next.email = "Enter a valid email address.";
    if (form.contactPhone && !PHONE.test(form.contactPhone)) next.phone = "Enter a valid phone number, for example +91 98765 43210.";
    if (travel.willingToTravel && !(travel.modes ?? []).length) next.travel = "Choose at least one way you travel.";
    if (travel.maxDistanceKm != null && String(travel.maxDistanceKm) !== "" && (!Number.isInteger(Number(travel.maxDistanceKm)) || Number(travel.maxDistanceKm) < 0 || Number(travel.maxDistanceKm) > 5000))
      next.distance = "Enter whole kilometres between 0 and 5000.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    // Empty optional text fields are left out so they are not validated as values.
    const payload: CreateProviderProfileInput = {
      ...form,
      displayName: form.displayName.trim(),
      legalName: form.legalName?.trim() || undefined,
      avatarUrl: form.avatarUrl || undefined,
      contactEmail: form.contactEmail?.trim() || undefined,
      contactPhone: form.contactPhone?.trim() || undefined,
      travelProfile: cleanTravel(travel),
    };
    setSaving(true);
    try {
      if (isNew) {
        await providerSelfService.createProfile(payload);
        toast.success("Profile created. Complete the remaining steps to go live.");
      } else {
        await providerSelfService.updateProfile(payload);
        toast.success("Profile saved.");
      }
      navigate("/provider/dashboard");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save your profile."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <LoadingBlock label="Loading your profile" />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="max-w-3xl">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="flex h-11 w-11 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28] dark:text-gray-300 dark:hover:bg-slate-800"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-black text-[#0B192C] dark:text-white">{isNew ? "Create your provider profile" : "Edit your profile"}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{isNew ? "Tell devotees who you are. You can change this later." : "This is what devotees see on your public page."}</p>
        </div>
      </div>

      {error && <ErrorNotice message={error} />}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <SectionCard title="Profile photo" description="A clear face photo builds trust. JPG, PNG or WebP, up to 10 MB.">
          <div className="flex items-center gap-4">
            <Avatar name={form.displayName || "P"} src={form.avatarUrl} size={80} />
            <div className="flex flex-wrap items-center gap-2">
              <label
                className={cx(
                  "inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-gray-300 px-5 text-sm font-bold text-[#0B192C] focus-within:ring-2 focus-within:ring-[#F28C28] hover:bg-gray-50 dark:border-slate-600 dark:text-gray-100 dark:hover:bg-slate-800",
                  avatarUploading && "pointer-events-none opacity-60",
                )}
              >
                <Upload size={16} aria-hidden="true" />
                {avatarUploading ? "Uploading…" : form.avatarUrl ? "Change photo" : "Upload photo"}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleAvatarUpload} disabled={avatarUploading} />
              </label>
              {form.avatarUrl && (
                <Button variant="ghost" onClick={() => set("avatarUrl", "")}>
                  Remove
                </Button>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="About you">
          <div className="space-y-4">
            <Field label="Display name" required error={errors.displayName} hint="The public name devotees will see.">
              <input type="text" className={inputClass} value={form.displayName} maxLength={120} onChange={(e) => set("displayName", e.target.value)} placeholder="Pandit Ramacharya Shastri" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Legal name" error={errors.legalName} hint="As on your ID. Never shown publicly.">
                <input type="text" className={inputClass} value={form.legalName || ""} maxLength={120} onChange={(e) => set("legalName", e.target.value)} />
              </Field>
              <Field label="Provider type" required hint={typeLocked ? "Locked after identity verification." : undefined}>
                <select className={inputClass} value={form.providerType} disabled={typeLocked} onChange={(e) => set("providerType", e.target.value)}>
                  {PROVIDER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {PROVIDER_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Biography" hint="Your practice, training and what makes your service special. At least 30 characters counts towards profile completion.">
              <textarea rows={5} className={inputClass} value={form.bio || ""} maxLength={1000} onChange={(e) => set("bio", e.target.value)} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Experience (years)" error={errors.experience}>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={80}
                  className={inputClass}
                  value={form.experienceYears ?? ""}
                  onChange={(e) => set("experienceYears", e.target.value === "" ? undefined : Number(e.target.value))}
                />
              </Field>
              <Field label="Home city">
                <input type="text" className={inputClass} value={form.homeCity || ""} maxLength={80} onChange={(e) => set("homeCity", e.target.value)} placeholder="Varanasi" />
              </Field>
              <Field label="State">
                <input type="text" className={inputClass} value={form.homeState || ""} maxLength={80} onChange={(e) => set("homeState", e.target.value)} placeholder="Uttar Pradesh" />
              </Field>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Languages and specialties">
          <div className="space-y-4">
            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold text-gray-800 dark:text-gray-200">
                Languages <span className="text-rose-600" aria-hidden="true">*</span>
                <span className="sr-only"> (required)</span>
              </legend>
              <p className="mb-2 text-xs text-gray-500">Choose every language you can conduct pujas in.</p>
              <div className="flex flex-wrap gap-2">
                {SUPPORTED_LANGUAGES.map((lang) => {
                  const on = (form.languages || []).includes(lang);
                  return (
                    <button
                      key={lang}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set("languages", on ? (form.languages || []).filter((l) => l !== lang) : [...(form.languages || []), lang])}
                      className={cx(
                        "min-h-[40px] rounded-full border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28] focus-visible:ring-offset-1",
                        on ? "border-[#0B192C] bg-[#0B192C] text-white" : "border-gray-300 bg-white text-gray-700 hover:border-[#F28C28] dark:border-slate-600 dark:bg-slate-900 dark:text-gray-300",
                      )}
                    >
                      {on ? "✓ " : ""}
                      {lang}
                    </button>
                  );
                })}
              </div>
              {errors.languages && (
                <p role="alert" className="mt-1.5 text-xs font-semibold text-rose-700">
                  {errors.languages}
                </p>
              )}
            </fieldset>
            <Field label="Specialties" hint="Pujas and rituals you specialise in. Press Enter after each.">
              <TagInput value={form.specializations || []} onChange={(v) => set("specializations", v)} placeholder="e.g. Vivah Puja, Rudrabhishek" />
            </Field>
            <Field label="Tradition or lineage" hint="For example Shankaracharya Sampradaya or Nimbarka.">
              <TagInput value={form.traditions || []} onChange={(v) => set("traditions", v)} placeholder="e.g. Vaishnava, Shaiva" maxItems={10} />
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="Home visits & travel" description="Tell devotees whether you can come to their home, how you travel and where you stay. Shown on your public profile.">
          <div className="space-y-4">
            <Toggle
              checked={Boolean(travel.willingToTravel)}
              onChange={(next) => setTravelField({ willingToTravel: next })}
              label="I travel to devotees' homes, including other cities"
              description="Devotees can book you for a puja or katha at their home."
            />
            {travel.willingToTravel && (
              <>
                <Field label="How I can travel" required error={errors.travel} hint="Choose every way you are comfortable travelling.">
                  <div role="group" className="flex flex-wrap gap-2">
                    {Object.entries(TRAVEL_MODE_LABELS).map(([mode, label]) => {
                      const on = (travel.modes ?? []).includes(mode);
                      return (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            setTravelField({ modes: on ? (travel.modes ?? []).filter((m) => m !== mode) : [...(travel.modes ?? []), mode] })
                          }
                          className={cx(
                            "inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28]",
                            on
                              ? "border-[#F28C28] bg-[#FFF4E5] text-[#B45309] dark:bg-[#F28C28]/15 dark:text-[#FFC88A]"
                              : "border-gray-300 text-gray-700 hover:border-[#F28C28] dark:border-slate-600 dark:text-gray-300",
                          )}
                        >
                          {TRAVEL_MODE_ICONS[mode]}
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field label="Maximum distance (km)" error={errors.distance} hint="Leave empty for no limit.">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={5000}
                    className={inputClass}
                    value={travel.maxDistanceKm ?? ""}
                    onChange={(e) => setTravelField({ maxDistanceKm: e.target.value === "" ? null : Number(e.target.value) })}
                    placeholder="e.g. 800"
                  />
                </Field>
                <Toggle
                  checked={Boolean(travel.overnightOk)}
                  onChange={(next) => setTravelField({ overnightOk: next })}
                  label="I can stay overnight for longer pujas and kathas"
                  description="For multi-day kathas or pujas far from home."
                />
                {travel.overnightOk && (
                  <Field label="Where I stay">
                    <div role="radiogroup" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {Object.entries(STAY_ARRANGEMENT_LABELS).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={travel.stayArrangement === value}
                          onClick={() => setTravelField({ stayArrangement: value })}
                          className={cx(
                            "flex min-h-[44px] items-center gap-2 rounded-xl border px-3 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28]",
                            travel.stayArrangement === value
                              ? "border-[#F28C28] bg-[#FFF4E5] text-[#B45309] dark:bg-[#F28C28]/15 dark:text-[#FFC88A]"
                              : "border-gray-300 text-gray-700 hover:border-[#F28C28] dark:border-slate-600 dark:text-gray-300",
                          )}
                        >
                          <Bed size={15} aria-hidden="true" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </Field>
                )}
                <Field label="Note for devotees" hint="Optional. e.g. Travel tickets and stay are arranged by the family; I bring all puja samagri.">
                  <textarea
                    rows={2}
                    maxLength={300}
                    className={inputClass}
                    value={travel.notes ?? ""}
                    onChange={(e) => setTravelField({ notes: e.target.value })}
                  />
                </Field>
              </>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Private contact details" description="Only Tirvona administrators and verification reviewers can see these.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Contact email" error={errors.email}>
              <input type="email" autoComplete="email" className={inputClass} value={form.contactEmail || ""} onChange={(e) => set("contactEmail", e.target.value)} />
            </Field>
            <Field label="Contact phone" error={errors.phone}>
              <input type="tel" autoComplete="tel" inputMode="tel" className={inputClass} value={form.contactPhone || ""} onChange={(e) => set("contactPhone", e.target.value)} placeholder="+91 98765 43210" />
            </Field>
          </div>
        </SectionCard>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            <Save size={16} aria-hidden="true" />
            {saving ? "Saving…" : isNew ? "Create profile" : "Save changes"}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
};

export default ProviderProfilePage;
