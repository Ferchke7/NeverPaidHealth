import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'flat' | 'bordered' | 'glow';
  isHoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  className = '',
  variant = 'default',
  isHoverable = false,
  children,
  ...props
}) => {
  const variantStyles = {
    default: 'bg-dark-800/90 border border-dark-700/80 shadow-lg shadow-black/40',
    flat: 'bg-dark-900/70 border border-dark-800/80 shadow-none',
    bordered: 'bg-transparent border border-dark-700/90',
    glow: 'bg-gradient-to-br from-dark-850 via-dark-900 to-dark-850 border border-brand-500/30 shadow-xl shadow-brand-500/5',
  }[variant];

  const hoverStyles = isHoverable
    ? 'hover:border-dark-600 hover:shadow-xl transition-all duration-200 cursor-pointer'
    : '';

  return (
    <div
      className={`rounded-2xl p-5 ${variantStyles} ${hoverStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div className={`flex items-center justify-between pb-3 border-b border-dark-700/70 gap-2 ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <h3 className={`text-base font-extrabold text-white tracking-tight flex items-center gap-2 ${className}`} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <p className={`text-xs text-zinc-400 mt-0.5 leading-relaxed ${className}`} {...props}>
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div className={`py-2 ${className}`} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div className={`flex items-center justify-between pt-3 border-t border-dark-700/70 gap-2 ${className}`} {...props}>
    {children}
  </div>
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'brand' | 'neutral' | 'accent' | 'warning' | 'danger' | 'success' | 'info';
  size?: 'sm' | 'md' | 'lg';
}

export const Badge: React.FC<BadgeProps> = ({
  className = '',
  variant = 'neutral',
  size = 'md',
  children,
  ...props
}) => {
  const variants = {
    brand: 'bg-brand-500/15 text-brand-400 border-brand-500/30',
    neutral: 'bg-dark-700/60 text-zinc-300 border-dark-600/80',
    accent: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    warning: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    danger: 'bg-red-500/15 text-red-400 border-red-500/30',
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    info: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  }[variant];

  const sizes = {
    sm: 'px-1.5 py-0.5 text-[10px]',
    md: 'px-2.5 py-0.5 text-xs',
    lg: 'px-3 py-1 text-sm',
  }[size];

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full border whitespace-nowrap ${variants} ${sizes} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

export interface ChipProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'solid' | 'bordered' | 'flat' | 'dot';
  color?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'secondary';
  onClose?: () => void;
}

export const Chip: React.FC<ChipProps> = ({
  className = '',
  variant = 'flat',
  color = 'primary',
  onClose,
  children,
  ...props
}) => {
  const colorStyles = {
    primary: 'bg-brand-500/15 text-brand-400 border-brand-500/30',
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    danger: 'bg-red-500/15 text-red-400 border-red-500/30',
    secondary: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    default: 'bg-dark-700/70 text-zinc-300 border-dark-600',
  }[color];

  return (
    <div
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${colorStyles} ${className}`}
      {...props}
    >
      {variant === 'dot' && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      <span>{children}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="ml-1 hover:opacity-75 focus:outline-none"
        >
          ×
        </button>
      )}
    </div>
  );
};
