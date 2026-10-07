import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'flat';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  isIconOnly?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading = false,
      isIconOnly = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const base =
      'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-900 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98] cursor-pointer';

    const variants = {
      primary:
        'bg-brand-500 hover:bg-brand-400 text-dark-950 shadow-md shadow-brand-500/20 font-bold border border-brand-400/30 active:bg-brand-600',
      secondary:
        'bg-dark-800 hover:bg-dark-750 text-zinc-100 border border-dark-700/90 shadow-sm active:bg-dark-850',
      outline:
        'border border-dark-600/90 hover:border-brand-500/60 text-zinc-200 hover:text-white bg-transparent hover:bg-dark-800/80 active:bg-dark-800',
      ghost:
        'text-zinc-400 hover:text-zinc-100 hover:bg-dark-800/60 active:bg-dark-800 border border-transparent',
      danger:
        'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 active:bg-red-500/35',
      success:
        'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 active:bg-emerald-500/35',
      flat:
        'bg-brand-500/15 hover:bg-brand-500/25 text-brand-400 border border-brand-500/25',
    }[variant];

    const sizes = isIconOnly
      ? {
          xs: 'w-7 h-7 p-0 text-xs rounded-lg',
          sm: 'w-8 h-8 p-0 text-xs rounded-lg',
          md: 'w-10 h-10 p-0 text-sm rounded-xl',
          lg: 'w-12 h-12 p-0 text-base rounded-2xl',
        }[size]
      : {
          xs: 'px-2 py-1 text-[11px] gap-1 rounded-lg',
          sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-xl',
          md: 'px-4 py-2.5 text-sm gap-2 rounded-xl',
          lg: 'px-6 py-3 text-base gap-2.5 rounded-2xl',
        }[size];

    return (
      <button
        ref={ref}
        className={`${base} ${variants} ${sizes} ${className}`}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  attached?: boolean;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({
  className = '',
  attached = false,
  children,
  ...props
}) => {
  return (
    <div
      className={`inline-flex items-center ${
        attached
          ? '[&>button]:rounded-none [&>button:first-child]:rounded-l-xl [&>button:last-child]:rounded-r-xl [&>button:not(:last-child)]:border-r-0'
          : 'gap-1.5'
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
