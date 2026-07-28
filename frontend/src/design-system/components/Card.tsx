import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'white' | 'glass' | 'bordered';
  padding?: 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'white',
  padding = 'md',
}) => {
  const paddingClass = padding === 'sm' ? 'p-4' : padding === 'lg' ? 'p-8' : 'p-6';

  const variantClass =
    variant === 'glass'
      ? 'bg-white/80 dark:bg-[#0B192C]/80 backdrop-blur-xl border border-white/20 dark:border-slate-800 shadow-xl'
      : variant === 'bordered'
      ? 'bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 shadow-xs'
      : 'bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 shadow-lg shadow-gray-200/40 dark:shadow-none';

  return (
    <div
      className={`rounded-[28px] transition-all duration-300 ${paddingClass} ${variantClass} ${className}`}
    >
      {children}
    </div>
  );
};

export default Card;
