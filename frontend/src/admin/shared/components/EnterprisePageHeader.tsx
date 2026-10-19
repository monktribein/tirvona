import React from "react";
import { useLanguage } from "../../../contexts/LanguageContext";

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
  const { t } = useLanguage();
  return (
    <div className="tv-page-header">
      <div className="flex min-w-0 items-center gap-3.5">
        {icon && <div className="tv-page-header-icon">{icon}</div>}
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl font-semibold tracking-tight text-[#0B192C] dark:text-white sm:text-2xl">
              {t(title)}
            </h2>
            {badgeText && (
              <span className="bg-[#F28C28]/10 px-2 py-0.5 text-[11px] font-semibold text-[#B45309] dark:text-[#FFA44D]">
                {t(badgeText)}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs font-medium leading-relaxed text-gray-500 dark:text-gray-400">
              {t(subtitle)}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          {actions}
        </div>
      )}
    </div>
  );
};

export default EnterprisePageHeader;
