import React from "react";
import { X } from "lucide-react";

interface EnterpriseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl" | "full";
}

export const EnterpriseModal: React.FC<EnterpriseModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  maxWidth = "md",
}) => {
  if (!isOpen) return null;

  const maxWidthClass =
    maxWidth === "sm"
      ? "max-w-sm"
      : maxWidth === "lg"
        ? "max-w-lg"
        : maxWidth === "xl"
          ? "max-w-xl"
          : maxWidth === "2xl"
            ? "max-w-2xl"
            : maxWidth === "3xl"
              ? "max-w-3xl"
              : maxWidth === "4xl"
                ? "max-w-4xl"
                : maxWidth === "5xl"
                  ? "max-w-5xl"
                  : maxWidth === "6xl"
                    ? "max-w-6xl"
                    : maxWidth === "7xl"
                      ? "max-w-7xl"
                      : maxWidth === "full"
                        ? "max-w-full"
                        : "max-w-md";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className={`bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 w-full ${maxWidthClass} rounded-[28px] p-6 space-y-5 text-left shadow-2xl animate-in zoom-in-95 duration-150 relative overflow-hidden`}
      >
        <div className="flex justify-between items-start border-b border-gray-100 dark:border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            {icon}
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-[#0B192C] dark:text-white leading-tight">
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-gray-400 font-medium mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto pr-1 text-xs space-y-4">
          {children}
        </div>

        {footer && (
          <div className="pt-3 border-t border-gray-100 dark:border-slate-800">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default EnterpriseModal;
