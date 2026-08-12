import React from "react";

/**
 * The Tirvona wordmark, inline.
 *
 * Inline SVG rather than an <img> so the header paints with the first HTML
 * byte instead of costing a second round trip — the same two-second budget
 * that shapes the rest of this page (spec §39).
 *
 * Colours are applied through CSS classes, not `fill="var(--navy)"`: SVG
 * presentation attributes are not CSS declarations and do not resolve custom
 * properties, so the var() form renders black. The classes in styles.css carry
 * the brand tokens, which also lets an NEP-branded deployment (spec §43)
 * restyle the mark without touching this file.
 */
export const TirvonaMark = () => (
  <svg
    className="brand-mark"
    viewBox="0 0 220 40"
    role="img"
    aria-label="Tirvona"
    height="28"
  >
    <circle className="mark-disc" cx="20" cy="20" r="16" />
    <path
      className="mark-flame"
      d="M20 9c3.6 3.3 5.4 6.6 5.4 10.4 0 3.6-2.4 6.6-5.4 6.6s-5.4-3-5.4-6.6C14.6 15.6 16.4 12.3 20 9z"
    />
    <text className="mark-word" x="46" y="27">
      TIRVONA
    </text>
  </svg>
);
