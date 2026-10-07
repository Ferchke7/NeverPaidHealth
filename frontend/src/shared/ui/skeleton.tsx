import React from 'react';

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
    rounded: 'rounded-xl',
  }[variant];

  return (
    <div
      className={`animate-pulse bg-dark-800 border border-dark-750/50 ${variantStyles} ${className}`}
      {...props}
    />
  );
};
