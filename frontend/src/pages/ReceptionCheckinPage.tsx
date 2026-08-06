import React, { useState, useEffect } from "react";
import { Key, RefreshCw, X } from "lucide-react";
import { useNotifications } from "../contexts/NotificationContext";
import { bookingService } from "../services";
import { getErrorMessage } from "../lib/api";

export const ReceptionCheckinPage: React.FC = () => {
  const { addNotification } = useNotifications();
  const [activeBookings, setActiveBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Counter Check-in verification code
  const [checkInCode, setCheckInCode] = useState("");
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchActiveBookings();
  }, []);

  const fetchActiveBookings = async () => {
    setLoading(true);
    try {
      const res = await bookingService.dashboard();
      if (res.data.success) {
        setActiveBookings(res.data.data);
      }
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
  };

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!verifyingId || !checkInCode) return;

    try {
      const res = await bookingService.checkin(verifyingId, checkInCode);
      if (res.data.success) {
        setVerifyingId(null);
        setCheckInCode("");
        addNotification(
          "Check-In Successful",
          "Guest check-in has been authorized and status updated.",
          "success",
        );
        fetchActiveBookings();
      }
    } catch (err) {
      setErrorMsg(
        getErrorMessage(err, "Incorrect verification code. Please check code."),
      );
    }
  };

  const handleCheckOut = async (bookingId: string) => {
    try {
      const res = await bookingService.checkout(bookingId);
      if (res.data.success) {
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
    const roomNo = window.prompt(
      "Enter Room Number to assign (e.g. Room 102):",
    );
    if (roomNo === null) return;
    try {
      const res = await bookingService.assignRoomNumber(bookingId, roomNo);
      if (res.data.success) {
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
    <div className="space-y-6 text-left">
      {/* min-w-0 on the text block lets it actually shrink — a flex child
          defaults to min-width:auto and refuses to go below its content width,
          which is what pushes the refresh button off a narrow screen. */}
      <div className="flex justify-between items-start sm:items-center gap-3 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-4 sm:p-6 rounded-[24px] shadow-sm">
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-[#0B192C] dark:text-white">
            Counter Check-In &amp; Check-Out Desk
          </h2>
          <p className="text-xs text-gray-400 font-semibold mt-1">
            Authorize active bookings via digital safety codes, assign room
            numbers, or perform check-outs.
          </p>
        </div>
        <button
          onClick={fetchActiveBookings}
          className="shrink-0 p-2.5 bg-gray-50 dark:bg-slate-900 hover:bg-gray-100 border border-gray-100 dark:border-slate-800 rounded-xl text-gray-500 cursor-pointer transition-colors"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {loading ? (
        <div className="h-40 bg-gray-50 border border-gray-100 rounded-[24px] animate-pulse" />
      ) : (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-50 dark:border-slate-850 bg-gray-50 dark:bg-slate-900 text-gray-450 font-bold text-[10px] tracking-wider">
                  <th className="py-4 px-6">Booking Ref</th>
                  <th className="py-4 px-6">Guest Contact</th>
                  <th className="py-4 px-6">Room / Assigned</th>
                  <th className="py-4 px-6">Current Status</th>
                  <th className="py-4 px-6 text-right">Stay Admin Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeBookings.map((bk) => (
                  <tr
                    key={bk._id}
                    className="border-b border-gray-50 dark:border-slate-850 hover:bg-gray-50/20"
                  >
                    <td className="py-4.5 px-6 font-bold text-[#0B192C] dark:text-white">
                      <div>{bk.bookingId}</div>
                      {bk.reservationNumber && (
                        <div className="text-[10px] font-mono text-[#0A4DA6]">
                          {bk.reservationNumber}
                        </div>
                      )}
                    </td>
                    <td className="py-4.5 px-6">
                      <div className="flex flex-col">
                        <span className="font-semibold text-secondary dark:text-white">
                          {bk.customerId?.name}
                        </span>
                        <a
                          href={`tel:${bk.customerId?.phone}`}
                          className="text-[10px] text-blue-600 hover:underline"
                        >
                          {bk.customerId?.phone || "No phone"}
                        </a>
                      </div>
                    </td>
                    <td className="py-4.5 px-6 text-gray-500">
                      <div className="font-medium">{bk.roomId?.name}</div>
                      {bk.assignedRoomNumber ? (
                        <span className="inline-block mt-0.5 px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded">
                          {bk.assignedRoomNumber}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAssignRoomNumber(bk._id)}
                          className="mt-0.5 text-[10px] font-bold text-[#0A4DA6] hover:underline cursor-pointer"
                        >
                          + Assign Room No
                        </button>
                      )}
                    </td>
                    <td className="py-4.5 px-6">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold capitalize border ${
                          bk.status === "confirmed"
                            ? "bg-[#0A4DA6]/10 text-[#0A4DA6] border-[#0A4DA6]/20"
                            : bk.status === "checked_in"
                              ? "bg-success/15 text-success border border-success/30"
                              : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {bk.status}
                      </span>
                    </td>
                    <td className="py-4.5 px-6 text-right space-x-2">
                      {bk.status === "confirmed" && (
                        <button
                          onClick={() => {
                            setVerifyingId(bk._id);
                            setErrorMsg("");
                          }}
                          className="px-4 py-2 bg-[#0A4DA6] text-white rounded-full text-[10px] font-bold cursor-pointer hover:bg-[#083b80]"
                        >
                          Verify Check-In
                        </button>
                      )}
                      {bk.status === "checked_in" && (
                        <button
                          onClick={() => handleCheckOut(bk._id)}
                          className="px-4 py-2 bg-danger/10 text-danger border border-danger/20 hover:bg-danger/15 rounded-full text-[10px] font-bold cursor-pointer"
                        >
                          Complete Check-Out
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Check-In Verification Code Modal */}
      {verifyingId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCheckInSubmit}
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-md w-full rounded-[28px] p-6 space-y-4"
          >
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-[#0B192C] dark:text-white flex items-center gap-1.5">
                <Key size={16} className="text-[#0A4DA6]" /> Authorize Stay
                Check-In
              </h3>
              <button
                type="button"
                onClick={() => setVerifyingId(null)}
                className="text-gray-400 hover:text-gray-655"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-[10px] text-gray-400">
              Ask the guest customer to provide the 6-digit confirmation
              Check-in code sent to their registered phone number.
            </p>

            {errorMsg && (
              <div className="p-3 bg-danger/10 text-danger border border-danger/20 text-xs rounded-xl">
                {errorMsg}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 tracking-wider block text-center">
                Check-In Pass Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="482012"
                value={checkInCode}
                onChange={(e) => setCheckInCode(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-sm text-center tracking-widest font-extrabold focus:outline-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setVerifyingId(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-full text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-[#0A4DA6] text-white rounded-full text-xs font-bold cursor-pointer shadow"
              >
                Authorize Check-In
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
export default ReceptionCheckinPage;
