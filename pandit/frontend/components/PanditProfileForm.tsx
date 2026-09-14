import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  User,
  Globe,
  Sparkles,
  BookOpen,
  Phone,
  Mail,
  Camera,
  Loader2,
} from "lucide-react";
import { EnterpriseButton } from "./EnterpriseButton";
import type {
  ProviderProfile,
  ProviderProfileInput,
  ProviderType,
} from "../types/pandit.types";
import {
  PANDIT_PROVIDER_TYPES,
  PROVIDER_TYPE_LABELS,
} from "../types/pandit.types";

// ─── Predefined tag options ───────────────────────────────────────────────────

const LANGUAGE_OPTIONS = [
  "Sanskrit",
  "Hindi",
  "English",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Bengali",
  "Marathi",
  "Gujarati",
  "Punjabi",
  "Odia",
];

const SPECIALIZATION_OPTIONS = [
  "Vivah Puja",
  "Grih Pravesh",
  "Satyanarayan Katha",
  "Navgraha Puja",
  "Rudrabhishek",
  "Katha Vachak",
  "Hanuman Chalisa Path",
  "Durga Saptashati",
  "Sundarkand Path",
  "Vastu Shanti",
  "Mundan Sanskar",
  "Naamkaran Sanskar",
  "Upanayana",
  "Last Rites / Antim Sanskar",
  "Pitru Tarpan",
  "Horoscope Reading",
  "Kundali Milan",
  "Shradh Karma",
];

interface Props {
  profile: ProviderProfile | null;
  onSave: (data: ProviderProfileInput) => Promise<void>;
  saving: boolean;
  onCancel: () => void;
}

interface FormValues {
  displayName: string;
  providerType: ProviderType;
  bio: string;
  contactEmail: string;
  contactPhone: string;
  avatarUrl: string;
  languagesRaw: string;
  specializationsRaw: string;
}

const TagSelector: React.FC<{
  label: string;
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
}> = ({ label, options, selected, onChange }) => {
  const toggle = (opt: string) =>
    onChange(
      selected.includes(opt)
        ? selected.filter((s) => s !== opt)
        : [...selected, opt],
    );

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
              selected.includes(opt)
                ? "bg-[#0A4DA6] text-white border-[#0A4DA6]"
                : "bg-white dark:bg-[#0B192C] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:border-[#0A4DA6] hover:text-[#0A4DA6]"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
};

const inputCls =
  "w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-[#0B192C] dark:text-white px-3 py-2.5 outline-none focus:border-[#0A4DA6] focus:ring-2 focus:ring-[#0A4DA6]/10 transition placeholder:text-gray-400 dark:placeholder:text-slate-500";

export const PanditProfileForm: React.FC<Props> = ({
  profile,
  onSave,
  saving,
  onCancel,
}) => {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      displayName: profile?.displayName ?? "",
      providerType: profile?.providerType ?? "PANDIT",
      bio: profile?.bio ?? "",
      contactEmail: profile?.contactEmail ?? "",
      contactPhone: profile?.contactPhone ?? "",
      avatarUrl: profile?.avatarUrl ?? "",
      languagesRaw: "",
      specializationsRaw: "",
    },
  });

  const [selectedLanguages, setSelectedLanguages] = React.useState<string[]>(
    profile?.languages ?? [],
  );
  const [selectedSpecializations, setSelectedSpecializations] = React.useState<
    string[]
  >(profile?.specializations ?? []);

  // Sync when profile loads externally
  useEffect(() => {
    if (profile) {
      setValue("displayName", profile.displayName);
      setValue("providerType", profile.providerType);
      setValue("bio", profile.bio ?? "");
      setValue("contactEmail", profile.contactEmail ?? "");
      setValue("contactPhone", profile.contactPhone ?? "");
      setValue("avatarUrl", profile.avatarUrl ?? "");
      setSelectedLanguages(profile.languages ?? []);
      setSelectedSpecializations(profile.specializations ?? []);
    }
  }, [profile, setValue]);

  const onSubmit = async (values: FormValues) => {
    const payload: ProviderProfileInput = {
      displayName: values.displayName.trim(),
      providerType: values.providerType,
      bio: values.bio.trim() || undefined,
      contactEmail: values.contactEmail.trim() || undefined,
      contactPhone: values.contactPhone.trim() || undefined,
      avatarUrl: values.avatarUrl.trim() || undefined,
      languages: selectedLanguages,
      specializations: selectedSpecializations,
    };
    await onSave(payload);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Avatar preview */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-800 border-2 border-dashed border-gray-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
          {watch("avatarUrl") ? (
            <img
              src={watch("avatarUrl")}
              alt="Avatar"
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <Camera size={22} className="text-gray-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
            Profile Photo URL
          </label>
          <input
            {...register("avatarUrl")}
            placeholder="https://..."
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Display name */}
        <div>
          <label className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
            <User size={12} />
            Display Name <span className="text-rose-500">*</span>
          </label>
          <input
            {...register("displayName", {
              required: "Display name is required",
              minLength: { value: 2, message: "Minimum 2 characters" },
              maxLength: { value: 80, message: "Maximum 80 characters" },
            })}
            placeholder="Pt. Ramesh Sharma"
            className={`${inputCls} ${errors.displayName ? "border-rose-500" : ""}`}
          />
          {errors.displayName && (
            <p className="text-[11px] text-rose-500 mt-1">
              {errors.displayName.message}
            </p>
          )}
        </div>

        {/* Provider type */}
        <div>
          <label className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
            <BookOpen size={12} />
            Provider Type <span className="text-rose-500">*</span>
          </label>
          <select
            {...register("providerType", { required: true })}
            className={inputCls}
          >
            {PANDIT_PROVIDER_TYPES.map((pt) => (
              <option key={pt} value={pt}>
                {PROVIDER_TYPE_LABELS[pt]}
              </option>
            ))}
          </select>
        </div>

        {/* Contact email */}
        <div>
          <label className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
            <Mail size={12} />
            Contact Email
          </label>
          <input
            {...register("contactEmail", {
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: "Enter a valid email address",
              },
            })}
            type="email"
            placeholder="you@example.com"
            className={`${inputCls} ${errors.contactEmail ? "border-rose-500" : ""}`}
          />
          {errors.contactEmail && (
            <p className="text-[11px] text-rose-500 mt-1">
              {errors.contactEmail.message}
            </p>
          )}
        </div>

        {/* Contact phone */}
        <div>
          <label className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
            <Phone size={12} />
            Contact Phone
          </label>
          <input
            {...register("contactPhone", {
              pattern: {
                value: /^[0-9+\-\s()]{7,15}$/,
                message: "Enter a valid phone number",
              },
            })}
            type="tel"
            placeholder="+91 98765 43210"
            className={`${inputCls} ${errors.contactPhone ? "border-rose-500" : ""}`}
          />
          {errors.contactPhone && (
            <p className="text-[11px] text-rose-500 mt-1">
              {errors.contactPhone.message}
            </p>
          )}
        </div>
      </div>

      {/* Bio */}
      <div>
        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">
          Short Bio
        </label>
        <textarea
          {...register("bio", { maxLength: { value: 500, message: "Max 500 characters" } })}
          rows={3}
          placeholder="Briefly describe your expertise, years of experience, and areas of specialization..."
          className={`${inputCls} resize-none`}
        />
        {errors.bio && (
          <p className="text-[11px] text-rose-500 mt-1">{errors.bio.message}</p>
        )}
      </div>

      {/* Languages */}
      <div>
        <label className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
          <Globe size={12} />
          Languages
        </label>
        <TagSelector
          label="Select languages you perform rituals in"
          options={LANGUAGE_OPTIONS}
          selected={selectedLanguages}
          onChange={setSelectedLanguages}
        />
      </div>

      {/* Specializations */}
      <div>
        <label className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
          <Sparkles size={12} />
          Specializations
        </label>
        <TagSelector
          label="Select your ritual specializations"
          options={SPECIALIZATION_OPTIONS}
          selected={selectedSpecializations}
          onChange={setSelectedSpecializations}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-gray-100 dark:border-slate-800">
        <EnterpriseButton
          type="submit"
          variant="primary"
          loading={saving}
          disabled={saving}
          icon={saving ? <Loader2 size={14} className="animate-spin" /> : undefined}
          className="w-full sm:w-auto"
        >
          {saving ? "Saving..." : "Save Profile"}
        </EnterpriseButton>
        <EnterpriseButton
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
          className="w-full sm:w-auto"
        >
          Cancel
        </EnterpriseButton>
      </div>
    </form>
  );
};

export default PanditProfileForm;

