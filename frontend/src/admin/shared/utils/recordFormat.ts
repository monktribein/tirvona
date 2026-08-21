import { tUi } from "../../../contexts/LanguageContext";
import { getFormattingLocale } from "../../../utils/format";

const ACRONYMS: Record<string, string> = {
  id: "ID",
  ids: "IDs",
  url: "URL",
  urls: "URLs",
  api: "API",
  gst: "GST",
  pan: "PAN",
  kyc: "KYC",
  otp: "OTP",
  qr: "QR",
  sms: "SMS",
  ac: "AC",
  cms: "CMS",
  seo: "SEO",
  faq: "FAQ",
  html: "HTML",
  pin: "PIN",
};

export const humanizeKey = (key: string): string =>
  tUi(key
    .replace(/\./g, " › ")
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(" ")
    .filter(Boolean)
    .map((word) =>
      word === "›"
        ? word
        : (ACRONYMS[word.toLowerCase()] ??
          word.charAt(0).toUpperCase() + word.slice(1)),
    )
    .join(" ")).replace(/\s+URLs?$/i, "");

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}|$)/;
export const URL_LIKE = /^https?:\/\//i;

export const isEmptyValue = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (typeof value === "string" && value.trim() === "");

export const formatScalar = (value: unknown): string => {
  if (isEmptyValue(value)) return "—";
  if (typeof value === "boolean") return tUi(value ? "Yes" : "No");
  if (typeof value === "number") return value.toLocaleString(getFormattingLocale());
  if (value instanceof Date) return value.toLocaleString(getFormattingLocale());
  if (typeof value === "string" && ISO_DATE.test(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime()))
      return parsed.toLocaleString(getFormattingLocale());
  }
  return String(value);
};

export const formatInline = (value: unknown): string => {
  if (typeof value === "string" && URL_LIKE.test(value)) {
    if (/\.(jpe?g|png|webp|gif|svg|avif|heic)($|\?)/i.test(value))
      return "Image available";
    if (/\.pdf($|\?)/i.test(value)) return "PDF available";
    return "Document available";
  }
  if (isEmptyValue(value)) return "—";
  if (Array.isArray(value)) {
    if (!value.length) return "—";
    return value.every((item) => item === null || typeof item !== "object")
      ? value.map(formatScalar).join(", ")
      : `${value.length} items`;
  }
  if (typeof value === "object" && !(value instanceof Date)) {
    const record = value as Record<string, unknown>;
    for (const key of [
      "name",
      "title",
      "label",
      "bookingReference",
      "bookingId",
      "reservationNumber",
      "reference",
      "city",
      "average",
      "url",
    ])
      if (!isEmptyValue(record[key])) return formatInline(record[key]);
    const entries = Object.entries(record).filter(
      ([, item]) => !isEmptyValue(item),
    );
    if (!entries.length) return "—";
    return entries
      .slice(0, 3)
      .map(([key, item]) => `${humanizeKey(key)}: ${formatInline(item)}`)
      .join(" · ");
  }
  return formatScalar(value);
};
