import React from 'react';
import { Sparkles } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon = <Sparkles size={36} className="text-gray-300 dark:text-slate-700" />,
  action,
}) => {
  return (
    <div className="text-center py-16 px-6 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] space-y-4 shadow-sm">
      <div className="flex justify-center">{icon}</div>
      <div className="space-y-1 max-w-md mx-auto">
        <h4 className="font-extrabold text-base text-[#0B192C] dark:text-white">{title}</h4>
        {description && <p className="text-xs text-gray-400 font-medium leading-relaxed">{description}</p>}
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
};

export default EmptyState;
