/**
 * Tirvona Global Currency & Regional Formatting Utilities
 * Standardizes Indian Rupee (₹) and Indian Numbering System across the platform.
 */

export const CURRENCY_SYMBOL = "₹";
export const CURRENCY_CODE = "INR";

/**
 * Format any number or numeric string as Indian Rupee (₹)
 * Example outputs:
 *   formatCurrency(250)     => "₹250"
 *   formatCurrency(1200)    => "₹1,200"
 *   formatCurrency(12500)   => "₹12,500"
 *   formatCurrency(125000)  => "₹1,25,000"
 */
export const formatCurrency = (
  amount: number | string | undefined | null,
): string => {
  const numeric =
    typeof amount === "number" ? amount : parseFloat(String(amount || 0));
  const safeNumber = isNaN(numeric) ? 0 : numeric;
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
