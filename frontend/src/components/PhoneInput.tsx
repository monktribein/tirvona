import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Mobile number lengths (national number, without the country code) for the
 * countries Tirvona's pilgrims most often come from. `max` caps typing, so an
 * Indian number cannot take an 11th digit; `min` is checked before submit.
 * The backend still validates the full number with libphonenumber.
 */
export const PHONE_COUNTRIES = [
  { iso: "IN", name: "India", dial: "91", min: 10, max: 10 },
  { iso: "NP", name: "Nepal", dial: "977", min: 10, max: 10 },
  { iso: "BD", name: "Bangladesh", dial: "880", min: 10, max: 10 },
  { iso: "LK", name: "Sri Lanka", dial: "94", min: 9, max: 9 },
  { iso: "BT", name: "Bhutan", dial: "975", min: 8, max: 8 },
  { iso: "AE", name: "United Arab Emirates", dial: "971", min: 9, max: 9 },
  { iso: "SA", name: "Saudi Arabia", dial: "966", min: 9, max: 9 },
  { iso: "QA", name: "Qatar", dial: "974", min: 8, max: 8 },
  { iso: "KW", name: "Kuwait", dial: "965", min: 8, max: 8 },
  { iso: "OM", name: "Oman", dial: "968", min: 8, max: 8 },
  { iso: "BH", name: "Bahrain", dial: "973", min: 8, max: 8 },
  { iso: "US", name: "United States", dial: "1", min: 10, max: 10 },
  { iso: "CA", name: "Canada", dial: "1", min: 10, max: 10 },
  { iso: "GB", name: "United Kingdom", dial: "44", min: 10, max: 10 },
  { iso: "AU", name: "Australia", dial: "61", min: 9, max: 9 },
  { iso: "NZ", name: "New Zealand", dial: "64", min: 8, max: 10 },
  { iso: "SG", name: "Singapore", dial: "65", min: 8, max: 8 },
  { iso: "MY", name: "Malaysia", dial: "60", min: 9, max: 10 },
  { iso: "MU", name: "Mauritius", dial: "230", min: 8, max: 8 },
  { iso: "ZA", name: "South Africa", dial: "27", min: 9, max: 9 },
  { iso: "KE", name: "Kenya", dial: "254", min: 9, max: 9 },
  { iso: "DE", name: "Germany", dial: "49", min: 10, max: 11 },
  { iso: "FR", name: "France", dial: "33", min: 9, max: 9 },
  { iso: "NL", name: "Netherlands", dial: "31", min: 9, max: 9 },
  { iso: "IT", name: "Italy", dial: "39", min: 9, max: 10 },
  { iso: "RU", name: "Russia", dial: "7", min: 10, max: 10 },
  { iso: "JP", name: "Japan", dial: "81", min: 10, max: 10 },
  { iso: "TH", name: "Thailand", dial: "66", min: 9, max: 9 },
] as const;

export type PhoneCountry = (typeof PHONE_COUNTRIES)[number];

const DEFAULT_COUNTRY: PhoneCountry = PHONE_COUNTRIES[0];

/** Time zones of the listed countries; America/* falls through to the US. */
const ZONE_COUNTRY: Record<string, string> = {
  "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Kathmandu": "NP",
  "Asia/Katmandu": "NP", "Asia/Dhaka": "BD", "Asia/Colombo": "LK",
  "Asia/Thimphu": "BT", "Asia/Dubai": "AE", "Asia/Riyadh": "SA",
  "Asia/Qatar": "QA", "Asia/Kuwait": "KW", "Asia/Muscat": "OM",
  "Asia/Bahrain": "BH", "Europe/London": "GB", "Pacific/Auckland": "NZ",
  "Asia/Singapore": "SG", "Asia/Kuala_Lumpur": "MY", "Indian/Mauritius": "MU",
  "Africa/Johannesburg": "ZA", "Africa/Nairobi": "KE", "Europe/Berlin": "DE",
  "Europe/Paris": "FR", "Europe/Amsterdam": "NL", "Europe/Rome": "IT",
  "Europe/Moscow": "RU", "Asia/Tokyo": "JP", "Asia/Bangkok": "TH",
  "America/Toronto": "CA", "America/Vancouver": "CA", "America/Edmonton": "CA",
  "America/Winnipeg": "CA", "America/Halifax": "CA", "America/St_Johns": "CA",
};

/**
 * The visitor's likely country, read from the device (time zone, then the
 * browser language's region) with no network call. Falls back to India.
 */
const detectCountry = (): PhoneCountry => {
  const byIso = (iso?: string) =>
    PHONE_COUNTRIES.find((c) => c.iso === iso?.toUpperCase());
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const fromZone =
      byIso(ZONE_COUNTRY[zone]) ??
      (zone.startsWith("Australia/") ? byIso("AU") : undefined) ??
      (zone.startsWith("America/") ? byIso("US") : undefined);
    if (fromZone) return fromZone;
  } catch {
    // Intl unavailable: fall through to the language region.
  }
  for (const lang of navigator.languages ?? [navigator.language]) {
    const region = lang?.split("-")[1];
    const match = byIso(region);
    if (match) return match;
  }
  return DEFAULT_COUNTRY;
};

/** Splits "+<dial><digits>" into its country and national digits. */
const parsePhone = (
  value: string,
  fallback: PhoneCountry,
): { country: PhoneCountry; digits: string } => {
  const raw = (value || "").trim();
  const all = raw.replace(/\D/g, "");
  if (!all) return { country: fallback, digits: "" };
  if (raw.startsWith("+")) {
    // Prefer the currently selected country when its code matches (+1 is
    // shared by the US and Canada), else the longest matching dial code.
    if (all.startsWith(fallback.dial))
      return { country: fallback, digits: all.slice(fallback.dial.length) };
    const match = [...PHONE_COUNTRIES]
      .sort((a, b) => b.dial.length - a.dial.length)
      .find((c) => all.startsWith(c.dial));
    if (match) return { country: match, digits: all.slice(match.dial.length) };
  }
  return { country: fallback, digits: all };
};

/** True when the number has a full national number for its country. */
export const isCompletePhone = (value: string): boolean => {
  if (!value?.startsWith("+")) return false;
  const { country, digits } = parsePhone(value, DEFAULT_COUNTRY);
  return digits.length >= country.min && digits.length <= country.max;
};

/** A user-facing message for an incomplete number, or "" when it is fine. */
export const phoneProblem = (value: string): string => {
  const { country, digits } = parsePhone(value, DEFAULT_COUNTRY);
  if (!digits) return "Enter your mobile number";
  if (digits.length < country.min) {
    const need =
      country.min === country.max
        ? `${country.min}`
        : `${country.min}–${country.max}`;
    return `Enter a valid ${need}-digit ${country.name} mobile number`;
  }
  return "";
};

type PhoneInputProps = {
  /** Full international number, "+<dial><digits>", or "" when empty. */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  required?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  /** "sm" matches the compact auth-card inputs, "md" the modal inputs. */
  size?: "sm" | "md";
};

export default function PhoneInput({
  value,
  onChange,
  id,
  required,
  autoFocus,
  disabled,
  size = "sm",
}: PhoneInputProps) {
  const [country, setCountry] = useState<PhoneCountry>(
    () => parsePhone(value, detectCountry()).country,
  );
  const { digits } = parsePhone(value, country);

  // Follow a value set from outside (e.g. a form reset) onto its country.
  useEffect(() => {
    const parsed = parsePhone(value, country);
    if (parsed.country.iso !== country.iso) setCountry(parsed.country);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (next: PhoneCountry, nextDigits: string) =>
    onChange(nextDigits ? `+${next.dial}${nextDigits}` : "");

  const handleDigits = (raw: string) => {
    // A typed or pasted "+971 50 123 4567" switches to that country and keeps
    // only the national part.
    if (raw.trim().startsWith("+")) {
      const parsed = parsePhone(raw, country);
      if (parsed.country.iso !== country.iso) setCountry(parsed.country);
      emit(parsed.country, parsed.digits.slice(0, parsed.country.max));
      return;
    }
    let only = raw.replace(/\D/g, "");
    // A trunk-prefixed "098765..." drops the leading zero.
    if (only.length > country.max && only.startsWith("0"))
      only = only.replace(/^0+/, "");
    emit(country, only.slice(0, country.max));
  };

  const handleCountry = (iso: string) => {
    const next = PHONE_COUNTRIES.find((c) => c.iso === iso) ?? DEFAULT_COUNTRY;
    setCountry(next);
    emit(next, digits.slice(0, next.max));
  };

  const text = size === "md" ? "text-sm" : "text-xs";
  const pad = size === "md" ? "py-3.5" : "py-2";

  return (
    <div
      className={`flex w-full items-stretch bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus-within:ring-2 focus-within:ring-[#F28C28] ${disabled ? "opacity-60" : ""}`}
    >
      {/* The closed picker shows only "+91"; the native select sits invisibly
          on top so its open list can carry full country names without
          widening the field. Flag emoji are not used: Windows renders them
          as letter pairs ("IN"). */}
      <div
        className={`relative shrink-0 flex items-center gap-1 border-r border-gray-200 dark:border-slate-800 pl-3 pr-2 ${text} font-bold text-[#0B192C] dark:text-white`}
        title={country.name}
      >
        <span>+{country.dial}</span>
        <ChevronDown size={13} className="text-gray-400" />
        <select
          aria-label={`Country code, ${country.name} +${country.dial}`}
          value={country.iso}
          disabled={disabled}
          onChange={(e) => handleCountry(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        >
          {PHONE_COUNTRIES.map((c) => (
            <option key={c.iso} value={c.iso}>
              {c.name} (+{c.dial})
            </option>
          ))}
        </select>
      </div>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        required={required}
        autoFocus={autoFocus}
        disabled={disabled}
        // No maxLength: it would truncate a pasted "+91 98765 43210" before
        // handleDigits can strip the code. handleDigits caps the length.
        placeholder={
          country.min === country.max
            ? `${country.max} digits`
            : `${country.min}–${country.max} digits`
        }
        value={digits}
        onChange={(e) => handleDigits(e.target.value)}
        className={`min-w-0 w-full flex-1 bg-transparent px-3 ${pad} text-sm font-semibold text-[#0B192C] dark:text-white placeholder:text-xs placeholder:font-normal placeholder:text-gray-400 focus:outline-none tracking-wider`}
      />
    </div>
  );
}
