import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Clock,
  ShieldCheck,
  Droplets,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Users,
  ChevronRight,
  ChevronDown,
  Info,
  Lock,
  BedDouble,
  Sun,
  Moon,
  Check,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { dayStayService } from "../../services";
import { openRazorpayCheckout } from "../../lib/razorpay";
import {
  saveBookingDraft,
  getBookingDraft,
  clearBookingDraft,
} from "../../utils/bookingDraft";
import { setGuestPendingIntent } from "../../utils/guestGate";
import { istTodayString } from "../../utils/format";

interface DayStayBookingCardProps {
  ashram: any;
  rooms: any[];
  selectedRoomId?: string;
  onSelectRoom?: (roomId: string) => void;
  onSuccess?: (bookingResult: any) => void;
}

const format12H = (time24: string): string => {
  if (!time24) return "";
  const parts = time24.split(":");
  let h = parseInt(parts[0], 10);
  const m = parts[1] || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
};

export const DayStayBookingCard: React.FC<DayStayBookingCardProps> = ({
  ashram,
  rooms,
  selectedRoomId: externalSelectedRoomId,
  onSelectRoom,
  onSuccess,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("DAY_REST_4H");
  const [internalRoomId, setInternalRoomId] = useState<string>("");
  const [date, setDate] = useState<string>(istTodayString());
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [guestsCount, setGuestsCount] = useState<number>(2);
  const [specialRequests, setSpecialRequests] = useState<string>("");
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [restoredDraft, setRestoredDraft] = useState<boolean>(false);
  const [roomDropdownOpen, setRoomDropdownOpen] = useState<boolean>(false);
  const [timeFilter, setTimeFilter] = useState<"all" | "morning" | "afternoon" | "evening">("all");

  // Eligible day stay rooms: only rooms the owner has explicitly opted into
  // Day Stay. A missing dayStayConfig (legacy rooms created before this
  // feature existed) must NOT be treated as eligible — such rooms were
  // never given day-stay pricing/inventory/amenities by the owner.
  const eligibleRooms = (rooms || []).filter(
    (r) => r.dayStayConfig?.enabled === true && r.status !== "inactive"
  );
  const activeRooms = eligibleRooms;

  const selectedRoomId = externalSelectedRoomId || internalRoomId || (activeRooms[0] ? String(activeRooms[0]._id) : "");

  const handleRoomChange = (rId: string) => {
    setInternalRoomId(rId);
    if (onSelectRoom) onSelectRoom(rId);
  };

  // Restore draft if guest was redirected to login and returned
  useEffect(() => {
    const draft = getBookingDraft();
    if (draft && draft.ashramId === String(ashram?._id) && draft.dayStay) {
      if (draft.dayStay.productCode) setSelectedProduct(draft.dayStay.productCode);
      if (draft.roomId) {
        setInternalRoomId(draft.roomId);
        if (onSelectRoom) onSelectRoom(draft.roomId);
      }
      if (draft.dayStay.date) setDate(draft.dayStay.date);
      if (draft.guestsCount) setGuestsCount(draft.guestsCount);
      if (draft.specialRequests) setSpecialRequests(draft.specialRequests);
      setRestoredDraft(true);
    }
  }, [ashram?._id]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await dayStayService.getProducts();
        if (Array.isArray(res.data)) {
          setProducts(res.data);
          if (res.data.length > 0 && !selectedProduct) {
            setSelectedProduct(res.data[0].productCode);
          }
        }
      } catch (err) {
        console.error("Failed to load Day Stay products:", err);
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    if (activeRooms.length > 0 && !selectedRoomId) {
      handleRoomChange(String(activeRooms[0]._id));
    }
  }, [activeRooms, selectedRoomId]);

  useEffect(() => {
    if (!ashram?._id || !selectedRoomId || !date) return;

    const loadAvailability = async () => {
      setLoadingSlots(true);
      setError(null);
      try {
        const res = await dayStayService.getAvailability({
          ashramId: ashram._id,
          roomId: selectedRoomId,
          date,
          productCode: selectedProduct,
        });
        if (res.data?.slots) {
          setSlots(res.data.slots);
          const draft = getBookingDraft();
          const targetTime = draft?.dayStay?.startTime;
          const matchedDraftSlot = targetTime ? res.data.slots.find((s: any) => s.startTime === targetTime && s.isAvailable) : null;
          const firstAvail = matchedDraftSlot || res.data.slots.find((s: any) => s.isAvailable);
          setSelectedSlot(firstAvail || null);
        }
      } catch (err: any) {
        console.error("Failed to fetch slots:", err);
        setError("Unable to load time slots. Please try another date or room.");
      } finally {
        setLoadingSlots(false);
      }
    };

    loadAvailability();
  }, [ashram?._id, selectedRoomId, date, selectedProduct]);

  if (!ashram?.dayStayConfig?.enabled || activeRooms.length === 0) {
    return (
      <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center space-y-2">
        <Sparkles className="w-8 h-8 text-slate-900 dark:text-white mx-auto" />
        <h4 className="text-base font-bold text-[#0B192C] dark:text-white">
          Day Stay & Freshen-Up
        </h4>
        <p className="text-xs text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
          Short stay is currently not offered or fully booked at this property. Please check back later.
        </p>
      </div>
    );
  }

  const selectedRoomObj = activeRooms.find((r) => String(r._id) === selectedRoomId) || activeRooms[0];
  const activeProductDef = products.find((p) => p.productCode === selectedProduct);
  const defaultProductPrice = selectedProduct === "DAY_REST_4H" ? 699 : 1199;
  const roomProductPricing = selectedRoomObj?.dayStayConfig?.pricingByProduct?.[selectedProduct] || selectedRoomObj?.dayStayConfig?.products?.find(
    (p: any) => p.productCode === selectedProduct
  )?.price;

  const price = selectedSlot?.price || roomProductPricing || defaultProductPrice;
  const gstAmount = Math.round(price * 0.18);
  const totalAmount = price + gstAmount;

  const handleBookingHold = async () => {
    if (!selectedSlot) {
      setError("Please select an available time slot.");
      return;
    }

    // 1. Guest Authentication Gate: If guest is not logged in OR logged in with Admin/Owner profile,
    // save draft selections and redirect to login page for Guest booking.
    if (!user || user.role !== "customer") {
      const currentUrl = window.location.pathname + window.location.search;
      saveBookingDraft({
        ashramId: ashram._id,
        roomId: selectedRoomId,
        roomType: selectedRoomObj?.name,
        dayStay: {
          productCode: selectedProduct,
          date,
          startTime: selectedSlot.startTime,
          price,
        },
        checkIn: `${date}T${selectedSlot.startTime}:00`,
        checkOut: `${date}T${selectedSlot.endTime}:00`,
        guestsCount,
        adults: guestsCount,
        children: 0,
        specialRequests,
        returnUrl: currentUrl,
        timestamp: Date.now(),
      });
      setGuestPendingIntent({
        type: "day_stay_booking",
        returnUrl: currentUrl,
      });
      navigate(`/login?redirect=${encodeURIComponent(currentUrl)}`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 2. Hold slot atomically
      const holdRes = await dayStayService.holdSlot({
        ashramId: ashram._id,
        roomId: selectedRoomId,
        productCode: selectedProduct,
        date,
        startTime: selectedSlot.startTime,
        guestsCount,
        specialRequests,
      });

      const holdData = holdRes.data;

      // 3. Open Official Razorpay Checkout Modal
      const paymentResult = await openRazorpayCheckout(
        {
          orderId: holdData.razorpayOrderId,
          // Charge exactly what the server priced into the order.
          amount: Math.round((holdData.pricing?.totalAmount ?? totalAmount) * 100),
          currency: "INR",
          keyId: holdData.razorpayKeyId || holdData.keyId,
        },
        {
          name: user.name || "",
          email: user.email || "",
          contact: user.phone || "",
        },
        {
          name: "Tirvona",
          description: `${holdData.productName || "Day Stay"} — ${ashram.name}`,
        }
      );

      // 4. Confirm Payment and record in history
      const confirmRes = await dayStayService.confirmPayment({
        bookingId: holdData.bookingId,
        razorpayOrderId: paymentResult.razorpay_order_id,
        razorpayPaymentId: paymentResult.razorpay_payment_id,
        razorpaySignature: paymentResult.razorpay_signature,
      });

      if (confirmRes.data?.success) {
        clearBookingDraft();
        setRestoredDraft(false);
        if (onSuccess) onSuccess(confirmRes.data);
      } else {
        throw new Error("Payment verification was not completed.");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Failed to complete Day Stay reservation.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="day-stay-card" className="bg-white dark:bg-[#0B192C] rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xl p-5 sm:p-6 space-y-5 scroll-mt-24">
      {/* Header with Verified Pilgrim Badge */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
        <div>
          <h3 className="text-lg font-black text-[#0B192C] dark:text-white">
            Short Stay & Freshen-Up
          </h3>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
            From
          </span>
          <span className="text-xl font-extrabold text-[#F28C28] dark:text-amber-400">
            ₹{price}
          </span>
        </div>
      </div>

      {restoredDraft && (
        <div className="p-3 bg-[#F28C28]/10 border border-[#F28C28]/20 rounded-xl flex items-center justify-between text-xs font-semibold text-[#F28C28]">
          <div className="flex items-center gap-1.5">
            <Sparkles size={14} className="text-[#F28C28] shrink-0" />
            <span>Your short stay selections have been restored.</span>
          </div>
          <button
            type="button"
            onClick={() => {
              clearBookingDraft();
              setRestoredDraft(false);
            }}
            className="text-[10px] font-bold text-gray-500 hover:text-rose-600 underline cursor-pointer shrink-0"
          >
            Clear
          </button>
        </div>
      )}

      {user && user.role !== "customer" && (
        <div className="p-3 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
          <div className="flex items-center gap-1.5">
            <Info size={14} className="text-slate-900 dark:text-white shrink-0" />
            <span>Signed in as {(user.role || "Admin").replace(/_/g, " ")}. Stays are booked with a Guest account.</span>
          </div>
          <button
            type="button"
            onClick={handleBookingHold}
            className="text-[10px] font-bold text-[#F28C28] hover:underline cursor-pointer shrink-0 ml-2"
          >
            Sign in as Guest
          </button>
        </div>
      )}

      {/* Verified Amenities Guarantee */}
      <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800/80 text-[11px] font-bold text-gray-700 dark:text-gray-300">
        <div className="flex items-center gap-1.5">
          <Droplets size={14} className="text-[#F28C28] shrink-0" />
          <span>Clean Bathroom</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Droplets size={14} className="text-[#F28C28] shrink-0" />
          <span>Hot Water Geyser</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-[#F28C28] shrink-0" />
          <span>Family Safe</span>
        </div>
      </div>

      {/* Product Duration Selection */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between">
          <span>Stay Duration</span>
          <span className="text-[10px] text-[#F28C28] dark:text-amber-400 font-extrabold">
            {selectedProduct === "DAY_REST_4H" ? "4 Hours" : "6 Hours"}
          </span>
        </label>
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-gray-100 dark:bg-slate-900 border border-gray-200/60 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setSelectedProduct("DAY_REST_4H")}
            className={`py-2.5 px-3 rounded-lg text-xs font-extrabold transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 ${
              selectedProduct === "DAY_REST_4H"
                ? "bg-[#F28C28] text-white shadow-md"
                : "text-gray-600 dark:text-gray-400 hover:text-[#0B192C] dark:hover:text-white"
            }`}
          >
            <Clock size={13} />
            <span>4 Hours Stay</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedProduct("DAY_REST_6H")}
            className={`py-2.5 px-3 rounded-lg text-xs font-extrabold transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 ${
              selectedProduct === "DAY_REST_6H"
                ? "bg-[#F28C28] text-white shadow-md"
                : "text-gray-600 dark:text-gray-400 hover:text-[#0B192C] dark:hover:text-white"
            }`}
          >
            <Clock size={13} />
            <span>6 Hours Stay</span>
          </button>
        </div>
      </div>

      {/* Room Category Custom Popover Selector */}
      <div className="space-y-1.5 relative">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between">
          <span>Room Category</span>
          <span className="text-[10px] text-[#F28C28] dark:text-amber-400 font-extrabold">
            {activeRooms.length} Available
          </span>
        </label>
        <button
          type="button"
          onClick={() => setRoomDropdownOpen(!roomDropdownOpen)}
          className="w-full p-2.5 sm:p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-left flex items-center justify-between transition-all hover:border-[#F28C28] cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#F28C28]/10 text-[#F28C28] flex items-center justify-center shrink-0">
              <BedDouble size={16} />
            </div>
            <div className="truncate">
              <div className="text-xs font-black text-[#0B192C] dark:text-white truncate">
                {selectedRoomObj?.name || "Select Room Category"}
              </div>
              <div className="text-[10px] text-gray-400 font-bold">
                {selectedRoomObj?.acType || "Standard"} • Max {selectedRoomObj?.capacity || 2} Guests
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-black text-[#F28C28] dark:text-amber-400">
              ₹{price}
            </span>
            <ChevronDown
              size={15}
              className={`text-gray-400 transition-transform ${roomDropdownOpen ? "rotate-180" : ""}`}
            />
          </div>
        </button>

        {roomDropdownOpen && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl z-30 p-1.5 space-y-1 max-h-56 overflow-y-auto">
            {activeRooms.map((r) => {
              const isSelected = String(r._id) === selectedRoomId;
              const rPricing =
                r.dayStayConfig?.pricingByProduct?.[selectedProduct] ||
                (selectedProduct === "DAY_REST_4H" ? 699 : 1199);
              return (
                <button
                  key={r._id}
                  type="button"
                  onClick={() => {
                    handleRoomChange(String(r._id));
                    setRoomDropdownOpen(false);
                  }}
                  className={`w-full p-2.5 rounded-lg text-left transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? "bg-[#F28C28]/10 text-[#F28C28] dark:text-white font-black"
                      : "hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 font-bold"
                  }`}
                >
                  <div className="truncate pr-2">
                    <div className="text-xs truncate">{r.name}</div>
                    <div className="text-[10px] opacity-70">
                      {r.acType || "Standard"} • Max {r.capacity || 2} Guests
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-black">₹{rPricing}</span>
                    {isSelected && <Check size={14} className="text-[#F28C28]" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Date & Guests Selection */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            Date
          </label>
          <div className="relative">
            <input
              type="date"
              value={date}
              min={istTodayString()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-xs font-bold text-[#0B192C] dark:text-white focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            Pilgrims
          </label>
          <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => setGuestsCount(Math.max(1, guestsCount - 1))}
              className="w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-800 text-[#0B192C] dark:text-white flex items-center justify-center font-black cursor-pointer"
            >
              -
            </button>
            <span>{guestsCount}</span>
            <button
              type="button"
              onClick={() => setGuestsCount(Math.min(selectedRoomObj?.capacity || 6, guestsCount + 1))}
              className="w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-800 text-[#0B192C] dark:text-white flex items-center justify-center font-black cursor-pointer"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Arrival Time Selection with Period Filters */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Clock size={13} className="text-[#F28C28]" />
            <span>Select Arrival Time Window</span>
          </label>
          <span className="text-[11px] text-gray-400 font-bold">
            15m Grace Included
          </span>
        </div>

        {/* Quick Period Filter Chips */}
        <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-gray-100 dark:bg-slate-900 border border-gray-200/60 dark:border-slate-800 text-[10px] font-black">
          <button
            type="button"
            onClick={() => setTimeFilter("all")}
            className={`py-1 rounded-md transition-all cursor-pointer text-center ${
              timeFilter === "all"
                ? "bg-white dark:bg-slate-800 text-[#F28C28] dark:text-white shadow-2xs"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setTimeFilter("morning")}
            className={`py-1 rounded-md transition-all cursor-pointer text-center flex items-center justify-center gap-0.5 ${
              timeFilter === "morning"
                ? "bg-white dark:bg-slate-800 text-[#F28C28] dark:text-white shadow-2xs"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <Sun size={10} />
            <span>Morning</span>
          </button>
          <button
            type="button"
            onClick={() => setTimeFilter("afternoon")}
            className={`py-1 rounded-md transition-all cursor-pointer text-center flex items-center justify-center gap-0.5 ${
              timeFilter === "afternoon"
                ? "bg-white dark:bg-slate-800 text-[#F28C28] dark:text-white shadow-2xs"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <Sun size={10} />
            <span>Afternoon</span>
          </button>
          <button
            type="button"
            onClick={() => setTimeFilter("evening")}
            className={`py-1 rounded-md transition-all cursor-pointer text-center flex items-center justify-center gap-0.5 ${
              timeFilter === "evening"
                ? "bg-white dark:bg-slate-800 text-[#F28C28] dark:text-white shadow-2xs"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <Moon size={10} />
            <span>Evening</span>
          </button>
        </div>

        {loadingSlots ? (
          <div className="py-6 text-center text-xs font-bold text-gray-400 animate-pulse">
            Checking real-time slot inventory...
          </div>
        ) : slots.length === 0 ? (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-center text-xs font-bold text-rose-600 dark:text-rose-400">
            No time slots available for the selected duration on this date.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 max-h-44 overflow-y-auto pr-1">
            {slots
              .filter((slot) => {
                if (timeFilter === "all") return true;
                const h = parseInt(slot.startTime.split(":")[0], 10);
                if (timeFilter === "morning") return h < 12;
                if (timeFilter === "afternoon") return h >= 12 && h < 17;
                if (timeFilter === "evening") return h >= 17;
                return true;
              })
              .map((slot, idx) => {
                const isSelected = selectedSlot?.startTime === slot.startTime;
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={!slot.isAvailable}
                    onClick={() => setSelectedSlot(slot)}
                    className={`p-2 rounded-xl text-xs font-black border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                      !slot.isAvailable
                        ? "opacity-35 bg-gray-100 dark:bg-slate-900 border-gray-200 dark:border-slate-800 cursor-not-allowed line-through"
                        : isSelected
                        ? "bg-[#F28C28] text-white border-[#F28C28] shadow-md scale-[1.02]"
                        : "bg-gray-50 dark:bg-slate-900/70 text-[#0B192C] dark:text-white border-gray-200/80 dark:border-slate-800 hover:border-[#F28C28]"
                    }`}
                  >
                    <span>{format12H(slot.startTime)}</span>
                    <span className="text-[10px] font-bold opacity-80">
                      to {format12H(slot.endTime)}
                    </span>
                  </button>
                );
              })}
          </div>
        )}

        {/* Selected Slot Confirmation Bar */}
        {selectedSlot && (
          <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-[11px] font-bold text-[#F28C28] dark:text-amber-300 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles size={12} className="shrink-0 text-[#F28C28]" />
              <span>
                Arrival: <strong>{format12H(selectedSlot.startTime)}</strong> → Departure: <strong>{format12H(selectedSlot.endTime)}</strong>
              </span>
            </div>
            <span className="text-[10px] opacity-75 font-semibold">+15m Grace</span>
          </div>
        )}
      </div>

      {/* Operational Policy Transparency */}
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 space-y-1 leading-relaxed">
        <div className="flex items-center gap-1.5 font-black text-slate-900 dark:text-white">
          <Info size={13} className="text-slate-900 dark:text-white shrink-0" />
          <span>Important Operational Rules:</span>
        </div>
        <p>
          • <strong>Arrival Window:</strong> Access begins promptly at slot start time.
          <br />• <strong>15-Minute Grace:</strong> Check out within 15 minutes of completion to ensure seamless housekeeping.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Booking / Payment Action CTA */}
      <button
        type="button"
        disabled={submitting || !selectedSlot}
        onClick={handleBookingHold}
        className="w-full py-3.5 rounded-full bg-[#F28C28] hover:bg-[#D97706] text-white text-sm font-black shadow-lg shadow-[#F28C28]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? (
          <span>Opening Secure Payment...</span>
        ) : !user ? (
          <>
            <Lock size={15} />
            <span>Login to Reserve Short Stay • ₹{totalAmount}</span>
            <ChevronRight size={16} />
          </>
        ) : (
          <>
            <span>Reserve Short Stay • ₹{totalAmount}</span>
            <ChevronRight size={16} />
          </>
        )}
      </button>
    </div>
  );
};
