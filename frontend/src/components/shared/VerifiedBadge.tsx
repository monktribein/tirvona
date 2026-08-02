import React from "react";

export interface VerifiedBadgeProps {
  isVerified?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  tooltipText?: string;
  // Kept for prop interface backward compatibility
  text?: string;
  showText?: boolean;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  isVerified = true,
  size = "md",
  className = "",
  tooltipText = "Verified by Tirvona",
}) => {
  if (!isVerified) return null;

  const heightClasses = {
    sm: "h-6",
    md: "h-8",
    lg: "h-10",
  };

  return (
    <img
      src="/verified-badge.png"
      alt="Verified by Tirvona"
      title={tooltipText}
      aria-label={tooltipText}
      className={`inline-block ${heightClasses[size]} w-auto object-contain shrink-0 select-none align-middle ${className}`}
    />
  );
};

export default VerifiedBadge;
