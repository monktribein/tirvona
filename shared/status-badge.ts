const STATUS_ACRONYMS = new Set([
  "API",
  "COD",
  "GST",
  "GSTIN",
  "KYC",
  "NDR",
  "RFQ",
  "RTO",
  "SKU",
  "SLA",
  "UPI",
]);

/** Turn backend enum values into readable labels without changing their stored values. */
export function formatStatusLabel(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const upper = word.toUpperCase();
      return STATUS_ACRONYMS.has(upper)
        ? upper
        : `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(" ");
}

/** Only rewrite machine-like labels; authored UI copy keeps its original wording. */
export function normalizeStatusText(value: string): string {
  return /^[A-Z\d]+(?:[\s_-][A-Z\d]+)*$/.test(value.trim())
    ? formatStatusLabel(value)
    : value;
}
