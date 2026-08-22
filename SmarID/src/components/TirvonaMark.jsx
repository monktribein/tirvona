import React from "react";

export const TirvonaMark = ({ className = "", height = 34 }) => (
  <img
    className={`brand-mark ${className}`.trim()}
    src="/tirvona-logo.png"
    alt="Tirvona"
    height={height}
    style={{ height: `${height}px` }}
    loading="eager"
    fetchPriority="high"
    decoding="async"
  />
);
