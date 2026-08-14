import React from "react";

/**
 * The Tirvona logo.
 *
 * The current transparent brand asset from `frontend/public/logo/logo.png`, copied into this app's
 * `public/` rather than imported across the folder boundary — the two apps
 * build independently, and a relative import into `../../frontend` would tie
 * this build to the other one's layout.
 *
 * Keeping a local copy lets this standalone app render the same brand mark
 * during development and after its build is merged into the main frontend.
 */
export const TirvonaMark = ({ className = "", height = 34 }) => (
  <img
    className={`brand-mark ${className}`.trim()}
    src="/tirvona-logo.png"
    alt="Tirvona"
    height={height}
    style={{ height: `${height}px` }}
    // Part of the first paint — the header is above the fold on every profile.
    loading="eager"
    fetchPriority="high"
    decoding="async"
  />
);
