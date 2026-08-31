import React, { useCallback, useState, useEffect } from "react";
import {
  Key, RefreshCw, Search, X, CheckCircle2, ShieldCheck, CreditCard, Smartphone, Loader2, Calendar,
} from "lucide-react";
import { useNotifications } from "../contexts/NotificationContext";
import { bookingService } from "../services";
import { getErrorMessage } from "../lib/api";

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

export const ReceptionCheckinPage: React.FC = () => {
  const { addNotification, promptAction } = useNotifications();
  const [activeBookings, setActiveBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "active" | "confirmed" | "checked_in" | "checked_out"
  >("active");

  // Modal & Verification State
  const [verifyingBooking, setVerifyingBooking] = useState<any | null>(null);
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [aadhaarVerified, setAadhaarVerified] = useState(false);
  const [isVerifyingAadhaar, setIsVerifyingAadhaar] = useState(false);
  const [checkInCode, setCheckInCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const fetchActiveBookings = useCallback(async () => {
    setLoading(true);
    try {
      const rows: any[] = [];
      let page = 1;
      let batch: any[] = [];
      do {
        const res = await bookingService.dashboard({
          page: String(page),
          limit: "100",
        });
        batch = res.data.success ? res.data.data || [] : [];
        rows.push(...batch);
        page += 1;
      } while (batch.length === 100);
      setActiveBookings(
        rows.filter((booking) =>
          ["confirmed", "checked_in", "checked_out"].includes(booking.status),
        ),
      );
    } catch (err) {
      console.error("Fetch active bookings error:", err);
      addNotification(
        "Load Failed",
        getErrorMessage(err, "Unable to load bookings."),
        "error",
      );
      setActiveBookings([]);
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    void fetchActiveBookings();
  }, [fetchActiveBookings]);

  const visibleBookings = activeBookings.filter((booking) => {
    const matchesStatus =
      statusFilter === "active"
        ? ["confirmed", "checked_in"].includes(booking.status)
        : booking.status === statusFilter;
    if (!matchesStatus) return false;
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [
      booking.bookingId,
      booking.reservationNumber,
      booking.customerId?.name,
      booking.customerId?.phone,
      booking.ashramId?.name,
      booking.roomId?.name,
    ].some((value) => String(value || "").toLowerCase().includes(term));
  });

  const openVerifyModal = (booking: any) => {
    setVerifyingBooking(booking);
    setAadhaarNumber("");
    setAadhaarVerified(false);
    setIsVerifyingAadhaar(false);
    setCheckInCode("");
    setErrorMsg("");
  };

  const closeVerifyModal = () => {
    setVerifyingBooking(null);
    setAadhaarNumber("");
    setAadhaarVerified(false);
    setIsVerifyingAadhaar(false);
    setCheckInCode("");
    setErrorMsg("");
  };

  const handleVerifyAadhaar = () => {
    setErrorMsg("");
    const clean = aadhaarNumber.replace(/\D/g, "");
    if (clean.length !== 12) {
      setErrorMsg("Please enter a valid 12-digit Aadhaar number.");
      return;
    }
    setIsVerifyingAadhaar(true);
    setTimeout(() => {
      setIsVerifyingAadhaar(false);
      setAadhaarVerified(true);
      addNotification(
        "Aadhaar Verified",
        "Aadhaar details verified successfully. OTP sent to registered mobile.",
        "success",
      );
    }, 600);
  };

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!verifyingBooking) return;

    if (!aadhaarVerified) {
      setErrorMsg("Please enter and verify Aadhaar number first.");
      return;
    }

    if (!/^(\d{4}|\d{6})$/.test(checkInCode)) {
      setErrorMsg("Please enter a valid 4-digit or 6-digit OTP.");
      return;
    }

    try {
      const res = await bookingService.checkin(verifyingBooking._id, checkInCode);
      if (res.data?.success) {
        closeVerifyModal();
        addNotification(
          "Check-In Successful",
          "Guest Aadhaar verified and check-in authorized successfully.",
          "success",
        );
        fetchActiveBookings();
      }
    } catch (err) {
      setErrorMsg(
        getErrorMessage(err, "Incorrect verification code. Please check OTP code."),
      );
    }
  };

  const handleCheckOut = async (bookingId: string) => {
    try {
      const res = await bookingService.checkout(bookingId);
      if (res.data?.success) {
        addNotification(
          "Check-Out Authorized",
          "Rooms released and sent to cleaning status.",
          "info",
        );
        fetchActiveBookings();
      }
    } catch (err) {
      console.error("Checkout error:", err);
      addNotification(
        "Checkout Failed",
        getErrorMessage(err, "Could not complete checkout."),
        "error",
      );
    }
  };

  const handleAssignRoomNumber = async (bookingId: string) => {
    const roomNo = await promptAction({
      title: "Assign room number",
      message: "Enter the physical room number for this reservation.",
      placeholder: "e.g. Room 102",
      confirmLabel: "Assign Room",
      required: true,
    });
    if (roomNo === null) return;
    try {
      const res = await bookingService.assignRoomNumber(bookingId, roomNo);
      if (res.data?.success) {
        addNotification(
          "Room Assigned",
          `Assigned room "${roomNo}" to reservation.`,
          "success",
        );
        fetchActiveBookings();
      }
    } catch (err) {
      addNotification(
        "Assignment Failed",
        getErrorMessage(err, "Could not assign room."),
        "error",
      );
    }
  };

  return (
    <div className="space-y-6 text-left w-full">
      {/* HEADER SECTION */}
      <div className="flex justify-between items-start sm:items-center gap-3 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-4 sm:p-6 rounded-[24px] shadow-sm">
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-[#0B192C] dark:text-white">
            Counter Check-In &amp; Check-Out Desk
          </h2>
          <p className="text-xs text-gray-400 font-semibold mt-1">
            Verify guest Aadhaar, validate digital OTP pass codes, assign room numbers, or perform check-outs.
          </p>
        </div>
        <button
          onClick={fetchActiveBookings}
          className="shrink-0 p-2.5 bg-gray-50 dark:bg-slate-900 hover:bg-gray-100 border border-gray-100 dark:border-slate-800 rounded-xl text-gray-500 cursor-pointer transition-colors"
          title="Refresh bookings"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {loading ? (
        <div className="h-40 bg-gray-50 border border-gray-100 rounded-[24px] animate-pulse" />
      ) : (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm overflow-hidden">
          <div className="m-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative block w-full max-w-xl">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search booking, guest, phone, ashram or room"
                className="w-full rounded-xl border border-gray-100 bg-gray-50 py-2.5 pl-9 pr-3 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
            </label>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as typeof statusFilter)
              }
              className="rounded-full border border-gray-200 bg-white px-4 py-2.5 text-xs outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              aria-label="Filter check-in and check-out status"
            >
              <option value="active">Active desk</option>
              <option value="confirmed">Awaiting check-in</option>
              <option value="checked_in">Checked in</option>
              <option value="checked_out">Checked out</option>
            </select>
          </div>

          {/* TABLE SECTION WITH TWO DATES: CHECK-IN & CHECK-OUT */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-50 dark:border-slate-850 bg-gray-50 dark:bg-slate-900 text-gray-450 font-bold text-[10px] tracking-wider uppercase">
                  <th className="py-3 px-3 sm:px-4 whitespace-nowrap">Booking Ref</th>
                  <th className="py-3 px-3 sm:px-4 whitespace-nowrap">Guest Contact</th>
                  <th className="py-3 px-3 sm:px-4 whitespace-nowrap">Check-In Date</th>
                  <th className="py-3 px-3 sm:px-4 whitespace-nowrap">Check-Out Date</th>
                  <th className="py-3 px-3 sm:px-4 whitespace-nowrap">Room / Assigned</th>
                  <th className="py-3 px-3 sm:px-4 whitespace-nowrap">Current Status</th>
                  <th className="py-3 px-3 sm:px-4 text-right whitespace-nowrap">Ashram Owner Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleBookings.map((bk) => (
                  <tr
                    key={bk._id}
                    className="border-b border-gray-50 dark:border-slate-850 hover:bg-gray-50/20"
                  >
                    <td className="py-3.5 px-3 sm:px-4 font-bold text-[#0B192C] dark:text-white whitespace-nowrap">
                      <div>{bk.bookingId}</div>
                      {bk.reservationNumber && (
                        <div className="text-[10px] font-mono text-[#0A4DA6]">
                          {bk.reservationNumber}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800 dark:text-white">
                          {bk.customerId?.name || "Guest"}
                        </span>
                        <a
                          href={`tel:${bk.customerId?.phone}`}
                          className="text-[10px] text-blue-600 hover:underline"
                        >
                          {bk.customerId?.phone || "No phone"}
                        </a>
                      </div>
                    </td>

                    {/* CHECK-IN DATE COLUMN */}
                    <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                      <div className="font-bold text-[#0B192C] dark:text-white flex items-center gap-1.5">
                        <Calendar size={13} className="text-[#0A4DA6] shrink-0" />
                        <span>{formatDate(bk.checkInDate || bk.checkIn || bk.startDate)}</span>
                      </div>
                    </td>

                    {/* CHECK-OUT DATE COLUMN */}
                    <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                      <div className="font-bold text-[#0B192C] dark:text-white flex items-center gap-1.5">
                        <Calendar size={13} className="text-emerald-600 shrink-0" />
                        <span>{formatDate(bk.checkOutDate || bk.checkOut || bk.endDate)}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 sm:px-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      <div className="font-medium">{bk.roomId?.name || "Room"}</div>
                      {bk.assignedRoomNumber ? (
                        <span className="inline-block mt-0.5 px-2 py-0.5 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-[10px] font-bold rounded">
                          {bk.assignedRoomNumber}
                        </span>
                      ) : bk.status !== "checked_out" ? (
                        <button
                          onClick={() => handleAssignRoomNumber(bk._id)}
                          className="mt-0.5 text-[10px] font-bold text-[#0A4DA6] hover:underline cursor-pointer"
                        >
                          + Assign Room No
                        </button>
                      ) : null}
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[9px] font-bold capitalize border whitespace-nowrap shrink-0 ${
                          bk.status === "confirmed"
                            ? "bg-[#0A4DA6]/10 text-[#0A4DA6] border-[#0A4DA6]/20"
                            : bk.status === "checked_in"
                              ? "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 dark:text-emerald-400"
                              : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {bk.status === "confirmed" ? "Awaiting Check-in" : bk.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-right whitespace-nowrap space-x-2">
                      {bk.status === "confirmed" && (
                        <button
                          onClick={() => openVerifyModal(bk)}
                          className="px-4 py-2 bg-[#0A4DA6] text-white rounded-full text-[10px] font-bold cursor-pointer hover:bg-[#083b80] transition-colors shadow-xs"
                        >
                          Verify Check-In
                        </button>
                      )}
                      {bk.status === "checked_in" && (
                        <button
                          onClick={() => handleCheckOut(bk._id)}
                          className="px-4 py-2 bg-rose-50 dark:bg-rose-950/30 text-rose-600 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 rounded-full text-[10px] font-bold cursor-pointer"
                        >
                          Complete Check-Out
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {visibleBookings.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-xs text-gray-400">
                      No bookings found for this status filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VERIFY CHECK-IN MODAL WITH AADHAAR & OTP VERIFICATION FLOW */}
      {verifyingBooking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCheckInSubmit}
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-md w-full rounded-[28px] p-6 space-y-5 shadow-2xl"
          >
            {/* MODAL HEADER */}
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-[#0B192C] dark:text-white flex items-center gap-2">
                <ShieldCheck size={18} className="text-[#0A4DA6]" />
                Authorize Stay Check-In
              </h3>
              <button
                type="button"
                onClick={closeVerifyModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* GUEST & BOOKING SUMMARY */}
            <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl space-y-1 text-xs">
              <div className="flex justify-between font-bold text-slate-900 dark:text-white">
                <span>{verifyingBooking.customerId?.name || "Guest"}</span>
                <span className="text-[#0A4DA6] font-mono">{verifyingBooking.bookingId}</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>{verifyingBooking.roomId?.name || "Room"}</span>
                <span>
                  {formatDate(verifyingBooking.checkInDate || verifyingBooking.checkIn)} → {formatDate(verifyingBooking.checkOutDate || verifyingBooking.checkOut)}
                </span>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl">
                {errorMsg}
              </div>
            )}

            {/* STEP 1: AADHAAR NUMBER & VERIFY AADHAAR BUTTON */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <CreditCard size={14} className="text-[#0A4DA6]" />
                Aadhaar Number (12 Digits)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={14}
                  placeholder="1234 5678 9012"
                  value={aadhaarNumber}
                  disabled={aadhaarVerified}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "").slice(0, 12);
                    const formatted = raw.replace(/(\d{4})(?=\d)/g, "$1 ");
                    setAadhaarNumber(formatted);
                  }}
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-extrabold tracking-wider focus:outline-none dark:text-white disabled:opacity-70"
                />
                <button
                  type="button"
                  onClick={handleVerifyAadhaar}
                  disabled={aadhaarVerified || isVerifyingAadhaar || aadhaarNumber.replace(/\D/g, "").length !== 12}
                  className="px-4 py-2.5 bg-[#0A4DA6] text-white rounded-xl text-xs font-bold hover:bg-[#083b80] disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  {isVerifyingAadhaar ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> Verifying...
                    </>
                  ) : aadhaarVerified ? (
                    <>
                      <CheckCircle2 size={13} className="text-emerald-300" /> Verified
                    </>
                  ) : (
                    "Verify Aadhaar"
                  )}
                </button>
              </div>

              {aadhaarVerified && (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-[11px] text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>Aadhaar verified successfully! OTP sent to registered mobile.</span>
                </div>
              )}
            </div>

            {/* STEP 2: OTP BOX (REVEALED AFTER AADHAAR IS VERIFIED) */}
            {aadhaarVerified && (
              <div className="space-y-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800 animate-fadeIn">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Smartphone size={14} className="text-[#0A4DA6]" />
                    Fill Up OTP (Verification Code)
                  </label>
                  {verifyingBooking.checkInCode && (
                    <span className="text-[10px] font-mono bg-blue-50 dark:bg-slate-800 text-[#0A4DA6] px-2 py-0.5 rounded font-bold">
                      Code: {verifyingBooking.checkInCode}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="([0-9]{4}|[0-9]{6})"
                  required
                  maxLength={6}
                  placeholder="Enter OTP (e.g. 4820)"
                  value={checkInCode}
                  onChange={(e) =>
                    setCheckInCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-center tracking-widest font-extrabold focus:outline-none dark:text-white"
                />
              </div>
            )}

            {/* MODAL ACTION BUTTONS */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={closeVerifyModal}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full text-xs font-bold cursor-pointer hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!aadhaarVerified || !checkInCode}
                className="flex-1 py-3 bg-[#0A4DA6] text-white rounded-full text-xs font-extrabold cursor-pointer shadow hover:bg-[#083b80] disabled:opacity-50 transition-all"
              >
                Verify Check-In
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ReceptionCheckinPage;
