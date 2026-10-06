import React from 'react';

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => {
  return (
    <div
      className={`bg-dark-800 border border-dark-700/80 rounded-xl p-4 shadow-sm hover:border-dark-600 transition-colors ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'brand' | 'neutral' | 'accent' | 'warning';
}

export const Badge: React.FC<BadgeProps> = ({
  className = '',
  variant = 'neutral',
  children,
  ...props
}) => {
  const variants = {
    brand: 'bg-brand-500/10 text-brand-500 border-brand-500/20',
    neutral: 'bg-dark-700/50 text-zinc-300 border-dark-600',
    accent: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    warning: 'bg-red-500/10 text-red-400 border-red-500/20',
  }[variant];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${variants} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
