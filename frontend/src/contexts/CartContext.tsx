import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface CartLine {
  productId: string;
  name: string;
  slug?: string;
  image?: string;
  /**
   * Last known catalogue price, kept only so the cart can show a subtotal
   * before the server is asked. It is never sent to the server and never used
   * to charge anyone — checkout re-prices every line from the catalogue.
   */
  displayPrice: number;
  quantity: number;
  maxQuantity?: number;
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  displaySubtotal: number;
  add: (
    line: Omit<CartLine, "quantity">,
    quantity?: number,
    openDrawer?: boolean,
  ) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

const STORAGE_KEY = "tirvona_cart";
/** Matches the server-side per-line cap in the order DTO. */
const MAX_PER_LINE = 20;

const readStored = (): CartLine[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (line): line is CartLine =>
        typeof line?.productId === "string" &&
        typeof line?.name === "string" &&
        Number.isFinite(line?.quantity),
    );
  } catch {
    // A corrupted or unreadable cart must not take the whole app down on boot.
    return [];
  }
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [lines, setLines] = useState<CartLine[]>(readStored);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Private-browsing quota failures are not worth interrupting a purchase.
    }
  }, [lines]);

  // Keep tabs in step, so adding an item in one does not vanish in another.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setLines(readStored());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const clampFor = (line: CartLine, quantity: number) =>
    Math.max(
      1,
      Math.min(quantity, line.maxQuantity ?? MAX_PER_LINE, MAX_PER_LINE),
    );

  const add = useCallback(
    (
      incoming: Omit<CartLine, "quantity">,
      quantity = 1,
      openDrawer = true,
    ) => {
      setLines((prev) => {
        const existing = prev.find((l) => l.productId === incoming.productId);
        if (!existing)
          return [
            ...prev,
            {
              ...incoming,
              quantity: clampFor(
                { ...incoming, quantity } as CartLine,
                quantity,
              ),
            },
          ];
        return prev.map((l) =>
          l.productId === incoming.productId
            ? { ...l, ...incoming, quantity: clampFor(l, l.quantity + quantity) }
            : l,
        );
      });
      if (openDrawer) {
        setIsOpen(true);
      }
    },
    [],
  );

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.productId !== productId)
        : prev.map((l) =>
            l.productId === productId
              ? { ...l, quantity: clampFor(l, quantity) }
              : l,
          ),
    );
  }, []);

  const remove = useCallback((productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      count: lines.reduce((sum, l) => sum + l.quantity, 0),
      displaySubtotal: lines.reduce(
        (sum, l) => sum + l.displayPrice * l.quantity,
        0,
      ),
      add,
      setQuantity,
      remove,
      clear,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
    }),
    [lines, isOpen, add, setQuantity, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = (): CartContextValue => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
};

export default CartContext;
