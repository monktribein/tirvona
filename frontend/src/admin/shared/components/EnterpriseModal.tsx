import React, { useEffect, useId, useRef } from "react";
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
  /** Height cap of the scrolling body; defaults to 70vh. */
  bodyMaxHeight?: string;
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
  bodyMaxHeight = "max-h-none",
}) => {
  const titleId = useId();
  const subtitleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const previousActive = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActive?.focus();
    };
  }, [isOpen]);

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
    <div className="tv-drawer-overlay" onMouseDown={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        onMouseDown={(event) => event.stopPropagation()}
        className={`tv-drawer-panel ${maxWidthClass} text-left`}
      >
        <div className="tv-drawer-header flex justify-between items-start gap-4 border-b border-gray-100 dark:border-slate-800 px-5 sm:px-6 py-5">
          <div className="flex items-center gap-2.5">
            {icon}
            <div>
              <h3 id={titleId} className="font-extrabold text-base sm:text-lg text-[#0B192C] dark:text-white leading-tight">
                {title}
              </h3>
              {subtitle && (
                <p id={subtitleId} className="text-xs text-gray-400 font-medium mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className={`tv-drawer-body ${bodyMaxHeight} px-5 sm:px-6 py-5 text-xs space-y-4`}>
          {children}
        </div>

        {footer && (
          <div className="tv-drawer-footer px-5 sm:px-6 py-4 border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-[#0B192C]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default EnterpriseModal;
