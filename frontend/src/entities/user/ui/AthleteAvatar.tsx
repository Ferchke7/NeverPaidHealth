import React, { useState } from 'react';

export interface AthleteAvatarProps {
  name?: string;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
}

const SIZE_CLASSES = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-9 h-9 text-xs',
  lg: 'w-12 h-12 text-sm',
  xl: 'w-16 h-16 text-lg',
};

export const AthleteAvatar: React.FC<AthleteAvatarProps> = ({
  name = 'Атлет',
  avatarUrl,
  size = 'md',
  className = '',
  onClick,
  title,
}) => {
  const [imgError, setImgError] = useState(false);
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const initial = (name.trim()[0] || 'А').toUpperCase();
  const isClickable = !!onClick;
  const cursorClass = isClickable
    ? 'cursor-pointer hover:border-[#34d399]/60 transition-colors'
    : '';

  const cleanUrl = avatarUrl && !imgError && avatarUrl.trim() !== '' ? avatarUrl.trim() : null;

  return (
    <div
      onClick={onClick}
      title={title || name}
      className={`relative shrink-0 rounded-full select-none overflow-hidden flex items-center justify-center font-semibold text-[#34d399] bg-[#022c22] border border-[#064e3b] ${sizeClass} ${cursorClass} ${className}`}
    >
      {cleanUrl ? (
        <img
          src={cleanUrl}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover rounded-full"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center font-bold uppercase tracking-tight">
          {initial}
        </div>
      )}
    </div>
  );
};
