import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** initial vertical offset in px (slide-in distance) */
  y?: number;
  /** stagger delay in seconds */
  delay?: number;
}

// Subtle fade + slide-in-on-scroll wrapper. Animates only transform/opacity
// (GPU-accelerated), fires once when it enters the viewport, and disables
// itself when the user prefers reduced motion.
export const Reveal: React.FC<RevealProps> = ({ children, className, y = 24, delay = 0 }) => {
  const reduce = useReducedMotion();

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
};

export default Reveal;
