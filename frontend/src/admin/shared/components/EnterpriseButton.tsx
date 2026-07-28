import React from 'react';

interface EnterpriseButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'success' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
}

export const EnterpriseButton: React.FC<EnterpriseButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses =
    'rounded-full font-extrabold inline-flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed';

  const sizeClasses =
    size === 'sm'
      ? 'px-3 py-1.5 text-[11px]'
      : size === 'lg'
      ? 'px-6 py-3 text-sm'
      : 'px-4 py-2 text-xs';

  const variantClasses =
    variant === 'primary'
      ? 'bg-[#0A4DA6] hover:bg-[#083b80] text-white shadow-md shadow-[#0A4DA6]/20'
      : variant === 'secondary'
      ? 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-700'
      : variant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20'
      : variant === 'warning'
      ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20'
      : variant === 'success'
      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20'
      : variant === 'outline'
      ? 'border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 bg-white dark:bg-[#0B192C] hover:bg-gray-50 dark:hover:bg-slate-800'
      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 shadow-none';

  return (
    <button
      disabled={disabled || loading}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon
      )}
      <span>{children}</span>
    </button>
  );
};

export default EnterpriseButton;
