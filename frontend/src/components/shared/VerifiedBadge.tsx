import React from "react";

export interface VerifiedBadgeProps {
  isVerified?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  tooltipText?: string;
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
    sm: "h-8",
    md: "h-10",
    lg: "h-12",
  };

  return (
    <img
      src="/Verified badge/verified.png"
      alt="Verified by Tirvona"
      title={tooltipText}
      aria-label={tooltipText}
      className={`inline-block ${heightClasses[size]} w-auto object-contain shrink-0 select-none align-middle ${className}`}
    />
  );
};

export default VerifiedBadge;
