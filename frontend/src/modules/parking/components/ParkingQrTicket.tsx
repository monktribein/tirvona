import React, { useRef } from "react";
import { Download, CircleParking, ShieldCheck, Clock, Car } from "lucide-react";
import type { ParkingBooking, ParkingPass } from "../types/parking.types";
import { formatDateTime, vehicleLabel } from "../utils/parkingFormat";

interface ParkingQrTicketProps {
  booking: ParkingBooking;
  pass: ParkingPass;
  locationName?: string;
}

/**
 * The visitor's parking pass.
 *
 * Styled as a physical ticket stub — the notched divider is what makes it read
 * as a pass rather than a card, which matters when a guard is looking at it on
 * a phone screen at a gate.
 */
export const ParkingQrTicket: React.FC<ParkingQrTicketProps> = ({
  booking,
  pass,
  locationName,
}) => {
  const linkRef = useRef<HTMLAnchorElement>(null);

  // The QR arrives as a data URL, so the download needs no network round-trip
  // and works offline once the page is loaded — which is the point, since gates
  // often have poor signal.
  const handleDownload = () => {
    if (!pass.image) return;
    const a = linkRef.current;
    if (!a) return;
    a.href = pass.image;
    a.download = `tirvona-parking-${booking.bookingReference}.png`;
    a.click();
  };

  return (
    <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] overflow-hidden shadow-lg max-w-sm mx-auto w-full">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0B192C] via-[#0A4DA6] to-[#0B192C] text-white px-5 py-4 text-center relative overflow-hidden">
        <div className="absolute right-0 top-0 w-40 h-40 bg-[#E58C28]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <p className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-blue-100">
            <CircleParking size={12} className="stroke-[2.5]" />
            Tirvona Parking Pass
          </p>
          <h3 className="font-extrabold text-sm mt-1 line-clamp-1">
            {locationName || "Parking"}
          </h3>
        </div>
      </div>

      {/* QR */}
      <div className="p-6 flex flex-col items-center gap-3">
        {pass.image ? (
          <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
            <img
              src={pass.image}
              alt={`Parking QR code for booking ${booking.bookingReference}`}
              className="w-44 h-44 sm:w-52 sm:h-52 block"
            />
          </div>
        ) : (
          <div className="w-44 h-44 bg-gray-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
        )}

        <div className="text-center space-y-0.5">
          <p className="text-[9px] uppercase tracking-wider font-bold text-gray-400">
            Gate Code
          </p>
          <p className="font-black text-lg tracking-[0.15em] text-[#0B192C] dark:text-white">
            {pass.displayCode}
          </p>
        </div>

        <p className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-900/50">
          <ShieldCheck size={11} className="stroke-[2.5]" />
          Encrypted &amp; tamper-proof
        </p>
      </div>

      {/* Notched divider — the detail that makes it read as a ticket stub */}
      <div className="relative">
        <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-50 dark:bg-[#070F1B] border border-gray-100 dark:border-slate-800" />
        <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-50 dark:bg-[#070F1B] border border-gray-100 dark:border-slate-800" />
        <div className="border-t-2 border-dashed border-gray-200 dark:border-slate-700 mx-5" />
      </div>

      {/* Details */}
      <div className="p-5 space-y-3">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-left">
          <div>
            <dt className="text-[9px] uppercase tracking-wider font-bold text-gray-400">
              Booking
            </dt>
            <dd className="text-[11px] font-black text-[#0B192C] dark:text-white break-all">
              {booking.bookingReference}
            </dd>
          </div>
          <div>
            <dt className="text-[9px] uppercase tracking-wider font-bold text-gray-400">
              Vehicle
            </dt>
            <dd className="text-[11px] font-black text-[#0B192C] dark:text-white inline-flex items-center gap-1">
              <Car size={11} className="stroke-[2.5] shrink-0" />
              {booking.vehicleNumber}
            </dd>
          </div>
          <div>
            <dt className="text-[9px] uppercase tracking-wider font-bold text-gray-400">
              Type
            </dt>
            <dd className="text-[11px] font-bold text-slate-700 dark:text-gray-200">
              {vehicleLabel(booking.vehicleType)}
            </dd>
          </div>
          <div>
            <dt className="text-[9px] uppercase tracking-wider font-bold text-gray-400">
              Bay
            </dt>
            <dd className="text-[11px] font-bold text-slate-700 dark:text-gray-200">
              {booking.assignedSlotNumber || "On arrival"}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[9px] uppercase tracking-wider font-bold text-gray-400">
              Entry
            </dt>
            <dd className="text-[11px] font-bold text-slate-700 dark:text-gray-200">
              {formatDateTime(booking.entryAt)}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[9px] uppercase tracking-wider font-bold text-gray-400">
              Exit
            </dt>
            <dd className="text-[11px] font-bold text-slate-700 dark:text-gray-200">
              {formatDateTime(booking.exitAt)}
            </dd>
          </div>
        </dl>

        <p className="flex items-start gap-1.5 text-[10px] text-gray-400 font-medium leading-relaxed pt-1">
          <Clock size={11} className="shrink-0 mt-0.5 stroke-[2.5]" />
          <span>
            Valid until {formatDateTime(pass.validUntil)}. Show this at the gate
            for entry and exit.
          </span>
        </p>

        <button
          type="button"
          onClick={handleDownload}
          disabled={!pass.image}
          className="w-full bg-[#0A4DA6] hover:bg-[#083D85] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-extrabold px-4 py-2.5 rounded-full inline-flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
        >
          <Download size={14} className="stroke-[2.5]" />
          Download QR Pass
        </button>

        {/* Off-screen anchor drives the download without leaving the page. */}
        <a ref={linkRef} className="hidden" aria-hidden="true" href="#download">
          download
        </a>
      </div>
    </div>
  );
};

export default ParkingQrTicket;
