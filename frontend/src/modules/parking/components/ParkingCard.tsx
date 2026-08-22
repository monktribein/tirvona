import React from "react";
import { Link } from "react-router-dom";
import {
  MapPin,
  Star,
  Navigation,
  ShieldCheck,
  Clock,
  ArrowRight,
  CircleParking,
} from "lucide-react";
import type { ParkingLocation } from "../types/parking.types";
import {
  formatCurrency,
  formatDistance,
  availabilityTone,
} from "../utils/parkingFormat";
import ParkingAmenityList from "./ParkingAmenityList";

interface ParkingCardProps {
  parking: ParkingLocation;
  query?: string;
  fromPrice?: number;
}

export const ParkingCard: React.FC<ParkingCardProps> = ({
  parking,
  query = "",
  fromPrice,
}) => {
  const image =
    parking.coverImage ||
    parking.images?.[0] ||
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E";

  const available = parking.availability?.availableCount ?? 0;
  const total =
    parking.availability?.totalCapacity ?? parking.totalCapacity ?? 0;
  const declaredCapacity =
    parking.availability?.declaredCapacity ?? parking.totalCapacity ?? 0;
  const awaitingSetup =
    parking.availability?.isConfigured === false && declaredCapacity > 0;
  const nearest = parking.nearbyDestinations?.[0];

  return (
    <article className="group bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col h-full">
      <div className="relative h-44 sm:h-40 overflow-hidden shrink-0">
        <img
          src={image}
          alt={parking.name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

        {parking.isVerified && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 bg-[#0A4DA6] text-white text-[9px] font-black tracking-wider px-2.5 py-1 rounded-full shadow-md">
            <ShieldCheck size={11} className="stroke-[2.5]" />
            Verified
          </span>
        )}

        {parking.rating?.count > 0 && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 bg-white/95 dark:bg-[#0B192C]/95 backdrop-blur-sm text-[#0B192C] dark:text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-md">
            <Star size={11} className="fill-[#D4AF37] text-[#D4AF37]" />
            {parking.rating.average.toFixed(1)}
          </span>
        )}

        {parking.distanceKm !== null && parking.distanceKm !== undefined && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 bg-white/95 dark:bg-[#0B192C]/95 backdrop-blur-sm text-[#0B192C] dark:text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
            <Navigation size={10} className="stroke-[2.5]" />
            {formatDistance(parking.distanceKm)}
          </span>
        )}
      </div>

      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
        <div className="space-y-2.5">
          <div className="space-y-1">
            <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white leading-snug line-clamp-2 h-10 flex items-center">
              {parking.name}
            </h3>
            <p className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 font-medium truncate">
              <MapPin size={11} className="shrink-0 stroke-[2.5]" />
              <span className="truncate">
                {[parking.address?.landmark, parking.address?.city]
                  .filter(Boolean)
                  .join(", ") || "India"}
              </span>
            </p>
          </div>

          <div className="min-h-[26px] flex items-center">
            {nearest ? (
              <p className="text-[10px] font-bold text-[#0A4DA6] dark:text-blue-300 bg-blue-50/70 dark:bg-slate-800 rounded-full px-2.5 py-1 inline-flex items-center gap-1 max-w-full">
                <Navigation size={10} className="shrink-0 stroke-[2.5]" />
                <span className="truncate">
                  {nearest.walkingMinutes
                    ? `${nearest.walkingMinutes} min walk`
                    : `${nearest.distanceKm ?? 0} km`}{" "}
                  to {nearest.name}
                </span>
              </p>
            ) : (
              <div className="h-[26px]" />
            )}
          </div>

          <div className="min-h-[26px] flex items-center">
            <ParkingAmenityList amenities={parking.amenities || []} limit={3} />
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between gap-2 text-[10px] font-bold">
            <span
              className={`inline-flex items-center gap-1 ${awaitingSetup ? "text-amber-600 dark:text-amber-400" : availabilityTone(available, total)}`}
            >
              <CircleParking size={12} className="stroke-[2.5]" />
              {available > 0
                ? `${available} of ${total} free`
                : awaitingSetup
                  ? `${declaredCapacity} bays · opening soon`
                  : "Currently full"}
            </span>
            <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
              <Clock size={11} className="stroke-[2.5]" />
              {parking.openingHours?.is24x7
                ? "24×7"
                : `${parking.openingHours?.opensAt}–${parking.openingHours?.closesAt}`}
            </span>
          </div>

          <div className="flex items-end justify-between gap-2 pt-2">
            <div className="pt-2.5">
              {fromPrice !== undefined ? (
                <>
                  <span className="block text-[9px] tracking-wider font-bold text-gray-400">
                    From
                  </span>
                  <span className="text-base font-black text-[#0B192C] dark:text-white">
                    {formatCurrency(fromPrice)}
                  </span>
                </>
              ) : (
                <span className="text-[10px] font-bold text-gray-400">
                  Tap to see pricing
                </span>
              )}
            </div>

            <Link
              to={`/parking/${parking.slug}${query}`}
              className="mt-2.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-[11px] font-bold pl-4 pr-1.5 py-1.5 rounded-full inline-flex items-center gap-2 shadow-md transition-all active:scale-95 shrink-0"
            >
              <span>View</span>
              <span className="w-5 h-5 rounded-full bg-white text-[#0A4DA6] flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                <ArrowRight size={11} className="stroke-[3]" />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
};

export default ParkingCard;
