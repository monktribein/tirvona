import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCart } from "../../contexts/CartContext";
import { useAuth } from "../../contexts/AuthContext";
import { formatCurrency } from "../../utils/format";
import { setGuestPendingIntent } from "../../utils/guestGate";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";

const FALLBACK_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E";

/** Header cart trigger with a live item-count badge. */
export const CartButton: React.FC = () => {
  const { count, open } = useCart();
  return (
    <button
      onClick={open}
      aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
      title="Cart"
      className="p-2 rounded-full text-[#0B192C] dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-slate-800 transition-all cursor-pointer relative flex items-center justify-center shrink-0"
    >
      <ShoppingBag size={18} />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-[#E58C28] rounded-full flex items-center justify-center text-[9px] font-black text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
};

/**
 * Slide-over cart.
 *
 * The subtotal shown here is the last known catalogue price and is labelled as
 * indicative: the binding total is produced by the server at checkout, so a
 * price that moved while the item sat in the cart is corrected there rather
 * than silently honoured.
 */
export const CartDrawer: React.FC = () => {
  const { lines, count, displaySubtotal, setQuantity, remove, isOpen, close } =
    useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (
      location.pathname.startsWith("/login") ||
      location.pathname.startsWith("/register")
    ) {
      close();
    }
  }, [location.pathname, close]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, close]);

  if (!isOpen) return null;

  const goToCheckout = () => {
    close();
    if (!user) {
      // Preserve the intent so the basket survives the login round trip.
      setGuestPendingIntent({
        type: "marketplace_cart",
        returnUrl: "/marketplace/checkout",
      });
      navigate("/login?redirect=%2Fmarketplace%2Fcheckout");
      return;
    }
    navigate("/marketplace/checkout");
  };

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/50 backdrop-blur-sm"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Shopping cart"
    >
      <aside
        className="w-full max-w-md h-full bg-white dark:bg-[#0B192C] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-800">
          <h2 className="text-base font-black text-[#0B192C] dark:text-white flex items-center gap-2">
            <ShoppingBag size={18} className="text-[#0A4DA6]" />
            Your cart
            {count > 0 && (
              <span className="text-xs font-bold text-gray-500">
                ({count} item{count === 1 ? "" : "s"})
              </span>
            )}
          </h2>
          <button
            onClick={close}
            aria-label="Close cart"
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 cursor-pointer"
          >
            <X size={18} />
          </button>
        </header>

        {lines.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
            <ShoppingBag size={34} className="text-gray-300" />
            <p className="text-sm font-bold text-[#0B192C] dark:text-white">
              Your cart is empty
            </p>
            <p className="text-xs text-gray-500 max-w-xs">
              Browse temple prasad, rudraksha and puja essentials from verified
              vendors.
            </p>
            <button
              onClick={() => {
                close();
                navigate("/marketplace");
              }}
              className="mt-1 px-5 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white text-xs font-extrabold cursor-pointer"
            >
              Browse marketplace
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-gray-100 dark:divide-slate-800">
              {lines.map((line) => (
                <div key={line.productId} className="p-4 flex gap-3">
                  <img
                    src={line.image || FALLBACK_IMAGE}
                    alt={line.name}
                    className="w-16 h-16 rounded-xl object-cover bg-gray-100 dark:bg-slate-900 shrink-0"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-[#0B192C] dark:text-white line-clamp-2">
                      {line.name}
                    </h3>
                    <p className="text-xs font-black text-[#0A4DA6] dark:text-blue-400 mt-0.5">
                      {formatCurrency(line.displayPrice)}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center border border-gray-200 dark:border-slate-700 rounded-lg">
                        <button
                          onClick={() =>
                            setQuantity(line.productId, line.quantity - 1)
                          }
                          aria-label={`Decrease quantity of ${line.name}`}
                          className="px-2 py-1 text-gray-600 dark:text-gray-300 hover:text-[#0A4DA6] cursor-pointer"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="px-2 text-xs font-black tabular-nums">
                          {line.quantity}
                        </span>
                        <button
                          onClick={() =>
                            setQuantity(line.productId, line.quantity + 1)
                          }
                          aria-label={`Increase quantity of ${line.name}`}
                          className="px-2 py-1 text-gray-600 dark:text-gray-300 hover:text-[#0A4DA6] cursor-pointer"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <button
                        onClick={() => remove(line.productId)}
                        aria-label={`Remove ${line.name}`}
                        className="p-1.5 text-gray-400 hover:text-rose-500 transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <span className="text-xs font-black text-[#0B192C] dark:text-white tabular-nums shrink-0">
                    {formatCurrency(line.displayPrice * line.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <footer className="p-4 border-t border-gray-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-gray-600 dark:text-gray-300">
                  Subtotal
                </span>
                <span className="font-black text-[#0B192C] dark:text-white tabular-nums">
                  {formatCurrency(displaySubtotal)}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                Shipping and GST are calculated at checkout, where every price
                is re-confirmed against the live catalogue.
              </p>
              <button
                onClick={goToCheckout}
                className="w-full py-3 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white text-xs font-extrabold shadow-md cursor-pointer transition-all"
              >
                {user ? "Proceed to checkout" : "Sign in to checkout"}
              </button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
};

export default CartDrawer;
