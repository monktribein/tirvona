/**
 * Tirvona Global Currency & Regional Formatting Utilities
 * Standardizes Indian Rupee (₹) and Indian Numbering System across the platform.
 */

export const SUPPORTED_CURRENCIES = [
  { code: "INR", symbol: "₹", label: "₹ INR", name: "Indian Rupee" },
  { code: "USD", symbol: "$", label: "$ USD", name: "US Dollar" },
];

export const CURRENCY_SYMBOL = "₹";
export const CURRENCY_CODE = "INR";

export const getActiveCurrency = (): "INR" | "USD" => {
  try {
    const stored = localStorage.getItem("tirvona_active_currency");
    if (stored === "USD" || stored === "INR") return stored;
    const cachedMem = localStorage.getItem("tirvona_user_memory");
    if (cachedMem) {
      const parsed = JSON.parse(cachedMem);
      if (parsed?.preferences?.currency === "USD") return "USD";
    }
  } catch {
    // fallback to INR
  }
  return "INR";
};

export const setActiveCurrency = (currency: "INR" | "USD") => {
  try {
    localStorage.setItem("tirvona_active_currency", currency);
    const cachedMem = localStorage.getItem("tirvona_user_memory");
    if (cachedMem) {
      const parsed = JSON.parse(cachedMem);
      parsed.preferences = { ...(parsed.preferences || {}), currency };
      localStorage.setItem("tirvona_user_memory", JSON.stringify(parsed));
    }
    window.dispatchEvent(
      new CustomEvent("currency_changed", { detail: currency }),
    );
  } catch {
    // ignore
  }
};

/**
 * Format any number or numeric string as Currency (INR ₹ or USD $)
 */
export const formatCurrency = (
  amount: number | string | undefined | null,
  overrideCurrency?: "INR" | "USD",
): string => {
  const numeric =
    typeof amount === "number" ? amount : parseFloat(String(amount || 0));
  const safeNumber = isNaN(numeric) ? 0 : numeric;
  const currency = overrideCurrency || getActiveCurrency();

  if (currency === "USD") {
    // Standard exchange conversion rate: 1 INR ≈ $0.012 USD
    const usdAmount = safeNumber * 0.012;
    return `$${usdAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  return `₹${safeNumber.toLocaleString("en-IN")}`;
};

/**
 * Format a number using Indian numbering formatting without the prefix
 * Example outputs:
 *   formatIndianNumber(125000) => "1,25,000"
 */
export const formatIndianNumber = (
  amount: number | string | undefined | null,
): string => {
  const numeric =
    typeof amount === "number" ? amount : parseFloat(String(amount || 0));
  const safeNumber = isNaN(numeric) ? 0 : numeric;
  return safeNumber.toLocaleString("en-IN");
};

/**
 * Format Date using Indian Locale standards (DD MMM YYYY)
 */
export const formatDateIN = (value?: string | Date | null): string => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/**
 * Format DateTime using Indian Locale standards
 */
export const formatDateTimeIN = (value?: string | Date | null): string => {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Round a money amount to paise.
 *
 * Mirrors `roundMoney` in the backend's booking utils. Both sides must agree
 * exactly: this file drives the price a guest is shown before booking, and the
 * server drives the amount actually charged. GST on a platform fee produces
 * fractions (18% of 49 is 8.82), and raw float arithmetic drifts.
 */
export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;
