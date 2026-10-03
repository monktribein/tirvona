import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { X, Headphones } from "lucide-react";

export const FloatingSupportBox: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isDismissed, setIsDismissed] = useState(false);
  const prevPathRef = useRef(location.pathname);

  // Restrict to landing page only
  const isLandingPage =
    location.pathname === "/" || location.pathname === "/public";

  // Re-show fresh when returning to the landing page
  useEffect(() => {
    if (isLandingPage && prevPathRef.current !== location.pathname) {
      setIsDismissed(false);
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname, isLandingPage]);

  // If not on landing page or dismissed, do not render
  if (!isLandingPage || isDismissed) {
    return null;
  }

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
  };

  const handleRedirectToSupport = () => {
    setIsDismissed(true);
    navigate("/profile/support");
  };

  return (
    <div
      aria-label="Get Support"
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 select-none transition-all duration-200 animate-in fade-in"
      style={{ position: "fixed" }}
    >
      <div
        onClick={handleRedirectToSupport}
        className="group flex items-center gap-2 pl-3 pr-2 py-2 bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.12)] rounded-full transition-all duration-200 cursor-pointer"
        title="Get Customer Support"
      >
        <Headphones size={15} className="text-[#F7931E] shrink-0" />
        <span className="text-xs font-semibold text-slate-800 tracking-tight whitespace-nowrap">
          Get Support
        </span>
        <button
          onClick={handleClose}
          className="w-5 h-5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors ml-0.5 cursor-pointer"
          title="Dismiss"
          aria-label="Close"
        >
          <X size={11} className="stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};

export default FloatingSupportBox;
