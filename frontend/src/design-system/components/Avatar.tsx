import React from 'react';

interface AvatarProps {
  name: string;
  role?: string;
  size?: 'sm' | 'md' | 'lg';
  src?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  role,
  size = 'md',
  src,
}) => {
  const initial = name ? name.charAt(0).toUpperCase() : 'U';

  const sizeClasses =
    size === 'sm'
      ? 'w-8 h-8 text-xs'
      : size === 'lg'
      ? 'w-12 h-12 text-base'
      : 'w-10 h-10 text-sm';

  return (
    <div className="flex items-center gap-2.5">
      <div className={`relative ${sizeClasses} shrink-0`}>
        {src ? (
          <img
            src={src}
            alt={name}
            className="w-full h-full rounded-full object-cover border-2 border-[#0A4DA6]/20"
          />
        ) : (
          <div className="w-full h-full rounded-full bg-[#E58C28]/15 border border-[#E58C28]/40 flex items-center justify-center font-black text-[#E58C28]">
            {initial}
          </div>
        )}
      </div>
      {(name || role) && (
        <div className="flex flex-col text-left">
          {name && <span className="text-xs font-black text-[#0B192C] dark:text-white truncate max-w-[120px]">{name}</span>}
          {role && (
            <span className="text-[9px] font-black text-[#E58C28] uppercase tracking-wider">
              {role.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default Avatar;
