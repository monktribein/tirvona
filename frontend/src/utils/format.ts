import { getActiveLanguage } from "./language";

export const getFormattingLocale = () =>
  getActiveLanguage() === "hi" ? "hi-IN-u-nu-deva" : "en-IN";

export const SUPPORTED_CURRENCIES = [
  { code: "INR", symbol: "₹", label: "₹ INR", name: "Indian Rupee" },
  { code: "USD", symbol: "$", label: "$ USD", name: "US Dollar" },
];

export const CURRENCY_SYMBOL = "₹";
export const CURRENCY_CODE = "INR";

export interface ExchangeRateSnapshot {
  usdToInr: number;
  updatedAt: string;
  source: string;
  sourceUrl: string;
}

const EXCHANGE_RATE_STORAGE_KEY = "tirvona_usd_inr_exchange_rate";
let currentExchangeRate: ExchangeRateSnapshot | null = null;

export const getExchangeRateSnapshot = (): ExchangeRateSnapshot | null => {
  if (currentExchangeRate) return currentExchangeRate;
  try {
    const stored = localStorage.getItem(EXCHANGE_RATE_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as ExchangeRateSnapshot;
    if (!Number.isFinite(parsed.usdToInr) || parsed.usdToInr <= 0) return null;
    currentExchangeRate = parsed;
    return parsed;
  } catch {
    return null;
  }
};

export const setExchangeRateSnapshot = (snapshot: ExchangeRateSnapshot) => {
  if (!Number.isFinite(snapshot.usdToInr) || snapshot.usdToInr <= 0) return;
  currentExchangeRate = snapshot;
  try {
    localStorage.setItem(EXCHANGE_RATE_STORAGE_KEY, JSON.stringify(snapshot));
    window.dispatchEvent(
      new CustomEvent("exchange_rate_changed", { detail: snapshot }),
    );
  } catch {
  }
};

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
  }
};

export const formatCurrency = (
  amount: number | string | undefined | null,
  overrideCurrency?: "INR" | "USD",
): string => {
  const numeric =
    typeof amount === "number" ? amount : parseFloat(String(amount || 0));
  const safeNumber = isNaN(numeric) ? 0 : numeric;
  const currency = overrideCurrency || getActiveCurrency();

  if (currency === "USD") {
    const rate = getExchangeRateSnapshot();
    if (!rate) return "$—";
    return new Intl.NumberFormat(
      getActiveLanguage() === "hi" ? "hi-IN-u-nu-deva" : "en-US",
      {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      },
    ).format(safeNumber / rate.usdToInr);
  }

  return new Intl.NumberFormat(getFormattingLocale(), {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: Number.isInteger(safeNumber) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(safeNumber);
};

export const formatIndianNumber = (
  amount: number | string | undefined | null,
): string => {
  const numeric =
    typeof amount === "number" ? amount : parseFloat(String(amount || 0));
  const safeNumber = isNaN(numeric) ? 0 : numeric;
  return safeNumber.toLocaleString(getFormattingLocale());
};

export const formatDateIN = (value?: string | Date | null): string => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(getFormattingLocale(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const formatDateTimeIN = (value?: string | Date | null): string => {
  if (!value) return "—";
  return new Date(value).toLocaleString(getFormattingLocale(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;
