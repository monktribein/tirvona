import React, { useCallback, useEffect, useState } from "react";
import {
  BedDouble,
  CheckCircle2,
  Loader2,
  Printer,
  FileText,
  Search,
  UserPlus,
} from "lucide-react";
import { bookingService, selfBookingService } from "../../services";
import { openRazorpayCheckout } from "../../lib/razorpay";
import { getErrorMessage } from "../../lib/api";
import { useNotifications } from "../../contexts/NotificationContext";

const BOOKING_TYPES = [
  {
    id: "self",
    label: "Self Booking",
    hint: "Guest pays at the counter — cash, UPI or card.",
  },
  {
    id: "tirvona",
    label: "Tirvona Booking",
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
  const value = response?.data?.data ?? response?.data ?? [];
  return Array.isArray(value) ? value : [];
};

export const WalkInBookingPage: React.FC = () => {
  const { addNotification } = useNotifications();
  const [ashrams, setAshrams] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<any | null>(null);
  const [qrSvg, setQrSvg] = useState("");
  const [quote, setQuote] = useState<any | null>(null);
  const [quoting, setQuoting] = useState(false);

  const [form, setForm] = useState({
    bookingType: "self",
    ashramId: "",
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
          roomId: form.roomId,
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
        isSelf ? "Walk-in Booking Created" : "Tirvona Booking Confirmed",
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
        getErrorMessage(error, "Could not record this walk-in booking."),
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
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-6 space-y-5 text-center">
          <CheckCircle2 size={44} className="mx-auto text-emerald-500" />
          <div>
            <h2 className="font-black text-xl text-[#0B192C] dark:text-white">
              {confirmation.bookingSource === "tirvona"
                ? "Tirvona booking confirmed"
                : "Walk-in booking confirmed"}
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
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="font-black text-xl text-[#0B192C] dark:text-white flex items-center gap-2">
          <BedDouble size={22} className="text-[#0A4DA6]" /> Walk-in / Offline Booking
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Record a guest who booked at the counter. These stay separate from Tirvona
          online bookings in every report.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 sm:p-6 space-y-5"
      >
        <section className="space-y-3">
          <p className="text-xs font-extrabold text-[#0B192C] dark:text-white">
            1. Booking type
          </p>
          <select
            required
            value={form.bookingType}
            onChange={(event) => set("bookingType", event.target.value)}
            className={field}
          >
            {BOOKING_TYPES.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-gray-400">
            {BOOKING_TYPES.find((type) => type.id === form.bookingType)?.hint}
          </p>
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
                const active = form.roomId === room.roomId;
                return (
                  <button
                    key={room.roomId}
                    type="button"
                    disabled={soldOut}
                    onClick={() => set("roomId", room.roomId)}
                    className={`rounded-2xl border p-3.5 text-left transition-colors ${
                      active
                        ? "border-[#0A4DA6] bg-[#0A4DA6]/5"
                        : "border-gray-100 dark:border-slate-800"
                    } ${soldOut ? "opacity-45 cursor-not-allowed" : "hover:border-[#0A4DA6]"}`}
                  >
                    <p className="text-xs font-extrabold text-[#0B192C] dark:text-white">
                      {room.name}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5 capitalize">
                      {room.type}
                    </p>
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <p
                        className={`text-[11px] font-black ${soldOut ? "text-rose-500" : "text-emerald-600"}`}
                      >
                        {soldOut ? "Full" : `${room.availableCount} available`}
                      </p>
                      {room.basePrice > 0 && (
                        <p className="text-[11px] font-black text-[#0B192C] dark:text-white">
                          ₹{room.basePrice}
                          <span className="font-bold text-gray-400"> /night</span>
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <p className="text-xs font-extrabold text-[#0B192C] dark:text-white">
            4. Guest details
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              required
              value={form.guestName}
              onChange={(event) => set("guestName", event.target.value)}
              placeholder="Guest full name"
              className={field}
            />
            <input
              required
              value={form.guestPhone}
              onChange={(event) => set("guestPhone", event.target.value)}
              placeholder="Phone number"
              className={field}
            />
            <input
              type="email"
              value={form.guestEmail}
              onChange={(event) => set("guestEmail", event.target.value)}
              placeholder="Email (optional)"
              className={field}
            />
            <select
              value={form.guestIdType}
              onChange={(event) => set("guestIdType", event.target.value)}
              className={field}
            >
              <option value="aadhaar">Aadhaar</option>
              <option value="pan">PAN</option>
              <option value="voter_id">Voter ID</option>
              <option value="passport">Passport</option>
              <option value="driving_licence">Driving Licence</option>
            </select>
            <input
              value={form.guestIdNumber}
              onChange={(event) => set("guestIdNumber", event.target.value)}
              placeholder="ID number"
              className={field}
            />
            <input
              value={form.guestAddress}
              onChange={(event) => set("guestAddress", event.target.value)}
              placeholder="Address (optional)"
              className={field}
            />
            <input
              required
              type="number"
              min={1}
              value={form.guestsCount}
              onChange={(event) => set("guestsCount", event.target.value)}
              placeholder="Number of guests"
              className={field}
            />
            <input
              required
              type="number"
              min={1}
              max={selectedRoom?.availableCount || undefined}
              value={form.roomsBookedCount}
              onChange={(event) => set("roomsBookedCount", event.target.value)}
              placeholder="Rooms / beds"
              className={field}
            />
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

export default WalkInBookingPage;
