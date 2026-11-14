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
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const messageId = `${inputId}-message`;
    const isError = isInvalid || !!error || !!errorMessage;
    const activeError = errorMessage || error;

    const sizeStyles = {
      sm: 'h-9 px-3 text-[13px]',
      md: 'h-11 px-3.5 text-[14px]',
      lg: 'h-12 px-4 text-[15px]',
    }[size];

    const variantStyles = {
      flat: 'bg-[#171717] border border-[#262626] focus-within:border-[#34d399]',
      bordered:
        'bg-[#0a0a0a] border border-[#404040] focus-within:border-[#34d399] focus-within:ring-1 focus-within:ring-[#34d399]/30',
      underlined: 'bg-transparent border-b border-[#404040] rounded-none px-0 focus-within:border-[#34d399]',
    }[variant];

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-[12px] font-medium text-[#a3a3a3]">
            {label}
          </label>
        )}

        <div
          className={`flex items-center transition-colors duration-150 ${
            variant !== 'underlined' ? 'rounded-[10px]' : ''
          } ${variantStyles} ${
            isError ? 'border-red-500/80 focus-within:border-red-500 focus-within:ring-red-500/20' : ''
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {startContent && (
            <div className="pl-3.5 pr-1 text-[#a3a3a3] flex items-center shrink-0">
              {startContent}
            </div>
          )}

          <input
            id={inputId}
            aria-invalid={isError || undefined}
            aria-describedby={activeError || description ? messageId : props['aria-describedby']}
            ref={ref}
            disabled={disabled}
            className={`w-full bg-transparent text-[#fafafa] placeholder-[#a3a3a3] focus:outline-none font-normal ${sizeStyles} ${className}`}
            {...props}
          />

          {endContent && (
            <div className="pr-3.5 pl-1 text-[#a3a3a3] flex items-center shrink-0 font-normal">
              {endContent}
            </div>
          )}
        </div>

        {description && !activeError && (
          <p id={messageId} className="text-[12px] text-[#a3a3a3] leading-tight">{description}</p>
        )}

        {activeError && (
          <p id={messageId} className="text-xs text-red-400 font-medium flex items-center gap-1">
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
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const messageId = `${inputId}-message`;
    const isError = isInvalid || !!error || !!errorMessage;
    const activeError = errorMessage || error;

    const variantStyles = {
      flat: 'bg-[#171717] border border-[#262626] focus:border-[#34d399]',
      bordered:
        'bg-[#0a0a0a] border border-[#404040] focus:border-[#34d399] focus:ring-1 focus:ring-[#34d399]/30',
    }[variant];

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-[12px] font-medium text-[#a3a3a3]">
            {label}
          </label>
        )}

        <textarea
          id={inputId}
          aria-invalid={isError || undefined}
          aria-describedby={activeError || description ? messageId : props['aria-describedby']}
          ref={ref}
          disabled={disabled}
          className={`w-full rounded-[10px] p-3 text-[14px] text-[#fafafa] placeholder-[#a3a3a3] focus:outline-none font-normal transition-colors duration-150 resize-none ${variantStyles} ${
            isError ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20' : ''
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
          {...props}
        />

        {description && !activeError && (
          <p id={messageId} className="text-[12px] text-[#a3a3a3] leading-tight">{description}</p>
        )}

        {activeError && (
          <p id={messageId} className="text-xs text-red-400 font-medium flex items-center gap-1">
            <span>{activeError}</span>
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
