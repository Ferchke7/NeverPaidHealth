import React from 'react';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  description?: string;
  error?: string;
  errorMessage?: string;
  isInvalid?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'flat' | 'bordered' | 'underlined';
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className = '',
      label,
      description,
      error,
      errorMessage,
      isInvalid = false,
      size = 'md',
      variant = 'bordered',
      startContent,
      endContent,
      disabled,
      ...props
    },
    ref
  ) => {
    const isError = isInvalid || !!error || !!errorMessage;
    const activeError = errorMessage || error;

    const sizeStyles = {
      sm: 'h-8 px-2.5 text-xs',
      md: 'h-10 px-3.5 text-sm',
      lg: 'h-12 px-4 text-base',
    }[size];

    const variantStyles = {
      flat: 'bg-dark-900/80 border border-transparent focus-within:border-brand-500',
      bordered:
        'bg-dark-900/90 border border-dark-700 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500/30',
      underlined: 'bg-transparent border-b border-dark-700 rounded-none px-0 focus-within:border-brand-500',
    }[variant];

    return (
      <div className="w-full space-y-1">
        {label && (
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
            {label}
          </label>
        )}

        <div
          className={`flex items-center rounded-xl transition-all duration-150 ${
            variant !== 'underlined' ? 'rounded-xl' : ''
          } ${variantStyles} ${
            isError ? 'border-red-500/80 focus-within:border-red-500 focus-within:ring-red-500/20' : ''
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {startContent && (
            <div className="pl-3 pr-1 text-zinc-400 flex items-center shrink-0">
              {startContent}
            </div>
          )}

          <input
            ref={ref}
            disabled={disabled}
            className={`w-full bg-transparent text-zinc-100 placeholder-zinc-500 focus:outline-none font-medium ${sizeStyles} ${className}`}
            {...props}
          />

          {endContent && (
            <div className="pr-3 pl-1 text-zinc-400 flex items-center shrink-0 font-medium">
              {endContent}
            </div>
          )}
        </div>

        {description && !activeError && (
          <p className="text-[11px] text-zinc-400 leading-tight">{description}</p>
        )}

        {activeError && (
          <p className="text-xs text-red-400 font-medium flex items-center gap-1 animate-fade-in">
            <span>{activeError}</span>
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  description?: string;
  error?: string;
  errorMessage?: string;
  isInvalid?: boolean;
  variant?: 'flat' | 'bordered';
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className = '',
      label,
      description,
      error,
      errorMessage,
      isInvalid = false,
      variant = 'bordered',
      disabled,
      ...props
    },
    ref
  ) => {
    const isError = isInvalid || !!error || !!errorMessage;
    const activeError = errorMessage || error;

    const variantStyles = {
      flat: 'bg-dark-900/80 border border-transparent focus:border-brand-500',
      bordered:
        'bg-dark-900/90 border border-dark-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30',
    }[variant];

    return (
      <div className="w-full space-y-1">
        {label && (
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
            {label}
          </label>
        )}

        <textarea
          ref={ref}
          disabled={disabled}
          className={`w-full rounded-xl p-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none font-medium transition-all duration-150 resize-none ${variantStyles} ${
            isError ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20' : ''
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
          {...props}
        />

        {description && !activeError && (
          <p className="text-[11px] text-zinc-400 leading-tight">{description}</p>
        )}

        {activeError && (
          <p className="text-xs text-red-400 font-medium flex items-center gap-1 animate-fade-in">
            <span>{activeError}</span>
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

