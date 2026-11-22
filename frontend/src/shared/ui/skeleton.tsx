import React from 'react';
import { Skeleton as HeroSkeleton } from '@heroui/react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'rectangular' | 'circular' | 'rounded';
  isLoaded?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rounded',
  isLoaded = false,
  children,
  ...props
}) => {
  if (isLoaded) return <>{children}</>;

  const variantStyles = {
    rectangular: 'rounded-none',
    circular: 'rounded-full',
    rounded: 'rounded-[12px]',
  }[variant];

  return (
    <HeroSkeleton.Root
      className={`bg-[#ECEAF6] ${variantStyles} ${className}`}
      {...props}
    />
  );
};
