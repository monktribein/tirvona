import React from "react";

// Branded full-screen loader shown while a page's chunk / data loads.
// Used as the router Suspense fallback so it appears on every page.
export const PageLoader: React.FC = () => (
  <div className="min-h-screen w-full flex flex-col items-center justify-center gap-5 bg-background">
    <div className="relative">
      {/* Soft pulsing halo behind the logo */}
      <span className="absolute inset-0 rounded-full bg-[#0A4DA6]/20 blur-xl animate-ping" />
      <img
        src="/logo/logo.png"
        alt="Tirvona"
        className="relative w-14 h-14 object-contain animate-pulse"
      />
    </div>

    {/* Skeleton shimmer bars */}
    <div className="w-56 space-y-2.5">
      <div className="skeleton h-3 w-3/4 mx-auto rounded-full" />
      <div className="skeleton h-3 w-1/2 mx-auto rounded-full" />
    </div>

    <p className="text-[11px] font-bold tracking-widest text-gray-400">
      Loading
    </p>
  </div>
);

export default PageLoader;
