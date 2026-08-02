import React from "react";
import { RotateCcw } from "lucide-react";

interface EnterpriseResetButtonProps {
  onReset: () => void;
  label?: string;
  className?: string;
}

export const EnterpriseResetButton: React.FC<EnterpriseResetButtonProps> = ({
  onReset,
  label = "Reset Filters",
  className = "",
}) => {
  return (
    <button
      type="button"
      onClick={onReset}
      className={`px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-full text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs ${className}`}
    >
      <RotateCcw size={13} />
      <span>{label}</span>
    </button>
  );
};

export default EnterpriseResetButton;
