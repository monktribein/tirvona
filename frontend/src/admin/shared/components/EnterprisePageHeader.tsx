import React from 'react';

interface EnterprisePageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badgeText?: string;
  actions?: React.ReactNode;
}

export const EnterprisePageHeader: React.FC<EnterprisePageHeaderProps> = ({
  title,
  subtitle,
  icon,
  badgeText,
  actions,
}) => {
  return (
    <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[28px] shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all">
      <div className="flex items-center gap-3.5">
        {icon && (
          <div className="w-12 h-12 rounded-2xl bg-[#0A4DA6]/10 text-[#0A4DA6] dark:text-amber-400 flex items-center justify-center shrink-0 border border-[#0A4DA6]/15">
            {icon}
          </div>
        )}
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-black text-[#0B192C] dark:text-white tracking-tight">{title}</h2>
            {badgeText && (
              <span className="px-3 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-full text-xs font-black border border-amber-200 dark:border-amber-900/50">
                {badgeText}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-gray-400 font-semibold leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>}
    </div>
  );
};

export default EnterprisePageHeader;
