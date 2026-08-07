import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { marketplaceService } from "../services/marketplace.service";
import { useCart } from "../contexts/CartContext";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../contexts/NotificationContext";
import { formatCurrency } from "../utils/format";
import { getErrorMessage } from "../lib/api";
import { openRazorpayCheckout } from "../lib/razorpay";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MapPin,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";

interface Address {
  _id: string;
  label?: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  isDefault?: boolean;
}

interface Quote {
  items: {
    productId: string;
    name: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }[];
  pricing: {
    itemsTotal: number;
    shippingFee: number;
    gstAmount: number;
    gstPercent: number;
    totalAmount: number;
  };
}

const EMPTY_FORM = {
  label: "Home",
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
};

export const MarketplaceCheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const { lines, clear } = useCart();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saveAddress, setSaveAddress] = useState(true);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [loadingQuote, setLoadingQuote] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<{ orderNumber: string } | null>(null);

  const cartPayload = lines.map((l) => ({
    productId: l.productId,
    quantity: l.quantity,
  }));
  const cartKey = JSON.stringify(cartPayload);

  // Re-price whenever the basket changes. This is the authoritative total: the
  // cart's own subtotal is indicative only.
  useEffect(() => {
    if (!cartPayload.length) {
      setQuote(null);
      setLoadingQuote(false);
      return;
    }
    let cancelled = false;
    setLoadingQuote(true);
    setQuoteError("");
    marketplaceService
      .quote(cartPayload)
      .then((res) => {
        if (!cancelled) setQuote(res.data?.data ?? null);
      })
      .catch((err) => {
        if (!cancelled) {
          setQuote(null);
          setQuoteError(
            getErrorMessage(err, "Some items could not be priced."),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingQuote(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey]);

  const loadAddresses = useCallback(async () => {
    try {
      const res = await marketplaceService.addresses();
      const rows: Address[] = res.data?.data ?? [];
      setAddresses(rows);
      const preferred = rows.find((a) => a.isDefault) ?? rows[0];
      setSelectedAddressId((current) => current || preferred?._id || "");
      setShowForm(rows.length === 0);
    } catch {
      setAddresses([]);
      setShowForm(true);
    }
  }, []);

  useEffect(() => {
    if (user) loadAddresses();
  }, [user, loadAddresses]);

  const removeAddress = async (id: string) => {
    try {
      await marketplaceService.deleteAddress(id);
      if (selectedAddressId === id) setSelectedAddressId("");
      await loadAddresses();
    } catch (err) {
      addNotification(
        "Could not remove address",
        getErrorMessage(err, "Please try again."),
        "error",
      );
    }
  };

  const formComplete =
    form.fullName.trim().length > 1 &&
    /^[0-9+\-\s]{8,15}$/.test(form.phone.trim()) &&
    form.line1.trim().length > 2 &&
    form.city.trim().length > 1 &&
    form.state.trim().length > 1 &&
    /^[1-9][0-9]{5}$/.test(form.pincode.trim());

  const canPlace =
    !!quote &&
    !loadingQuote &&
    !placing &&
    (showForm ? formComplete : Boolean(selectedAddressId));

  const placeOrder = async () => {
    if (!canPlace) return;
    setPlacing(true);
    try {
      const orderRes = await marketplaceService.createOrder({
        items: cartPayload,
        ...(showForm
          ? { address: { ...form }, saveAddress }
          : { addressId: selectedAddressId }),
        paymentMode: "online",
      });
      const order = orderRes.data?.data;
      if (!order?._id) throw new Error("Order could not be created");

      const payRes = await marketplaceService.paymentOrder(order._id);

      // Demo mode: the server reports no gateway keys, so there is no payment
      // to make. It confirms without a signature, which the server only accepts
      // outside production.
      if (payRes.data?.demo) {
        await marketplaceService.confirmPayment(order._id, {
          razorpay_order_id: "",
          razorpay_payment_id: "",
          razorpay_signature: "",
        });
        clear();
        setPlaced({ orderNumber: order.orderNumber });
        return;
      }

      // openRazorpayCheckout loads the script itself and takes the prefill
      // object directly as its second argument.
      const result = await openRazorpayCheckout(payRes.data.data, {
        name: user?.name ?? "",
        email: user?.email ?? "",
        contact: user?.phone ?? "",
      });

      await marketplaceService.confirmPayment(order._id, {
        razorpay_order_id: result.razorpay_order_id,
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_signature: result.razorpay_signature,
      });

      clear();
      setPlaced({ orderNumber: order.orderNumber });
    } catch (err) {
      addNotification(
        "Order not completed",
        getErrorMessage(err, "Payment was not completed."),
        "error",
      );
    } finally {
      setPlacing(false);
    }
  };

  if (placed)
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-sm">
          <CheckCircle2 size={44} className="mx-auto text-emerald-500" />
          <h1 className="text-xl font-black text-[#0B192C] dark:text-white">
            Order confirmed
          </h1>
          <p className="text-xs text-gray-500">
            Your order{" "}
            <strong className="text-[#0B192C] dark:text-white font-mono">
              {placed.orderNumber}
            </strong>{" "}
            has been placed. You will receive updates as it is packed and
            dispatched.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-1">
            <button
              onClick={() => navigate("/profile/orders")}
              className="px-5 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white text-xs font-extrabold cursor-pointer"
            >
              View my orders
            </button>
            <button
              onClick={() => navigate("/marketplace")}
              className="px-5 py-2.5 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-extrabold text-[#0B192C] dark:text-white cursor-pointer"
            >
              Continue shopping
            </button>
          </div>
        </div>
      </div>
    );

  if (!lines.length)
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <p className="text-sm font-bold text-[#0B192C] dark:text-white">
            Your cart is empty
          </p>
          <button
            onClick={() => navigate("/marketplace")}
            className="px-5 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white text-xs font-extrabold cursor-pointer"
          >
            Browse marketplace
          </button>
        </div>
      </div>
    );

  const field = (
    name: keyof typeof EMPTY_FORM,
    label: string,
    placeholder = "",
    required = true,
  ) => (
    <div>
      <label className="text-[10px] font-black text-gray-500 block mb-1">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </label>
      <input
        value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6]"
      />
    </div>
  );

  return (
    <div className="min-h-screen pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        <button
          onClick={() => navigate("/marketplace")}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-[#0A4DA6] cursor-pointer"
        >
          <ArrowLeft size={14} /> Back to marketplace
        </button>

        <h1 className="text-2xl font-black text-[#0B192C] dark:text-white">
          Checkout
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Delivery address */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-[#0B192C] dark:text-white flex items-center gap-2">
                  <MapPin size={16} className="text-[#0A4DA6] shrink-0" />
                  Delivery address
                </h2>
                {addresses.length > 0 && (
                  <button
                    onClick={() => setShowForm((v) => !v)}
                    className="text-[11px] font-bold text-[#0A4DA6] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    {showForm ? (
                      "Use a saved address"
                    ) : (
                      <>
                        <Plus size={12} /> Add new
                      </>
                    )}
                  </button>
                )}
              </div>

              {!showForm ? (
                <div className="space-y-2">
                  {addresses.map((address) => (
                    <label
                      key={address._id}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        selectedAddressId === address._id
                          ? "border-[#0A4DA6] bg-blue-50/60 dark:bg-blue-950/30"
                          : "border-gray-200 dark:border-slate-800 hover:border-[#0A4DA6]/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="address"
                        checked={selectedAddressId === address._id}
                        onChange={() => setSelectedAddressId(address._id)}
                        className="mt-1 accent-[#0A4DA6]"
                      />
                      <span className="flex-1 min-w-0 text-xs">
                        <span className="flex items-center gap-2">
                          <strong className="text-[#0B192C] dark:text-white">
                            {address.fullName}
                          </strong>
                          {address.label && (
                            <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-[9px] font-black text-gray-600 dark:text-gray-300">
                              {address.label}
                            </span>
                          )}
                          {address.isDefault && (
                            <span className="text-[9px] font-black text-emerald-600">
                              Default
                            </span>
                          )}
                        </span>
                        <span className="block text-gray-500 mt-0.5 leading-relaxed">
                          {[
                            address.line1,
                            address.line2,
                            address.landmark,
                            address.city,
                            address.state,
                            address.pincode,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                        <span className="block text-gray-400 mt-0.5">
                          {address.phone}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          removeAddress(address._id);
                        }}
                        aria-label="Remove address"
                        className="p-1 text-gray-400 hover:text-rose-500 cursor-pointer shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {field("fullName", "Full name", "Ramesh Kumar")}
                  {field("phone", "Phone", "9876543210")}
                  <div className="sm:col-span-2">
                    {field("line1", "Address line 1", "House / street")}
                  </div>
                  <div className="sm:col-span-2">
                    {field("line2", "Address line 2", "Area", false)}
                  </div>
                  {field("landmark", "Landmark", "Near temple", false)}
                  {field("city", "City", "Haridwar")}
                  {field("state", "State", "Uttarakhand")}
                  {field("pincode", "Pincode", "249401")}
                  <div className="sm:col-span-2">
                    {field("label", "Save as", "Home / Work", false)}
                  </div>
                  <label className="sm:col-span-2 flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveAddress}
                      onChange={(e) => setSaveAddress(e.target.checked)}
                      className="accent-[#0A4DA6]"
                    />
                    Save this address for future orders
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Order summary */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 h-fit">
            <h2 className="text-sm font-black text-[#0B192C] dark:text-white">
              Order summary
            </h2>

            {quoteError && (
              <div className="flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-2.5">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                <span>{quoteError}</span>
              </div>
            )}

            {loadingQuote ? (
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" /> Confirming prices
              </p>
            ) : quote ? (
              <>
                <div className="space-y-2 text-xs">
                  {quote.items.map((item) => (
                    <div
                      key={item.productId}
                      className="flex justify-between gap-3"
                    >
                      <span className="text-gray-600 dark:text-gray-300 min-w-0">
                        <span className="block truncate">{item.name}</span>
                        <span className="text-gray-400">
                          {formatCurrency(item.unitPrice)} × {item.quantity}
                        </span>
                      </span>
                      <span className="font-bold tabular-nums shrink-0">
                        {formatCurrency(item.lineTotal)}
                      </span>
                    </div>
                  ))}
                </div>

                <dl className="space-y-1.5 text-xs border-t border-gray-100 dark:border-slate-800 pt-3">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Items</dt>
                    <dd className="font-bold tabular-nums">
                      {formatCurrency(quote.pricing.itemsTotal)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Shipping</dt>
                    <dd className="font-bold tabular-nums">
                      {quote.pricing.shippingFee === 0
                        ? "Free"
                        : formatCurrency(quote.pricing.shippingFee)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">
                      GST ({quote.pricing.gstPercent}%)
                    </dt>
                    <dd className="font-bold tabular-nums">
                      {formatCurrency(quote.pricing.gstAmount)}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-gray-100 dark:border-slate-800 pt-2 mt-1">
                    <dt className="font-black text-[#0B192C] dark:text-white text-sm">
                      Total
                    </dt>
                    <dd className="font-black text-[#0A4DA6] dark:text-blue-400 text-sm tabular-nums">
                      {formatCurrency(quote.pricing.totalAmount)}
                    </dd>
                  </div>
                </dl>

                <button
                  onClick={placeOrder}
                  disabled={!canPlace}
                  className="w-full py-3 rounded-full bg-[#0A4DA6] hover:bg-blue-900 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
                >
                  {placing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Processing
                    </>
                  ) : (
                    <>Pay {formatCurrency(quote.pricing.totalAmount)}</>
                  )}
                </button>

                <p className="text-[10px] text-gray-400 flex items-center gap-1.5 justify-center">
                  <ShieldCheck size={11} className="text-emerald-600" />
                  Secured by Razorpay
                </p>
              </>
            ) : (
              <p className="text-xs text-gray-500">
                Prices could not be confirmed. Please revisit your cart.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketplaceCheckoutPage;
