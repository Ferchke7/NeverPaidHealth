import React, { useState } from 'react';

export interface AthleteAvatarProps {
  name?: string;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
}

const GRADIENTS = [
  'from-amber-500 to-rose-500',
  'from-cyan-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-purple-500 to-indigo-600',
  'from-pink-500 to-rose-600',
  'from-orange-500 to-amber-600',
  'from-fuchsia-500 to-pink-600',
  'from-teal-400 to-emerald-600',
];

function getGradient(name: string): string {
  if (!name) return GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % GRADIENTS.length;
  return GRADIENTS[idx];
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
  const gradient = getGradient(name);

  const isClickable = !!onClick;
  const cursorClass = isClickable
    ? 'cursor-pointer hover:ring-2 hover:ring-brand-500/60 transition-transform active:scale-95'
    : '';

  const cleanUrl = avatarUrl && !imgError && avatarUrl.trim() !== '' ? avatarUrl.trim() : null;

  return (
    <div
      onClick={onClick}
      title={title || name}
      className={`relative shrink-0 rounded-full select-none overflow-hidden flex items-center justify-center font-bold text-white shadow-sm border border-dark-700/80 ${sizeClass} ${cursorClass} ${className}`}
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
        <div
          className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center font-extrabold uppercase tracking-tight`}
        >
          {initial}
        </div>
      )}
    </div>
  );
};
