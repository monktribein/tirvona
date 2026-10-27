import { Paginated } from "../../components/shared/Pagination";
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Utensils,
  MapPin,
  Search,
  Sparkles,
  ShoppingBag,
  Clock,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Plus,
  Minus,
  X,
  AlertCircle,
  Bed,
  ArrowRight,
  Flame,
  Filter,
  Image,
} from "lucide-react";
import { payForFoodOrder } from "../../services/foodPayment";
import { foodService } from "../../services/food.service";
import type {
  FoodMeal,
  FoodOutlet,
  FoodZone,
  FoodQuote,
} from "../../services/food.service";

interface CartItem {
  meal: FoodMeal;
  variantId: string;
  label: string;
  pricePaise: number;
  quantity: number;
  notes?: string;
}

export const FoodMarketplacePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // URL query params for stay-linked QR ordering
  const queryStayId = searchParams.get("stayId") || "";
  const queryBookingId = searchParams.get("bookingId") || "";
  const queryRoom = searchParams.get("room") || "";

  // Data states
  const [zones, setZones] = useState<FoodZone[]>([]);
  const [_outlets, setOutlets] = useState<FoodOutlet[]>([]);
  const [meals, setMeals] = useState<FoodMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [selectedZone, setSelectedZone] = useState<string>("VRINDAVAN_CORE");
  const [selectedFamily, setSelectedFamily] = useState<string>("ALL");
  const [selectedDietary, setSelectedDietary] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Stay-link states
  const [stayBookingId, setStayBookingId] = useState<string>(queryBookingId);
  const [stayRoomNumber, setStayRoomNumber] = useState<string>(queryRoom);
  const [showStayModal, setShowStayModal] = useState<boolean>(false);
  const [stayLinkedConfirmed, setStayLinkedConfirmed] = useState<boolean>(
    Boolean(queryBookingId || queryStayId),
  );

  // Photo gallery modal state
  const [galleryMeal, setGalleryMeal] = useState<FoodMeal | null>(null);
  const [galleryIndex, setGalleryIndex] = useState<number>(0);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem("tirvona_food_cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [cartOutlet, setCartOutlet] = useState<FoodOutlet | null>(() => {
    try {
      const saved = localStorage.getItem("tirvona_food_cart_outlet");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [fulfilmentType, setFulfilmentType] = useState<
    "pickup" | "vendor_delivery" | "stay_delivery"
  >(queryBookingId ? "stay_delivery" : "vendor_delivery");

  // Conflict modal if adding item from different outlet
  const [pendingCartSwitch, setPendingCartSwitch] = useState<{
    meal: FoodMeal;
    variantId: string;
    label: string;
    pricePaise: number;
  } | null>(null);

  // Thali Variant Customizer Modal
  const [customizingThali, setCustomizingThali] = useState<FoodMeal | null>(null);
  const [selectedThaliPreference, setSelectedThaliPreference] = useState<{
    gingerGarlic: boolean;
    spicy: boolean;
  }>({ gingerGarlic: false, spicy: false }); // Default Satvik Non-spicy

  // Checkout modal
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, _setCustomerEmail] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [activeQuote, setActiveQuote] = useState<FoodQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  // Save cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("tirvona_food_cart", JSON.stringify(cart));
      localStorage.setItem("tirvona_food_cart_outlet", JSON.stringify(cartOutlet));
    } catch {}
  }, [cart, cartOutlet]);

  // Fetch discovery catalogue
  useEffect(() => {
    loadDiscovery();
  }, [selectedZone, selectedFamily, selectedDietary]);

  const loadDiscovery = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await foodService.getDiscovery({
        zoneCode: selectedZone,
        family: selectedFamily,
        dietaryTag: selectedDietary,
      });
      setZones(data.zones || []);
      setOutlets(data.outlets || []);
      setMeals(data.meals || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to load menu");
    } finally {
      setLoading(false);
    }
  };

  // Filter meals based on text search
  const filteredMeals = useMemo(() => {
    if (!searchQuery.trim()) return meals;
    const q = searchQuery.toLowerCase().trim();
    return meals.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.canonicalName.toLowerCase().includes(q) ||
        m.contents.toLowerCase().includes(q) ||
        m.outlet?.brandName.toLowerCase().includes(q),
    );
  }, [meals, searchQuery]);

  // Cart operations
  const addToCart = (
    meal: FoodMeal,
    variantId?: string,
    customLabel?: string,
    customPricePaise?: number,
  ) => {
    const outlet = meal.outlet;
    if (!outlet) return;

    const targetVariantId = variantId || meal.id;
    const targetLabel = customLabel || meal.label;
    const targetPrice = customPricePaise || meal.pricePaise;

    // Check single-outlet rule
    if (cart.length > 0 && cartOutlet && cartOutlet.id !== outlet.id) {
      setPendingCartSwitch({
        meal,
        variantId: targetVariantId,
        label: targetLabel,
        pricePaise: targetPrice,
      });
      return;
    }

    setCartOutlet({
      id: outlet.id,
      brandName: outlet.brandName,
      address: outlet.address,
      openTime: "08:00",
      closeTime: "22:00",
      serviceZoneCodes: [],
      fulfilmentModes: outlet.fulfilmentModes || ["pickup", "vendor_delivery"],
      rating: outlet.rating,
      ratingCount: outlet.ratingCount,
      avgPrepMinutes: outlet.avgPrepMinutes,
      minOrderPaise: 9900,
    });

    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (i) => i.variantId === targetVariantId,
      );
      if (existingIndex > -1) {
        const next = [...prev];
        next[existingIndex].quantity += 1;
        return next;
      }
      return [
        ...prev,
        {
          meal,
          variantId: targetVariantId,
          label: targetLabel,
          pricePaise: targetPrice,
          quantity: 1,
        },
      ];
    });

    setCartDrawerOpen(true);
  };

  const updateQuantity = (variantId: string, delta: number) => {
    setCart((prev) => {
      const updated = prev
        .map((item) => {
          if (item.variantId === variantId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];

      if (updated.length === 0) {
        setCartOutlet(null);
        setCartDrawerOpen(false);
      }
      return updated;
    });
  };

  const confirmCartSwitch = () => {
    if (!pendingCartSwitch) return;
    const { meal, variantId, label, pricePaise } = pendingCartSwitch;
    setCartOutlet({
      id: meal.outlet!.id,
      brandName: meal.outlet!.brandName,
      address: meal.outlet!.address,
      openTime: "08:00",
      closeTime: "22:00",
      serviceZoneCodes: [],
      fulfilmentModes: meal.outlet!.fulfilmentModes || ["pickup", "vendor_delivery"],
      rating: meal.outlet!.rating,
      ratingCount: meal.outlet!.ratingCount,
      avgPrepMinutes: meal.outlet!.avgPrepMinutes,
      minOrderPaise: 9900,
    });
    setCart([
      {
        meal,
        variantId,
        label,
        pricePaise,
        quantity: 1,
      },
    ]);
    setPendingCartSwitch(null);
    setCartDrawerOpen(true);
  };

  // Subtotal calculation in cart
  const subtotalPaise = useMemo(
    () => cart.reduce((acc, i) => acc + i.pricePaise * i.quantity, 0),
    [cart],
  );
  const packagingFeePaise = cart.length > 0 ? 1500 : 0;
  const deliveryFeePaise =
    fulfilmentType === "pickup" ? 0 : 3500;
  const taxPaise = Math.round(subtotalPaise * 0.05);
  const totalPaise = subtotalPaise + packagingFeePaise + deliveryFeePaise + taxPaise;

  // Thali Variant Customizer logic
  const handleOpenThaliCustomizer = (meal: FoodMeal) => {
    setCustomizingThali(meal);
    setSelectedThaliPreference({ gingerGarlic: false, spicy: false });
  };

  const handleConfirmThali = () => {
    if (!customizingThali) return;
    const { gingerGarlic, spicy } = selectedThaliPreference;

    let variantSuffix = "";
    let price = 18900;
    let label = "";

    if (gingerGarlic && spicy) {
      variantSuffix = "THALI-GG-SPICY";
      price = 18900;
      label = "Tirvona Special Thali (With Ginger & Garlic - Spicy)";
    } else if (gingerGarlic && !spicy) {
      variantSuffix = "THALI-GG-NONSPICY";
      price = 18900;
      label = "Tirvona Special Thali (With Ginger & Garlic - Non-spicy)";
    } else if (!gingerGarlic && spicy) {
      variantSuffix = "THALI-NOGG-SPICY";
      price = 19900;
      label = "Tirvona Satvik Thali (No Ginger No Garlic - Spicy)";
    } else {
      variantSuffix = "THALI-NOGG-NONSPICY";
      price = 19900;
      label = "Tirvona Satvik Thali (No Ginger No Garlic - Non-spicy)";
    }

    addToCart(customizingThali, `${customizingThali.id}-${variantSuffix}`, label, price);
    setCustomizingThali(null);
  };

  // Fetch Authoritative Checkout Quote
  const handleProceedToCheckout = async () => {
    if (cart.length === 0 || !cartOutlet) return;
    setQuoteLoading(true);
    setCheckoutModalOpen(true);
    try {
      const quote = await foodService.createQuote({
        outletId: cartOutlet.id,
        items: cart.map((c) => ({
          variantId: c.meal.id,
          quantity: c.quantity,
          customerNotes: c.notes,
        })),
        fulfilmentType,
        destinationAddress: deliveryAddress,
        stayBookingId: stayBookingId || undefined,
        stayRoomNumber: stayRoomNumber || undefined,
        zoneCode: selectedZone,
      });
      setActiveQuote(quote);
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Error validating checkout quote");
      setCheckoutModalOpen(false);
    } finally {
      setQuoteLoading(false);
    }
  };

  // Submit order, then pay online
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeQuote) return;

    if (!customerName.trim() || !customerPhone.trim()) {
      alert("Please provide your name and valid mobile number");
      return;
    }

    if (fulfilmentType !== "pickup" && !deliveryAddress.trim() && !stayRoomNumber.trim()) {
      alert("Please provide delivery destination or stay room details");
      return;
    }

    setOrderSubmitting(true);
    try {
      const order = await foodService.createOrder({
        quoteId: activeQuote.quoteId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || undefined,
        deliveryAddress: deliveryAddress.trim(),
        deliveryInstructions: deliveryInstructions.trim(),
        stayBookingId: stayBookingId || undefined,
        stayRoomNumber: stayRoomNumber || undefined,
      });

      // Clear cart
      setCart([]);
      setCartOutlet(null);
      localStorage.removeItem("tirvona_food_cart");
      localStorage.removeItem("tirvona_food_cart_outlet");

      // Pay on the Tirvona Razorpay account. If the customer closes checkout,
      // the order stays payment-pending and the tracking page offers "Pay now".
      try {
        await payForFoodOrder(order._id, {
          name: customerName.trim(),
          email: customerEmail.trim() || undefined,
          contact: customerPhone.trim(),
        });
      } catch {
        // The checkout already showed why; the order is still open for payment.
      }

      navigate(`/food/orders/${order._id}`);
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Order creation failed");
      setOrderSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-[#070F1B] text-slate-900 dark:text-slate-100 pb-28">
      {/* 1. Header Banner & Hero */}
      <section className="relative overflow-hidden bg-gradient-to-r from-[#0B192C] via-[#132A4A] to-[#0B192C] text-white pt-8 pb-12 sm:pb-16 shadow-lg border-b border-amber-500/20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(242,140,40,0.15),transparent_50%)]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold mb-3 backdrop-blur-xs">
                <Sparkles size={13} className="text-amber-400 shrink-0" />
                <span>Tirvona Bhojan — Pilgrimage Dining Marketplace</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black font-['Kalam'] tracking-tight text-white">
                पवित्र ब्रज भोजन &amp; सात्विक थाली
              </h1>
              <p className="mt-2 text-sm sm:text-base text-slate-300 max-w-2xl font-medium">
                100% pure vegetarian, verified kitchen meals for devotees, ashram guests, and pilgrims in Vrindavan and Mathura.
              </p>
            </div>

            {/* Location & Stay-link Quick Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Zone Selector */}
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-2 flex items-center gap-2.5">
                <MapPin size={18} className="text-amber-400 shrink-0 ml-1" />
                <div className="flex flex-col text-left">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300">
                    Delivery Zone
                  </span>
                  <select
                    value={selectedZone}
                    onChange={(e) => setSelectedZone(e.target.value)}
                    className="bg-transparent text-xs font-bold text-white focus:outline-hidden cursor-pointer"
                  >
                    {zones.map((z) => (
                      <option
                        key={z.zoneCode}
                        value={z.zoneCode}
                        className="bg-slate-900 text-white"
                      >
                        {z.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Stay-Linked Button */}
              <button
                type="button"
                onClick={() => setShowStayModal(true)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border text-xs font-bold transition-all shadow-sm ${
                  stayLinkedConfirmed
                    ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-300"
                    : "bg-amber-500 hover:bg-amber-600 border-amber-400 text-white"
                }`}
              >
                <Bed size={16} />
                <span>
                  {stayLinkedConfirmed
                    ? `Stay Linked: ${stayRoomNumber ? `Room ${stayRoomNumber}` : "Ashram Delivery"}`
                    : "Staying at an Ashram? Link Room"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Search & Category Navigation Bar */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B192C]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search thalis, bowls, combos or kitchens..."
                className="w-full pl-10 pr-4 py-2 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:border-amber-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Launch Meal Family Pills: All, Thali, Bowl, Combo */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {[
                { id: "ALL", label: "All Meals" },
                { id: "THALI", label: "Thalis (थाली)" },
                { id: "BOWL", label: "Bowls (बाउल)" },
                { id: "COMBO", label: "Combos (कॉम्बो)" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFamily(f.id)}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    selectedFamily === f.id
                      ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dietary Declaration Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-[11px] font-semibold text-slate-500">
            <span className="flex items-center gap-1 text-slate-400 shrink-0">
              <Filter size={12} /> Diets:
            </span>
            {[
              { id: "all", label: "All Diets" },
              { id: "satvik", label: "100% Satvik (सात्विक)", icon: Sparkles },
              { id: "no_onion_garlic", label: "No Onion/Garlic (बिना लहसुन-प्याज)" },
              { id: "non_spicy", label: "Non-Spicy (कम तीखा)" },
              { id: "spicy", label: "Spicy (तीखा)", icon: Flame },
              { id: "vegetarian", label: "Pure Vegetarian" },
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedDietary(d.id)}
                className={`px-3 py-1 rounded-full border transition-all shrink-0 flex items-center gap-1 ${
                  selectedDietary === d.id
                    ? "bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-700 dark:text-amber-300 font-bold"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-600 dark:text-slate-400"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Main Discovery Feed */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Active Outlet Banner if Cart contains items */}
        {cartOutlet && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500 text-white">
                <Utensils size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                  Ordering from:
                </p>
                <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {cartOutlet.brandName}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {cartOutlet.address} • Delivery to {selectedZone}
                </p>
              </div>
            </div>
            <button
              onClick={() => setCartDrawerOpen(true)}
              className="px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm flex items-center gap-1.5"
            >
              <ShoppingBag size={14} />
              <span>
                View Cart ({cart.reduce((a, b) => a + b.quantity, 0)})
              </span>
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-80 rounded-3xl bg-slate-200 dark:bg-slate-800/60"
              />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-16 bg-white dark:bg-[#0B192C] rounded-3xl border border-red-200 dark:border-red-900/40 p-8">
            <AlertCircle className="mx-auto text-red-500 mb-3" size={36} />
            <p className="text-base font-bold text-red-600 dark:text-red-400">
              {error}
            </p>
            <button
              onClick={loadDiscovery}
              className="mt-4 px-6 py-2 rounded-full bg-amber-500 text-white text-xs font-bold"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredMeals.length === 0 && (
          <div className="text-center py-20 bg-white dark:bg-[#0B192C] rounded-3xl border border-slate-200 dark:border-slate-800 p-8">
            <Utensils className="mx-auto text-amber-500 mb-3 opacity-60" size={40} />
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              No approved meals found in {selectedZone}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Outlets in this zone are either currently closed or have reached their daily preparation capacity. Try selecting another zone or filter.
            </p>
          </div>
        )}

        {/* Meals Grid */}
        {!loading && !error && filteredMeals.length > 0 && (
          <Paginated items={filteredMeals} pageSize={12}>
            {(pageItems) => (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {pageItems.map((meal) => {
                const inCart = cart.find((c) => c.meal.id === meal.id);
                const isThali = meal.family === "THALI";
                const isCombo = meal.family === "COMBO";

              return (
                <div
                  key={meal.id}
                  className="group bg-white dark:bg-[#0B192C] rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    {/* Meal Image & Badge */}
                    {(() => {
                      const mealImages = (meal.imageUrls && meal.imageUrls.length > 0)
                        ? meal.imageUrls
                        : meal.imageUrl ? [meal.imageUrl] : [];
                      const primaryImage = mealImages[0] || meal.imageUrl || "";

                      return (
                        <div
                          className="relative h-48 w-full overflow-hidden bg-slate-100 dark:bg-slate-800 cursor-pointer"
                          onClick={() => {
                            setGalleryMeal(meal);
                            setGalleryIndex(0);
                          }}
                        >
                          {primaryImage ? (
                            <img
                              src={primaryImage}
                              alt={meal.label}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              loading="lazy"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src =
                                  "https://placehold.co/400x300?text=Satvik+Meal";
                              }}
                            />
                          ) : (
                            // No photo uploaded for this meal yet: a calm placeholder instead of a broken image.
                            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#FBF7F0] to-[#F4ECDF] text-[#C19A52] dark:from-slate-800 dark:to-slate-900" aria-hidden="true">
                              <Utensils size={30} />
                              <span className="text-[11px] font-semibold tracking-wide">{meal.label}</span>
                            </div>
                          )}
                          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-900/80 backdrop-blur-md text-amber-300 border border-amber-400/30">
                              {isThali
                                ? "थाली Thali"
                                : isCombo
                                ? "कॉम्बो Combo"
                                : "बाउल Bowl"}
                            </span>
                            {meal.dietaryTags?.includes("satvik") && (
                              <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-600/90 text-white backdrop-blur-xs flex items-center gap-1">
                                <Sparkles size={10} /> सात्विक
                              </span>
                            )}
                            {meal.dietaryTags?.includes("no_onion_garlic") && (
                              <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-blue-600/90 text-white backdrop-blur-xs">
                                No Onion/Garlic
                              </span>
                            )}
                          </div>

                          {/* Up to 5 photos indicator badge */}
                          {mealImages.length > 1 && (
                            <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-slate-900/85 backdrop-blur-md text-[10px] font-extrabold text-white flex items-center gap-1 border border-white/20 shadow-md">
                              <Image size={11} className="text-amber-400" />
                              <span>{mealImages.length} Photos</span>
                            </div>
                          )}

                          <div className="absolute bottom-3 right-3 px-2 py-1 rounded-full bg-black/70 backdrop-blur-xs text-[10px] font-bold text-slate-200 flex items-center gap-1">
                            <Clock size={11} className="text-amber-400" />
                            <span>{meal.prepMinutes} mins</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Meal Information */}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-base font-extrabold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                            {meal.label}
                          </h3>
                          {meal.outlet && (
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                              <span>By {meal.outlet.brandName}</span>
                              <span className="text-amber-500 font-bold">
                                ★ {meal.outlet.rating}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>

                        {/* Contents / Description */}
                        <p className="mt-2.5 text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                          {meal.contents}
                        </p>

                        {/* Portion Declaration */}
                        <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-slate-400">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
                            {meal.portion}
                          </span>
                          {isCombo && (
                            <span className="text-amber-600 dark:text-amber-400">
                              Includes Sides &amp; Accompaniments
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Pricing & Add-to-Cart Action */}
                    <div className="p-5 pt-0 border-t border-slate-100 dark:border-slate-800/80 mt-2 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Price
                        </span>
                        <span className="text-lg font-black text-slate-900 dark:text-white">
                          ₹{meal.priceRupees}
                        </span>
                      </div>

                      {isThali ? (
                        <button
                          type="button"
                          onClick={() => handleOpenThaliCustomizer(meal)}
                          className="px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold shadow-sm transition-all flex items-center gap-1"
                        >
                          <span>Customize Thali</span>
                          <ChevronRight size={14} />
                        </button>
                      ) : inCart ? (
                        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-400/50 rounded-full px-2 py-1">
                          <button
                            type="button"
                            onClick={() => updateQuantity(inCart.variantId, -1)}
                            className="p-1 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800 text-amber-900 dark:text-amber-200"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="text-xs font-black px-1.5 text-slate-900 dark:text-white">
                            {inCart.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(inCart.variantId, 1)}
                            className="p-1 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800 text-amber-900 dark:text-amber-200"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addToCart(meal)}
                          className="px-5 py-2 rounded-full bg-slate-900 dark:bg-amber-500 hover:bg-amber-600 dark:hover:bg-amber-600 text-white text-xs font-extrabold shadow-sm transition-all flex items-center gap-1.5"
                        >
                          <Plus size={14} />
                          <span>Add</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </Paginated>
        )}
      </main>

      {/* 4. Thali Variant Customizer Modal */}
      {customizingThali && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0B192C] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Configure Your Thali
                </h3>
                <p className="text-xs text-slate-500">
                  Select your exact dietary &amp; spice preference
                </p>
              </div>
              <button
                onClick={() => setCustomizingThali(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* 4 Documented Options */}
            <div className="space-y-3">
              {[
                {
                  gingerGarlic: false,
                  spicy: false,
                  label: "Without Ginger & Garlic (Satvik) — Non-Spicy",
                  hindi: "बिना अदरक-लहसुन सात्विक (कम तीखा)",
                  price: 199,
                  recommended: true,
                },
                {
                  gingerGarlic: false,
                  spicy: true,
                  label: "Without Ginger & Garlic (Satvik) — Spicy",
                  hindi: "बिना अदरक-लहसुन सात्विक (तीखा)",
                  price: 199,
                },
                {
                  gingerGarlic: true,
                  spicy: false,
                  label: "Ginger & Garlic Included — Non-Spicy",
                  hindi: "अदरक-लहसुन सहित (कम तीखा)",
                  price: 189,
                },
                {
                  gingerGarlic: true,
                  spicy: true,
                  label: "Ginger & Garlic Included — Spicy",
                  hindi: "अदरक-लहसुन सहित (तीखा)",
                  price: 189,
                },
              ].map((opt, i) => {
                const isSelected =
                  selectedThaliPreference.gingerGarlic === opt.gingerGarlic &&
                  selectedThaliPreference.spicy === opt.spicy;

                return (
                  <div
                    key={i}
                    onClick={() =>
                      setSelectedThaliPreference({
                        gingerGarlic: opt.gingerGarlic,
                        spicy: opt.spicy,
                      })
                    }
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? "bg-amber-50 dark:bg-amber-950/40 border-amber-500 shadow-xs"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          isSelected
                            ? "border-amber-500 bg-amber-500"
                            : "border-slate-400"
                        }`}
                      >
                        {isSelected && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          {opt.label}
                        </p>
                        <p className="text-[11px] text-slate-500">{opt.hindi}</p>
                      </div>
                    </div>
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                      ₹{opt.price}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setCustomizingThali(null)}
                className="px-4 py-2 rounded-full text-xs font-bold text-slate-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmThali}
                className="px-6 py-2.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold shadow-md"
              >
                Add Customized Thali to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Single-Outlet Conflict Modal */}
      {pendingCartSwitch && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0B192C] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <AlertCircle className="text-amber-500" size={32} />
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Start new cart from {pendingCartSwitch.meal.outlet?.brandName}?
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              In Release 1, orders are fulfilled by a single kitchen. Your current cart contains items from{" "}
              <strong>{cartOutlet?.brandName}</strong>. Adding this item will clear your previous selection.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setPendingCartSwitch(null)}
                className="px-4 py-2 rounded-full text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Keep Current Cart
              </button>
              <button
                onClick={confirmCartSwitch}
                className="px-5 py-2.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold shadow-md"
              >
                Clear &amp; Add New Meal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Stay-Linked Dialog Modal */}
      {showStayModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0B192C] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                <Bed className="text-amber-500" size={20} />
                <h3 className="text-base font-extrabold">Link Your Ashram Stay</h3>
              </div>
              <button
                onClick={() => setShowStayModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              If you have an active stay booked through Tirvona in Vrindavan or Mathura, enter your Booking ID or Room number for direct room/reception delivery.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase">
                  Tirvona Stay Booking ID
                </label>
                <input
                  type="text"
                  value={stayBookingId}
                  onChange={(e) => setStayBookingId(e.target.value)}
                  placeholder="e.g. TRV-BK-20261016-01"
                  className="w-full mt-1 px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase">
                  Room or Cottage Number
                </label>
                <input
                  type="text"
                  value={stayRoomNumber}
                  onChange={(e) => setStayRoomNumber(e.target.value)}
                  placeholder="e.g. Room 204 or Reception"
                  className="w-full mt-1 px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setStayLinkedConfirmed(false);
                  setStayBookingId("");
                  setStayRoomNumber("");
                  setShowStayModal(false);
                }}
                className="px-4 py-2 rounded-full text-xs font-bold text-slate-500"
              >
                Unlink
              </button>
              <button
                type="button"
                onClick={() => {
                  setStayLinkedConfirmed(true);
                  setFulfilmentType("stay_delivery");
                  setShowStayModal(false);
                }}
                className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md"
              >
                Confirm Room Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Cart Bottom Bar & Slide-Over Drawer */}
      {cart.length > 0 && !cartDrawerOpen && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-2xl mx-auto">
          <div
            onClick={() => setCartDrawerOpen(true)}
            className="bg-slate-900 text-white p-3.5 rounded-full shadow-2xl border border-slate-700 flex items-center justify-between cursor-pointer hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-3 ml-2">
              <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs">
                {cart.reduce((a, b) => a + b.quantity, 0)}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">
                  {cartOutlet?.brandName}
                </p>
                <p className="text-sm font-black text-amber-400">
                  ₹{totalPaise / 100}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mr-2 text-xs font-bold text-amber-300">
              <span>View Cart &amp; Checkout</span>
              <ChevronRight size={16} />
            </div>
          </div>
        </div>
      )}

      {/* Cart Slide-Over Drawer */}
      {cartDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end">
          <div className="bg-white dark:bg-[#0B192C] w-full max-w-md h-full flex flex-col justify-between shadow-2xl border-l border-slate-200 dark:border-slate-800">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Your Bhojan Cart
                </h3>
                <p className="text-xs text-slate-500">
                  {cartOutlet?.brandName}
                </p>
              </div>
              <button
                onClick={() => setCartDrawerOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {cart.map((item) => (
                <div
                  key={item.variantId}
                  className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800"
                >
                  <div className="flex-1">
                    <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                      {item.label}
                    </p>
                    <p className="text-xs text-slate-500 font-bold mt-0.5">
                      ₹{(item.pricePaise * item.quantity) / 100}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 bg-white dark:bg-slate-700 rounded-full px-2 py-1 shadow-xs border border-slate-200 dark:border-slate-600">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.variantId, -1)}
                      className="p-1 hover:text-amber-500"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-xs font-black px-1">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.variantId, 1)}
                      className="p-1 hover:text-amber-500"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              ))}

              {/* Fulfilment Mode Picker */}
              <div className="pt-2">
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-2">
                  Delivery Option
                </label>
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
                  {[
                    { id: "pickup", label: "Pickup", cost: "₹0" },
                    { id: "vendor_delivery", label: "Delivery", cost: "₹35" },
                    { id: "stay_delivery", label: "Stay Room", cost: "₹35" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setFulfilmentType(m.id as any)}
                      className={`p-2.5 rounded-2xl border transition-all ${
                        fulfilmentType === m.id
                          ? "bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-700 dark:text-amber-300"
                          : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <p>{m.label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{m.cost}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Itemized Price Breakdown */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Food Item Total</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    ₹{subtotalPaise / 100}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Satvik Food Packaging</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    ₹{packagingFeePaise / 100}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Delivery Fee</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    ₹{deliveryFeePaise / 100}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>GST (5%)</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    ₹{taxPaise / 100}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-black text-sm text-slate-900 dark:text-white">
                  <span>Grand Total</span>
                  <span className="text-amber-600 dark:text-amber-400">
                    ₹{totalPaise / 100}
                  </span>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-5 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <button
                type="button"
                onClick={handleProceedToCheckout}
                className="w-full py-3.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-sm font-extrabold shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Checkout Modal with Authoritative Quote */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0B192C] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Complete Your Order
                </h3>
                <p className="text-xs text-slate-500">
                  Server-generated authoritative price quote
                </p>
              </div>
              <button
                onClick={() => setCheckoutModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {quoteLoading && (
              <div className="py-12 text-center text-xs font-bold text-slate-500">
                Generating secure checkout quote...
              </div>
            )}

            {!quoteLoading && activeQuote && (
              <form onSubmit={handlePlaceOrder} className="space-y-4">
                {/* Contact details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-400">
                      Your Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Radhika Sharma"
                      className="w-full mt-1 px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-400">
                      Mobile Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full mt-1 px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                </div>

                {/* Delivery Address or Stay Details */}
                {fulfilmentType === "stay_delivery" ? (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/40 space-y-2">
                    <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                      <Bed size={14} /> Stay-Linked Delivery Destination
                    </p>
                    <input
                      type="text"
                      value={stayRoomNumber}
                      onChange={(e) => setStayRoomNumber(e.target.value)}
                      placeholder="Room number / Cottage / Reception"
                      className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-700"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-400">
                      Delivery Address *
                    </label>
                    <input
                      type="text"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Street, Ashram gate, Landmark in Vrindavan/Mathura"
                      className="w-full mt-1 px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-400">
                    Kitchen Instructions (Optional)
                  </label>
                  <input
                    type="text"
                    value={deliveryInstructions}
                    onChange={(e) => setDeliveryInstructions(e.target.value)}
                    placeholder="e.g. Ring bell, deliver at reception, extra napkins"
                    className="w-full mt-1 px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                {/* Authoritative Quote Breakup */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Quote ID</span>
                    <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300">
                      {activeQuote.quoteId}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-1">
                    <span>Total Amount Payable</span>
                    <span className="text-amber-600 dark:text-amber-400 text-sm">
                      ₹{activeQuote.pricing.totalRupees}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={orderSubmitting}
                  className="w-full py-3.5 rounded-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-extrabold shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShieldCheck size={16} />
                  <span>
                    {orderSubmitting
                      ? "Placing & Verifying Order..."
                      : `Pay ₹${activeQuote.pricing.totalRupees} & Place Order`}
                  </span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Product Photo Gallery Modal (Up to 5 images) ── */}
      {galleryMeal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
          onClick={() => setGalleryMeal(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative w-full max-w-2xl bg-white dark:bg-[#0B192C] rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Gallery Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {galleryMeal.label}
                </h3>
                <p className="text-xs text-slate-500">
                  {galleryMeal.outlet?.brandName} · {galleryMeal.family}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGalleryMeal(null)}
                aria-label="Close photo gallery"
                className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Main Image Stage */}
            {(() => {
              const images = (galleryMeal.imageUrls && galleryMeal.imageUrls.length > 0)
                ? galleryMeal.imageUrls
                : galleryMeal.imageUrl ? [galleryMeal.imageUrl] : [];
              const currentImage = images[galleryIndex] || images[0] || "";

              return (
                <div className="flex flex-col">
                  <div className="relative aspect-4/3 sm:aspect-16/10 w-full bg-slate-950 flex items-center justify-center overflow-hidden">
                    <img
                      src={currentImage}
                      alt={`${galleryMeal.label} photo ${galleryIndex + 1}`}
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          "https://placehold.co/600x400?text=Food+Photo";
                      }}
                    />

                    {/* Prev / Next controls */}
                    {images.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setGalleryIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))}
                          className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center cursor-pointer transition-colors"
                          aria-label="Previous photo"
                        >
                          <ChevronLeft size={20} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setGalleryIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center cursor-pointer transition-colors"
                          aria-label="Next photo"
                        >
                          <ChevronRight size={20} />
                        </button>
                      </>
                    )}

                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/70 backdrop-blur-xs text-white text-[11px] font-bold">
                      {galleryIndex + 1} of {images.length}
                    </div>
                  </div>

                  {/* Thumbnail Row */}
                  {images.length > 1 && (
                    <div className="flex gap-2 p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 overflow-x-auto">
                      {images.map((url, idx) => (
                        <button
                          key={`${url}-${idx}`}
                          type="button"
                          onClick={() => setGalleryIndex(idx)}
                          className={`relative h-14 w-20 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                            galleryIndex === idx
                              ? "border-amber-500 ring-2 ring-amber-500/30 scale-102"
                              : "border-transparent opacity-60 hover:opacity-100"
                          }`}
                        >
                          <img
                            src={url}
                            alt={`Thumbnail ${idx + 1}`}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                "https://placehold.co/100x70?text=Food";
                            }}
                          />
                          {idx === 0 && (
                            <span className="absolute bottom-0.5 right-0.5 bg-black/75 text-[8px] font-bold text-amber-300 px-1 rounded">
                              Cover
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Modal Footer with Inclusions & Add to Cart */}
                  <div className="p-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0B192C]">
                    <div>
                      <p className="text-base font-extrabold text-amber-600 dark:text-amber-400">
                        ₹{galleryMeal.priceRupees || (galleryMeal.pricePaise / 100)}
                      </p>
                      {galleryMeal.contents && (
                        <p className="text-[11px] text-slate-500 line-clamp-1 max-w-xs">
                          {galleryMeal.contents}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        addToCart(galleryMeal);
                        setGalleryMeal(null);
                      }}
                      className="px-5 py-2.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={14} /> Add to Order
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
