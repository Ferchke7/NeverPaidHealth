import React from 'react';
import { UserProfile } from '../model/types.ts';

interface UserAvatarProps {
  user: UserProfile | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ user, size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
  }[size];

  if (!user) {
    return (
      <div className={`${sizeClasses} rounded-full bg-dark-700 flex items-center justify-center font-medium text-zinc-400`}>
        ?
      </div>
    );
  }

  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.display_name}
        className={`${sizeClasses} rounded-full object-cover border border-dark-600`}
      />
    );
  }

  const initial = user.display_name ? user.display_name[0].toUpperCase() : 'A';
  return (
    <div className={`${sizeClasses} ${className} rounded-full bg-brand-500/20 text-brand-500 border border-brand-500/30 flex items-center justify-center font-semibold`}>
      {initial}
    </div>
  );
};
