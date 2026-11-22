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
      flat: 'bg-[#F8F7FC] border border-[#ECEAF6] focus-within:border-[#7C3AED] focus-within:bg-[#FFFFFF]',
      bordered:
        'bg-[#FFFFFF] border border-[#E4E0F5] focus-within:border-[#7C3AED] focus-within:ring-2 focus-within:ring-[#7C3AED]/15',
      underlined: 'bg-transparent border-b border-[#E4E0F5] rounded-none px-0 focus-within:border-[#7C3AED]',
    }[variant];

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-[12px] font-semibold text-[#5A5575]">
            {label}
          </label>
        )}

        <div
          className={`flex items-center transition-all duration-150 ${
            variant !== 'underlined' ? 'rounded-[14px]' : ''
          } ${variantStyles} ${
            isError ? 'border-rose-400 focus-within:border-rose-500 focus-within:ring-rose-500/20' : ''
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {startContent && (
            <div className="pl-3.5 pr-1 text-[#8F8AA8] flex items-center shrink-0">
              {startContent}
            </div>
          )}

          <input
            id={inputId}
            aria-invalid={isError || undefined}
            aria-describedby={activeError || description ? messageId : props['aria-describedby']}
            ref={ref}
            disabled={disabled}
            className={`w-full bg-transparent text-[#130F26] placeholder-[#8F8AA8] focus:outline-none font-medium ${sizeStyles} ${className}`}
            {...props}
          />

          {endContent && (
            <div className="pr-3.5 pl-1 text-[#8F8AA8] flex items-center shrink-0 font-normal">
              {endContent}
            </div>
          )}
        </div>

        {description && !activeError && (
          <p id={messageId} className="text-[12px] text-[#5A5575] leading-tight">{description}</p>
        )}

        {activeError && (
          <p id={messageId} className="text-xs text-rose-600 font-medium flex items-center gap-1">
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
      flat: 'bg-[#F8F7FC] border border-[#ECEAF6] focus:border-[#7C3AED] focus:bg-[#FFFFFF]',
      bordered:
        'bg-[#FFFFFF] border border-[#E4E0F5] focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/15',
    }[variant];

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-[12px] font-semibold text-[#5A5575]">
            {label}
          </label>
        )}

        <textarea
          id={inputId}
          aria-invalid={isError || undefined}
          aria-describedby={activeError || description ? messageId : props['aria-describedby']}
          ref={ref}
          disabled={disabled}
          className={`w-full rounded-[14px] p-3.5 text-[14px] text-[#130F26] placeholder-[#8F8AA8] focus:outline-none font-normal transition-all duration-150 resize-none ${variantStyles} ${
            isError ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20' : ''
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
          {...props}
        />

        {description && !activeError && (
          <p id={messageId} className="text-[12px] text-[#5A5575] leading-tight">{description}</p>
        )}

        {activeError && (
          <p id={messageId} className="text-xs text-rose-600 font-medium flex items-center gap-1">
            <span>{activeError}</span>
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
