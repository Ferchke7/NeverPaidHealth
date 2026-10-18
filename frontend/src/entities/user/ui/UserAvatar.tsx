import React from 'react';
import { Avatar } from '@heroui/react';
import { UserProfile } from '../model/types.ts';

interface UserAvatarProps {
  user: UserProfile | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ user, size = 'md', className = '' }) => {
  const initial = user?.display_name ? user.display_name[0].toUpperCase() : 'A';

  return (
    <Avatar.Root size={size} color="accent" className={className}>
      {user?.avatar_url && (
        <Avatar.Image src={user.avatar_url} alt={user.display_name} />
      )}
      <Avatar.Fallback color="accent" className="font-bold">
        {user ? initial : '?'}
      </Avatar.Fallback>
    </Avatar.Root>
  );
};
