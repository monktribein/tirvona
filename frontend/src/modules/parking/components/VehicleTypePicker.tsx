import React from "react";
import { Bike, Car, Truck, Bus, Zap } from "lucide-react";
import type {
  ParkingVehicleType,
  ParkingVehicleTypeCode,
} from "../types/parking.types";

// Vehicle class selector, used in search filters and in the booking form.

const ICONS: Record<string, React.ReactNode> = {
  bike: <Bike size={16} className="stroke-[2.5]" />,
  car: <Car size={16} className="stroke-[2.5]" />,
  truck: <Truck size={16} className="stroke-[2.5]" />,
  bus: <Bus size={16} className="stroke-[2.5]" />,
  zap: <Zap size={16} className="stroke-[2.5]" />,
};

interface VehicleTypePickerProps {
  options: ParkingVehicleType[];
  value: ParkingVehicleTypeCode | "";
  onChange: (code: ParkingVehicleTypeCode) => void;
  /** Codes the current facility accepts. Others render disabled. */
  supported?: ParkingVehicleTypeCode[];
  compact?: boolean;
}

export const VehicleTypePicker: React.FC<VehicleTypePickerProps> = ({
  options,
  value,
  onChange,
  supported,
  compact = false,
}) => {
  return (
    <div
      className={`grid gap-1.5 ${compact ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-3 sm:grid-cols-5 lg:grid-cols-9"}`}
    >
      {options.map((option) => {
        const isSupported = !supported || supported.includes(option.code);
        const isActive = value === option.code;

        return (
          <button
            key={option.code}
            type="button"
            disabled={!isSupported}
            onClick={() => onChange(option.code)}
            title={
              isSupported
                ? option.label
                : `${option.label} is not accepted here`
            }
            className={`flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-2xl border transition-all cursor-pointer group ${
              isActive
                ? "bg-[#0A4DA6] border-[#0A4DA6] text-white shadow-md shadow-[#0A4DA6]/25"
                : isSupported
                  ? "bg-white dark:bg-[#0B192C] border-gray-200 dark:border-slate-700 text-slate-700 dark:text-gray-200 hover:border-[#0A4DA6] hover:bg-blue-50/60 dark:hover:bg-slate-800"
                  : "bg-gray-50 dark:bg-slate-900 border-gray-100 dark:border-slate-800 text-gray-300 dark:text-slate-700 cursor-not-allowed"
            }`}
          >
            <span
              className={`p-1.5 rounded-xl transition-colors ${
                isActive
                  ? "bg-white/20 text-white"
                  : isSupported
                    ? "bg-blue-50 dark:bg-blue-900/30 text-[#0A4DA6] dark:text-blue-300 group-hover:bg-[#0A4DA6] group-hover:text-white"
                    : "bg-gray-100 dark:bg-slate-800 text-gray-300 dark:text-slate-700"
              }`}
            >
              {ICONS[option.icon] || ICONS.car}
            </span>
            <span
              className={`text-[9px] font-bold text-center leading-tight ${isActive ? "text-white" : ""}`}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default VehicleTypePicker;
