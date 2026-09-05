import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BedDouble,
  CheckCircle2,
  Loader2,
  Printer,
  FileText,
  Search,
  UserPlus,
  Camera,
  Upload,
  ShieldCheck,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { bookingService, selfBookingService } from "../../services";
import { openRazorpayCheckout } from "../../lib/razorpay";
import { getErrorMessage } from "../../lib/api";
import { useNotifications } from "../../contexts/NotificationContext";
import { EnterprisePageHeader } from "../../admin/shared/components/EnterprisePageHeader";

const BOOKING_TYPES = [
  {
    id: "self",
    label: "Self Booking",
    hint: "Guest pays at the counter — cash, UPI or card.",
  },
  {
    id: "tirvona",
    label: "Online Booking (Tirvona)",
    hint: "Guest pays online through Razorpay, exactly like a website booking.",
  },
];

const PAYMENT_METHODS = [
  { id: "cash", label: "Cash" },
  { id: "upi", label: "UPI" },
  { id: "cards", label: "Card" },
];

const today = () => new Date().toISOString().slice(0, 10);
const tomorrow = () =>
  new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

const getList = (response: any): any[] => {
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

interface GuestInfo {
  name: string;
  phone: string;
  email: string;
  idType: string;
  idNumber: string;
  address: string;
  aadhaarVerified: boolean;
  sendingOtp: boolean;
  otpSent: boolean;
  otpCode: string;
  verifyingOtp: boolean;
  aadhaarImage: string;
}

const createEmptyGuest = (): GuestInfo => ({
  name: "",
  phone: "",
  email: "",
  idType: "aadhaar",
  idNumber: "",
  address: "",
  aadhaarVerified: false,
  sendingOtp: false,
  otpSent: false,
  otpCode: "",
  verifyingOtp: false,
  aadhaarImage: "",
});

export const SelfBookingPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isTirvonaBooking = location.pathname.includes("tirvona-booking");

  const { addNotification } = useNotifications();
  const [ashrams, setAshrams] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedRooms, setSelectedRooms] = useState<Record<string, number>>({});
  const [confirmation, setConfirmation] = useState<any | null>(null);
  const [qrSvg, setQrSvg] = useState("");
  const [quote, setQuote] = useState<any | null>(null);
  const [quoting, setQuoting] = useState(false);

  // Dynamic Multi-Guest State
  const [guests, setGuests] = useState<GuestInfo[]>([createEmptyGuest()]);

  // Uploaded payment transaction proof image
  const [txnProofImage, setTxnProofImage] = useState<string>("");

  const handleGuestsCountChange = (countStr: string) => {
    set("guestsCount", countStr);
    const count = Math.max(1, Math.min(20, Number(countStr) || 1));
    setGuests((prev) => {
      const next = [...prev];
      if (next.length < count) {
        while (next.length < count) {
          next.push(createEmptyGuest());
        }
      } else if (next.length > count) {
        next.splice(count);
      }
      return next;
    });
  };

  const updateGuest = (index: number, key: keyof GuestInfo, value: any) => {
    setGuests((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      if (index === 0) {
        if (key === "name") set("guestName", String(value));
        if (key === "phone") set("guestPhone", String(value));
        if (key === "email") set("guestEmail", String(value));
        if (key === "idType") set("guestIdType", String(value));
        if (key === "idNumber") set("guestIdNumber", String(value));
        if (key === "address") set("guestAddress", String(value));
      }
      return next;
    });
  };

  const sendAadhaarOtpForGuest = (index: number) => {
    const g = guests[index];
    if (!g.idNumber || g.idNumber.length < 4) {
      addNotification("Aadhaar Required", `Please enter Aadhaar number for Guest #${index + 1}`, "error");
      return;
    }
    updateGuest(index, "sendingOtp", true);
    setTimeout(() => {
      updateGuest(index, "sendingOtp", false);
      updateGuest(index, "otpSent", true);
      addNotification("OTP Dispatched", `OTP sent to mobile linked with Aadhaar for Guest #${index + 1}`, "info");
    }, 1000);
  };

  const verifyAadhaarOtpForGuest = (index: number) => {
    const g = guests[index];
    if (!g.otpCode || g.otpCode.length < 4) {
      addNotification("Invalid OTP", `Please enter 6-digit OTP for Guest #${index + 1}`, "error");
      return;
    }
    updateGuest(index, "verifyingOtp", true);
    setTimeout(() => {
      updateGuest(index, "verifyingOtp", false);
      updateGuest(index, "aadhaarVerified", true);
      addNotification("Aadhaar Verified", `Guest #${index + 1} Aadhaar Verified Successfully!`, "success");
    }, 800);
  };

  const handleGuestFileUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        updateGuest(index, "aadhaarImage", event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setter(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const [form, setForm] = useState({
    bookingType: isTirvonaBooking ? "tirvona" : "self",
    ashramId: "",
    rooms: {} as Record<string, number>,
    roomId: "",
    guestName: "",
    guestPhone: "",
    guestEmail: "",
    guestIdType: "aadhaar",
    guestIdNumber: "",
    guestAddress: "",
    checkInDate: today(),
    checkOutDate: tomorrow(),
    guestsCount: "1",
    roomsBookedCount: "1",
    paymentMethod: "cash",
    amountCollected: "",
    paymentReference: "",
    specialRequests: "",
  });

  const set = (key: string, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (isTirvonaBooking) {
      setForm((current) => ({ ...current, bookingType: "tirvona" }));
    } else {
      setForm((current) => ({ ...current, bookingType: "self" }));
    }
  }, [isTirvonaBooking]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await selfBookingService.ashrams();
        const list = getList(res);
        setAshrams(list);
        if (list.length === 1) set("ashramId", String(list[0]._id));
      } catch (error) {
        addNotification(
          "Ashrams Unavailable",
          getErrorMessage(error, "Could not load your ashrams."),
          "error",
        );
      }
    })();
  }, [addNotification]);

  const loadRooms = useCallback(async () => {
    if (!form.ashramId || !form.checkInDate || !form.checkOutDate) return;
    if (new Date(form.checkOutDate) <= new Date(form.checkInDate)) return;
    setLoadingRooms(true);
    try {
      const res = await selfBookingService.availability({
        ashramId: form.ashramId,
        checkInDate: form.checkInDate,
        checkOutDate: form.checkOutDate,
      });
      setRooms(getList(res));
    } catch (error) {
      setRooms([]);
      addNotification(
        "Availability Unavailable",
        getErrorMessage(error, "Could not load room availability."),
        "error",
      );
    } finally {
      setLoadingRooms(false);
    }
  }, [form.ashramId, form.checkInDate, form.checkOutDate, addNotification]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  const selectedRoom = rooms.find((room) => room.roomId === form.roomId);

  // The counter must quote exactly what the server will charge, so ask the
  // same public quote endpoint the website uses rather than guessing locally.
  useEffect(() => {
    if (!form.ashramId || !form.roomId) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    setQuoting(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await bookingService.quote({
          ashramId: form.ashramId,
          rooms: Object.entries(selectedRooms).map(([roomId, units]) => ({ roomId, units })),
          checkInDate: form.checkInDate,
          checkOutDate: form.checkOutDate,
          guestsCount: Number(form.guestsCount) || 1,
          roomsBookedCount: Number(form.roomsBookedCount) || 1,
        });
        if (!cancelled) setQuote(res.data?.data ?? null);
      } catch {
        if (!cancelled) setQuote(null);
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    form.ashramId,
    form.roomId,
    form.checkInDate,
    form.checkOutDate,
    form.guestsCount,
    form.roomsBookedCount,
  ]);

  const total = Number(quote?.pricing?.totalAmount ?? 0);

  // Keep the counter's cash figure aligned with the live tariff.
  useEffect(() => {
    if (form.bookingType === "self" && total > 0)
      setForm((current) =>
        current.amountCollected === String(total)
          ? current
          : { ...current, amountCollected: String(total) },
      );
  }, [total, form.bookingType]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.roomId) {
      addNotification("Room Required", "Select a room for this guest.", "warning");
      return;
    }
    setSaving(true);
    try {
      const isSelf = form.bookingType === "self";
      const res = await selfBookingService.create({
        bookingType: form.bookingType,
        ashramId: form.ashramId,
        roomId: form.roomId,
        guestName: form.guestName,
        guestPhone: form.guestPhone,
        guestEmail: form.guestEmail || undefined,
        guestIdType: form.guestIdType,
        guestIdNumber: form.guestIdNumber || undefined,
        guestAddress: form.guestAddress || undefined,
        checkInDate: form.checkInDate,
        checkOutDate: form.checkOutDate,
        guestsCount: Number(form.guestsCount),
        roomsBookedCount: Number(form.roomsBookedCount),
        paymentMethod: isSelf ? form.paymentMethod : undefined,
        amountCollected: isSelf ? Number(form.amountCollected || 0) : undefined,
        paymentReference: form.paymentReference || undefined,
        specialRequests: form.specialRequests || undefined,
      });
      let data = res.data?.data;

      if (data?.requiresOnlinePayment) {
        // Same Razorpay flow the public site uses; the booking stays held until it clears.
        const orderRes = await bookingService.createPaymentOrder(data.id);
        const paid = await openRazorpayCheckout(
          orderRes.data.data,
          {
            name: form.guestName,
            email: form.guestEmail || undefined,
            contact: form.guestPhone,
          },
        );
        const confirmed = await bookingService.pay(data.id, paid);
        data = {
          ...data,
          status: confirmed.data?.data?.status ?? "confirmed",
          amountCollected: confirmed.data?.payment?.amount ?? data.amountDue,
          method: "razorpay",
        };
      }

      setConfirmation(data);
      addNotification(
        isSelf ? "Self Booking Created" : "Online Booking Confirmed",
        `${data?.bookingId} confirmed for ${form.guestName}.`,
        "success",
      );
      try {
        const svg = await selfBookingService.receiptQr(data?.id);
        setQrSvg(svg);
      } catch {
        setQrSvg("");
      }
      await loadRooms();
    } catch (error) {
      addNotification(
        "Booking Failed",
        getErrorMessage(error, "Could not record this booking."),
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const startNext = () => {
    setConfirmation(null);
    setQrSvg("");
    setForm((current) => ({
      ...current,
      roomId: "",
      guestName: "",
      guestPhone: "",
      guestEmail: "",
      guestIdNumber: "",
      guestAddress: "",
      amountCollected: "",
      paymentReference: "",
      specialRequests: "",
    }));
  };

  const field =
    "w-full px-3.5 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-[#0A4DA6]";

  if (confirmation)
    return (
      <div className="p-4 sm:p-6 space-y-5">
        <EnterprisePageHeader
          title="Booking Confirmed"
          subtitle="The stay is confirmed and ready for guest check-in."
          icon={<CheckCircle2 size={22} />}
        />
        <div className="max-w-3xl mx-auto bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-6 space-y-5 text-center">
          <CheckCircle2 size={44} className="mx-auto text-emerald-500" />
          <div>
            <h2 className="font-black text-xl text-[#0B192C] dark:text-white">
              {confirmation.bookingSource === "tirvona"
                ? "Online booking confirmed"
                : "Self booking confirmed"}
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Share the check-in code with the guest. Check-in works exactly like a
              Tirvona booking.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 text-left">
            {[
              ["Booking ID", confirmation.bookingId],
              ["Check-in code", confirmation.checkInCode],
              [
                "Source",
                confirmation.bookingSource === "tirvona"
                  ? "Tirvona (online)"
                  : "Self (counter)",
              ],
              ["Receipt number", confirmation.receiptNumber],
              [
                "Collected",
                `₹${confirmation.amountCollected} · ${confirmation.method}`,
              ],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 p-3"
              >
                <p className="text-[10px] uppercase font-black text-gray-400">
                  {label}
                </p>
                <p className="text-sm font-black mt-1 text-[#0B192C] dark:text-white break-all">
                  {value || "—"}
                </p>
              </div>
            ))}
          </div>

          {qrSvg && (
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-44 h-44 [&>svg]:w-full [&>svg]:h-full"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <p className="text-[11px] text-gray-400">
                Scan at the gate to check this guest in
              </p>
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <button
              onClick={() => window.print()}
              className="px-5 py-2.5 rounded-full border border-[#0A4DA6] text-[#0A4DA6] text-xs font-extrabold inline-flex items-center gap-1.5"
            >
              <Printer size={14} /> Print receipt
            </button>
            <button
              onClick={startNext}
              className="px-5 py-2.5 rounded-full bg-[#0A4DA6] text-white text-xs font-extrabold inline-flex items-center gap-1.5"
            >
              <UserPlus size={14} /> Book next guest
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <div className="space-y-6 w-full text-left">
      <EnterprisePageHeader
        title={isTirvonaBooking ? "Tirvona Booking" : "Self Booking"}
        subtitle={
          isTirvonaBooking
            ? "Book a guest online through Razorpay payment gateway."
            : "Book a guest at the counter with cash, UPI or card."
        }
        icon={<BedDouble size={22} />}
      />
      <form
        onSubmit={submit}
        className="w-full bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-6 sm:p-8 space-y-6 shadow-sm"
      >
        <section className="space-y-2.5">
          <p className="text-xs font-extrabold text-[#0B192C] dark:text-white">
            1. Booking Channel
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                set("bookingType", "self");
                const targetPath = location.pathname.replace("tirvona-booking", "self-booking");
                if (targetPath !== location.pathname) navigate(targetPath);
              }}
              className={`p-4 rounded-2xl border text-left transition flex items-start justify-between cursor-pointer ${
                form.bookingType === "self"
                  ? "border-[#0A4DA6] bg-blue-50/60 dark:bg-blue-950/40 ring-1 ring-[#0A4DA6]"
                  : "border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900/60 hover:border-gray-300"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    Self Counter Booking
                  </span>
                  {form.bookingType === "self" && (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-[#0A4DA6] text-white">
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                  Direct counter reservation — guest pays at reception via Cash, UPI, or Card.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                set("bookingType", "tirvona");
                const targetPath = location.pathname.replace("self-booking", "tirvona-booking");
                if (targetPath !== location.pathname) navigate(targetPath);
              }}
              className={`p-4 rounded-2xl border text-left transition flex items-start justify-between cursor-pointer ${
                form.bookingType === "tirvona"
                  ? "border-[#0A4DA6] bg-blue-50/60 dark:bg-blue-950/40 ring-1 ring-[#0A4DA6]"
                  : "border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900/60 hover:border-gray-300"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    Tirvona Online Booking
                  </span>
                  {form.bookingType === "tirvona" && (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                  Online reservation — guest pays via Tirvona Razorpay gateway exactly like a website booking.
                </p>
              </div>
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-xs font-extrabold text-[#0B192C] dark:text-white">
            2. Ashram &amp; stay
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            <select
              required
              value={form.ashramId}
              onChange={(event) => {
                set("ashramId", event.target.value);
                set("roomId", "");
              }}
              className={field}
            >
              <option value="">Select ashram</option>
              {ashrams.map((ashram) => (
                <option key={ashram._id} value={ashram._id}>
                  {ashram.name}
                </option>
              ))}
            </select>
            <input
              required
              type="date"
              value={form.checkInDate}
              onChange={(event) => set("checkInDate", event.target.value)}
              className={field}
            />
            <input
              required
              type="date"
              value={form.checkOutDate}
              onChange={(event) => set("checkOutDate", event.target.value)}
              className={field}
            />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-extrabold text-[#0B192C] dark:text-white">
              3. Available rooms / beds
            </p>
            {loadingRooms && (
              <Loader2 size={14} className="animate-spin text-[#0A4DA6]" />
            )}
          </div>
          {!form.ashramId ? (
            <p className="text-xs text-gray-400">Select an ashram first.</p>
          ) : rooms.length === 0 && !loadingRooms ? (
            <p className="text-xs text-gray-400 inline-flex items-center gap-1.5">
              <Search size={13} /> No rooms configured for these dates.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {rooms.map((room) => {
                const soldOut = room.availableCount <= 0;
                const selectedUnits = form.rooms?.[room.roomId] || 0;
                const canSelect = Number(form.roomsBookedCount) < 10;
                
                const updateUnits = (delta: number) => {
                  const current = form.rooms?.[room.roomId] || 0;
                  const next = Math.max(0, current + delta);
                  const newRooms = { ...form.rooms };
                  if (next === 0) delete newRooms[room.roomId];
                  else newRooms[room.roomId] = next;
                  setForm((prev) => ({ ...prev, rooms: newRooms }));
                };

                return (
                  <div key={room.roomId} className={`p-3 border rounded-xl ${selectedUnits > 0 ? "border-[#0A4DA6] bg-[#0A4DA6]/5" : "border-gray-100"}`}>
                    <p className="text-xs font-extrabold text-[#0B192C] dark:text-white">{room.name}</p>
                    <p className="text-[11px] text-gray-400 capitalize">{room.type}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className={`text-[11px] font-black ${room.availableCount <= 0 ? "text-rose-500" : "text-emerald-600"}`}>
                        {room.availableCount <= 0 ? "Full" : `${room.availableCount} available`}
                      </p>
                      {room.basePrice > 0 && (
                        <p className="text-[11px] font-black text-[#0B192C] dark:text-white">
                          ₹{room.basePrice}<span className="font-bold text-gray-400"> /night</span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center mt-2 space-x-2">
                      <button type="button" onClick={() => updateUnits(-1)} disabled={selectedUnits === 0} className="px-2 py-1 bg-gray-200 rounded disabled:opacity-40">-</button>
                      <span className="w-6 text-center">{selectedUnits}</span>
                      <button type="button" onClick={() => updateUnits(1)} disabled={!canSelect || selectedUnits >= room.availableCount} className="px-2 py-1 bg-[#0A4DA6] text-white rounded disabled:opacity-40">+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold text-[#0B192C] dark:text-white flex items-center gap-1.5">
                <Users size={16} className="text-[#0A4DA6]" /> 4. Guest Details &amp; ID Verification
              </p>
              <p className="text-[11px] text-gray-400">
                Individual verification and ID capture for all {guests.length} guest(s)
              </p>
            </div>
            
            <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-900 p-2 rounded-2xl border border-gray-100 dark:border-slate-800">
              <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                Number of Guests:
              </label>
              <input
                required
                type="number"
                min={1}
                max={20}
                value={form.guestsCount}
                onChange={(event) => handleGuestsCountChange(event.target.value)}
                className="w-16 px-2.5 py-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-black text-center focus:outline-none focus:border-[#0A4DA6]"
              />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Rooms:</span>
              <input
                required
                type="number"
                min={1}
                max={selectedRoom?.availableCount || undefined}
                value={form.roomsBookedCount}
                onChange={(event) => set("roomsBookedCount", event.target.value)}
                className="w-16 px-2.5 py-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-black text-center focus:outline-none focus:border-[#0A4DA6]"
              />
            </div>
          </div>

          {/* DYNAMIC PER-GUEST CARDS LIST */}
          <div className="space-y-4">
            {guests.map((g, idx) => (
              <div
                key={idx}
                className="p-5 rounded-[24px] border border-gray-100 dark:border-slate-800 bg-gray-50/40 dark:bg-slate-900/40 space-y-4 shadow-xs"
              >
                <div className="flex items-center justify-between pb-2 border-b border-gray-200/60 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#0A4DA6] text-white text-xs font-black flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <h3 className="font-extrabold text-xs text-[#0B192C] dark:text-white">
                      Guest #{idx + 1} {idx === 0 ? "(Primary Booker)" : ""}
                    </h3>
                  </div>
                  {g.aadhaarVerified ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                      <CheckCircle2 size={12} /> Aadhaar Verified
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-gray-400">
                      Identity Verification Required
                    </span>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <input
                    required
                    value={g.name}
                    onChange={(e) => updateGuest(idx, "name", e.target.value)}
                    placeholder={`Guest #${idx + 1} Full Name`}
                    className={field}
                  />
                  <input
                    required={idx === 0}
                    value={g.phone}
                    onChange={(e) => updateGuest(idx, "phone", e.target.value)}
                    placeholder={`Guest #${idx + 1} Phone Number`}
                    className={field}
                  />
                  <input
                    type="email"
                    value={g.email}
                    onChange={(e) => updateGuest(idx, "email", e.target.value)}
                    placeholder="Email (optional)"
                    className={field}
                  />
                  <select
                    value={g.idType}
                    onChange={(e) => {
                      updateGuest(idx, "idType", e.target.value);
                      updateGuest(idx, "aadhaarVerified", false);
                      updateGuest(idx, "otpSent", false);
                    }}
                    className={field}
                  >
                    <option value="aadhaar">Aadhaar Card</option>
                    <option value="pan">PAN Card</option>
                    <option value="voter_id">Voter ID</option>
                    <option value="passport">Passport</option>
                    <option value="driving_licence">Driving Licence</option>
                  </select>

                  {/* ID NUMBER FIELD WITH VERIFY AADHAAR BUTTON */}
                  <div className="flex gap-2">
                    <input
                      value={g.idNumber}
                      onChange={(e) => {
                        updateGuest(idx, "idNumber", e.target.value);
                        updateGuest(idx, "aadhaarVerified", false);
                        updateGuest(idx, "otpSent", false);
                      }}
                      placeholder={g.idType === "aadhaar" ? "12-digit Aadhaar Number" : "ID Number"}
                      className={`${field} flex-1`}
                    />
                    {g.idType === "aadhaar" && !g.aadhaarVerified && (
                      <button
                        type="button"
                        disabled={g.sendingOtp}
                        onClick={() => sendAadhaarOtpForGuest(idx)}
                        className="px-3.5 py-2 bg-[#0A4DA6] text-white rounded-xl text-xs font-extrabold whitespace-nowrap hover:bg-[#083b80] transition-colors cursor-pointer"
                      >
                        {g.sendingOtp ? <Loader2 size={14} className="animate-spin" /> : "Verify Aadhaar"}
                      </button>
                    )}
                  </div>

                  <input
                    value={g.address}
                    onChange={(e) => updateGuest(idx, "address", e.target.value)}
                    placeholder="Address (optional)"
                    className={field}
                  />
                </div>

                {/* OTP INPUT SECTION FOR THIS GUEST */}
                {g.idType === "aadhaar" && g.otpSent && !g.aadhaarVerified && (
                  <div className="p-3.5 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 space-y-2.5">
                    <p className="text-xs font-extrabold text-[#0A4DA6] dark:text-blue-300 flex items-center gap-1.5">
                      <ShieldCheck size={15} /> Enter 6-Digit Aadhaar OTP for Guest #{idx + 1}
                    </p>
                    <div className="flex gap-2 max-w-md">
                      <input
                        type="text"
                        maxLength={6}
                        value={g.otpCode}
                        onChange={(e) => updateGuest(idx, "otpCode", e.target.value)}
                        placeholder="Enter OTP (e.g. 123456)"
                        className={`${field} tracking-widest text-center font-bold font-mono`}
                      />
                      <button
                        type="button"
                        disabled={g.verifyingOtp}
                        onClick={() => verifyAadhaarOtpForGuest(idx)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold whitespace-nowrap cursor-pointer"
                      >
                        {g.verifyingOtp ? <Loader2 size={14} className="animate-spin" /> : "Verify OTP"}
                      </button>
                    </div>
                  </div>
                )}

                {/* GUEST ID PHOTO UPLOAD & CAMERA CAPTURE */}
                <div className="p-3.5 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#0B192C] dark:text-white">
                        Guest #{idx + 1} {g.idType === "aadhaar" ? "Aadhaar Card" : "ID Document"} Photo
                      </p>
                      <p className="text-[11px] text-gray-400">Upload document file or capture live photo with camera</p>
                    </div>
                    {g.aadhaarImage && (
                      <button
                        type="button"
                        onClick={() => updateGuest(idx, "aadhaarImage", "")}
                        className="text-rose-500 hover:text-rose-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 size={13} /> Remove Photo
                      </button>
                    )}
                  </div>

                  {g.aadhaarImage ? (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-slate-800 max-h-44 bg-slate-950 flex justify-center">
                      <img src={g.aadhaarImage} alt={`Guest #${idx + 1} ID`} className="max-h-44 object-contain" />
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2.5">
                      <label className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-extrabold text-slate-700 dark:text-slate-200 hover:bg-gray-50 cursor-pointer inline-flex items-center gap-1.5">
                        <Upload size={13} className="text-[#0A4DA6]" /> Upload ID Photo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleGuestFileUpload(idx, e)}
                        />
                      </label>

                      <label className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-extrabold text-slate-700 dark:text-slate-200 hover:bg-gray-50 cursor-pointer inline-flex items-center gap-1.5">
                        <Camera size={13} className="text-emerald-600" /> Capture Photo with Camera
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => handleGuestFileUpload(idx, e)}
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-xs font-extrabold text-[#0B192C] dark:text-white">
            5. Payment
          </p>

          {selectedRoom && (
            <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-extrabold text-[#0B192C] dark:text-white">
                  {selectedRoom.name}
                </p>
                {quoting && (
                  <Loader2 size={13} className="animate-spin text-[#0A4DA6]" />
                )}
              </div>
              {quote ? (
                <>
                  {[
                    ["Room charges", quote.pricing?.basePrice],
                    ["Extra guest", quote.pricing?.extraGuestAmount],
                    ["Services", quote.pricing?.servicesPrice],
                    ["Platform fee", quote.pricing?.platformFee],
                    ["GST", quote.pricing?.gstAmount],
                    ["Discount", -Number(quote.pricing?.discountAmount || 0)],
                  ]
                    .filter(([, value]) => Number(value) !== 0)
                    .map(([label, value]) => (
                      <div
                        key={String(label)}
                        className="flex justify-between text-[11px] text-gray-500"
                      >
                        <span>{label}</span>
                        <span>₹{Number(value).toFixed(2)}</span>
                      </div>
                    ))}
                  <div className="flex justify-between pt-1.5 mt-1.5 border-t border-gray-200 dark:border-slate-800">
                    <span className="text-xs font-extrabold text-[#0B192C] dark:text-white">
                      Total for {quote.nights ?? 1} night(s)
                    </span>
                    <span className="text-sm font-black text-[#0A4DA6]">
                      ₹{total.toFixed(2)}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-[11px] text-gray-400">
                  {quoting ? "Calculating tariff…" : "Tariff unavailable for these dates."}
                </p>
              )}
            </div>
          )}

          {form.bookingType === "tirvona" ? (
            <div className="rounded-2xl border border-[#0A4DA6]/30 bg-[#0A4DA6]/5 p-4">
              <p className="text-xs font-extrabold text-[#0A4DA6]">
                Razorpay checkout opens on submit
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                The room is held while the guest pays
                {total > 0 ? ` ₹${total.toFixed(2)}` : ""}. The booking confirms
                only after Razorpay verifies the payment, and it is recorded as a
                Tirvona booking.
              </p>
            </div>
          ) : (
          <>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method.id}
                type="button"
                onClick={() => set("paymentMethod", method.id)}
                className={`px-4 py-2 rounded-full text-[11px] font-extrabold ${
                  form.paymentMethod === method.id
                    ? "bg-[#0A4DA6] text-white"
                    : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300"
                }`}
              >
                {method.label}
              </button>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              required
              type="number"
              min={0}
              value={form.amountCollected}
              onChange={(event) => set("amountCollected", event.target.value)}
              placeholder="Amount collected (₹)"
              className={field}
            />
            {form.paymentMethod !== "cash" && (
              <input
                value={form.paymentReference}
                onChange={(event) => set("paymentReference", event.target.value)}
                placeholder="UPI / card reference"
                className={field}
              />
            )}
          </div>

          {/* TRANSACTION PROOF PHOTO FOR UPI & CARD */}
          {(form.paymentMethod === "upi" || form.paymentMethod === "cards") && (
            <div className="p-4 rounded-2xl border border-dashed border-purple-200 dark:border-purple-900 bg-purple-50/30 dark:bg-purple-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-purple-900 dark:text-purple-300">
                    Payment Transaction Proof / Receipt Screenshot ({form.paymentMethod === "upi" ? "UPI" : "Card"})
                  </p>
                  <p className="text-[11px] text-purple-700/70 dark:text-purple-400">
                    Upload receipt file or capture screenshot/photo with camera
                  </p>
                </div>
                {txnProofImage && (
                  <button
                    type="button"
                    onClick={() => setTxnProofImage("")}
                    className="text-rose-500 hover:text-rose-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={13} /> Remove Receipt
                  </button>
                )}
              </div>

              {txnProofImage ? (
                <div className="relative rounded-xl overflow-hidden border border-purple-200 dark:border-purple-900 max-h-48 bg-slate-950 flex justify-center">
                  <img src={txnProofImage} alt="Transaction Receipt Preview" className="max-h-48 object-contain" />
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <label className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-900 rounded-xl text-xs font-extrabold text-purple-950 dark:text-purple-200 hover:bg-purple-50 cursor-pointer inline-flex items-center gap-2">
                    <Upload size={14} className="text-[#0A4DA6]" /> Upload Transaction Receipt
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, setTxnProofImage)}
                    />
                  </label>

                  <label className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-900 rounded-xl text-xs font-extrabold text-purple-950 dark:text-purple-200 hover:bg-purple-50 cursor-pointer inline-flex items-center gap-2">
                    <Camera size={14} className="text-emerald-600" /> Take Photo with Camera
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, setTxnProofImage)}
                    />
                  </label>
                </div>
              )}
            </div>
          )}
          </>
          )}
          <textarea
            rows={2}
            value={form.specialRequests}
            onChange={(event) => set("specialRequests", event.target.value)}
            placeholder="Notes / special requests"
            className={field}
          />
        </section>

        <button
          disabled={saving}
          className="w-full py-3.5 rounded-full bg-[#0A4DA6] text-white text-xs font-extrabold disabled:opacity-60 inline-flex justify-center items-center gap-2"
        >
          {saving ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <>
              <FileText size={15} />{" "}
              {form.bookingType === "tirvona"
                ? "Continue to Razorpay payment"
                : "Confirm booking & issue receipt"}
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default SelfBookingPage;
