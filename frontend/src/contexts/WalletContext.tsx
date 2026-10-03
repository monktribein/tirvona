import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { walletService, type WalletSummary } from "../services/wallet.service";

interface WalletContextValue {
  summary: WalletSummary | null;
  /** Spendable balance; 0 while loading or signed out. */
  balance: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue>({
  summary: null,
  balance: 0,
  loading: false,
  refresh: async () => {},
});

/**
 * The signed-in pilgrim's wallet, shared by the navbar, the wallet page and
 * every checkout. Refreshes on sign-in, when the tab regains focus, and
 * whenever something fires `tirvona:wallet-changed` (a payment, a refund, a
 * transfer request).
 */
export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setSummary(null);
      return;
    }
    setLoading(true);
    try {
      const res = await walletService.summary();
      setSummary(res.data.data as WalletSummary);
    } catch {
      // The wallet is an extra; a failed read must never break the page.
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const onChange = () => refresh();
    const onFocus = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("tirvona:wallet-changed", onChange);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("tirvona:wallet-changed", onChange);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [user, refresh]);

  const value = useMemo(
    () => ({
      summary,
      balance: summary?.wallet.balance ?? 0,
      loading,
      refresh,
    }),
    [summary, loading, refresh],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export const useWallet = () => useContext(WalletContext);
