import React from 'react';

interface SkeletonLoaderProps {
  variant?: 'card' | 'table' | 'header';
  count?: number;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  variant = 'card',
  count = 3,
}) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[24px] ${
            variant === 'header'
              ? 'h-24 w-full'
              : variant === 'table'
              ? 'h-16 w-full'
              : 'h-44 w-full'
          }`}
        />
      ))}
    </div>
  );
};

export default SkeletonLoader;
