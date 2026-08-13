import React from "react";

/**
 * The Tirvona logo.
 *
 * The real brand asset from `frontend/public/logo.png`, copied into this app's
 * `public/` rather than imported across the folder boundary — the two apps
 * build independently, and a relative import into `../../frontend` would tie
 * this build to the other one's layout.
 *
 * The file is a wordmark with the tagline baked in, on a white ground, so the
 * page keeps a light surface behind it (see `styles.css`) rather than needing a
 * separate knockout version.
 */
export const TirvonaMark = ({ className = "", height = 34 }) => (
  <img
    className={`brand-mark ${className}`.trim()}
    src="/logo.png"
    alt="Tirvona"
    height={height}
    style={{ height: `${height}px` }}
    // Part of the first paint — the header is above the fold on every profile.
    loading="eager"
    fetchPriority="high"
    decoding="async"
  />
);
