import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type ExchangeRateSnapshot,
  getActiveCurrency,
  getExchangeRateSnapshot,
  setActiveCurrency,
  setExchangeRateSnapshot,
} from "../utils/format";

type Currency = "INR" | "USD";

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  rate: ExchangeRateSnapshot | null;
  loadingRate: boolean;
  refreshRate: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(
  undefined,
);

const PRIMARY_RATE_URL = "https://open.er-api.com/v6/latest/USD";
const FALLBACK_RATE_URL = "https://api.frankfurter.dev/v2/rate/USD/INR";
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

const fetchLiveUsdInrRate = async (): Promise<ExchangeRateSnapshot> => {
  try {
    const response = await fetch(PRIMARY_RATE_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Rate provider returned ${response.status}`);
    const data = await response.json();
    const usdToInr = Number(data?.rates?.INR);
    if (!Number.isFinite(usdToInr) || usdToInr <= 0) {
      throw new Error("Rate provider returned an invalid USD/INR rate");
    }
    return {
      usdToInr,
      updatedAt: data?.time_last_update_unix
        ? new Date(data.time_last_update_unix * 1000).toISOString()
        : new Date().toISOString(),
      source: "ExchangeRate-API",
      sourceUrl: PRIMARY_RATE_URL,
    };
  } catch (primaryError) {
    const response = await fetch(FALLBACK_RATE_URL, { cache: "no-store" });
    if (!response.ok) throw primaryError;
    const data = await response.json();
    const usdToInr = Number(data?.rate);
    if (!Number.isFinite(usdToInr) || usdToInr <= 0) throw primaryError;
    return {
      usdToInr,
      updatedAt: data?.date
        ? new Date(`${data.date}T00:00:00Z`).toISOString()
        : new Date().toISOString(),
      source: "Frankfurter (ECB reference data)",
      sourceUrl: FALLBACK_RATE_URL,
    };
  }
};

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currency, setCurrencyState] = useState<Currency>(() =>
    getActiveCurrency(),
  );
  const [rate, setRate] = useState<ExchangeRateSnapshot | null>(() =>
    getExchangeRateSnapshot(),
  );
  const [loadingRate, setLoadingRate] = useState(false);

  const refreshRate = useCallback(async () => {
    setLoadingRate(true);
    try {
      const liveRate = await fetchLiveUsdInrRate();
      setExchangeRateSnapshot(liveRate);
      setRate(liveRate);
    } catch (error) {
      console.warn("Unable to refresh the USD/INR exchange rate", error);
      setRate(getExchangeRateSnapshot());
    } finally {
      setLoadingRate(false);
    }
  }, []);

  useEffect(() => {
    void refreshRate();
    const interval = window.setInterval(refreshRate, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refreshRate]);

  const setCurrency = useCallback((nextCurrency: Currency) => {
    setActiveCurrency(nextCurrency);
    setCurrencyState(nextCurrency);
  }, []);

  const value = useMemo(
    () => ({ currency, setCurrency, rate, loadingRate, refreshRate }),
    [currency, setCurrency, rate, loadingRate, refreshRate],
  );

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within CurrencyProvider");
  }
  return context;
};
