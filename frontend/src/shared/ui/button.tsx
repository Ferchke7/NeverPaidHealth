import React from 'react';
import {
  Button as HeroButton,
  ButtonGroup as HeroButtonGroup,
  Spinner,
} from '@heroui/react';

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
      onClick,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const heroVariantMap: Record<
      NonNullable<ButtonProps['variant']>,
      'primary' | 'secondary' | 'tertiary' | 'outline' | 'ghost' | 'danger' | 'danger-soft'
    > = {
      primary: 'primary',
      secondary: 'secondary',
      outline: 'outline',
      ghost: 'ghost',
      danger: 'danger-soft',
      success: 'secondary',
      flat: 'tertiary',
    };

    const heroSize = size === 'xs' ? 'sm' : size;

    const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
      primary:
        'bg-[#34d399] hover:bg-[#34d399]/90 active:bg-[#10b981] text-[#0a0a0a] border border-transparent font-medium shadow-none',
      secondary:
        'bg-[#171717] hover:bg-[#262626] text-[#fafafa] border border-[#404040] font-medium shadow-none',
      outline:
        'bg-[#0a0a0a] hover:bg-[#262626] text-[#fafafa] border border-[#404040] font-medium shadow-none',
      ghost:
        'bg-transparent hover:bg-[#262626] text-[#a3a3a3] hover:text-[#fafafa] border border-transparent font-medium shadow-none',
      flat:
        'bg-[#022c22] hover:bg-[#022c22]/85 text-[#34d399] border border-[#022c22] font-medium shadow-none',
      success:
        'bg-[#022c22] hover:bg-[#022c22]/85 text-[#34d399] border border-[#34d399]/30 font-medium shadow-none',
      danger:
        'bg-[#171717] hover:bg-red-950/50 text-red-400 border border-[#404040] hover:border-red-500/40 font-medium shadow-none',
    };

    const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
      xs: isIconOnly ? 'w-8 h-8 min-w-8 p-0 text-xs rounded-[8px]' : 'h-8 min-h-8 px-2.5 text-xs gap-1.5 rounded-[8px]',
      sm: isIconOnly ? 'w-10 h-10 min-w-10 p-0 text-xs rounded-[10px]' : 'h-10 min-h-[40px] px-3.5 text-[13px] gap-1.5 rounded-[10px]',
      md: isIconOnly ? 'w-11 h-11 min-w-11 p-0 text-sm rounded-[10px]' : 'h-11 min-h-[44px] px-4 text-[14px] gap-2 rounded-[10px]',
      lg: isIconOnly ? 'w-12 h-12 min-w-12 p-0 text-base rounded-[10px]' : 'h-12 min-h-[48px] px-5 text-[15px] gap-2 rounded-[10px]',
    };

    const extraClasses = [
      'inline-flex items-center justify-center whitespace-nowrap transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
      variantStyles[variant],
      sizeStyles[size],
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <HeroButton
        ref={ref}
        type={type}
        variant={heroVariantMap[variant]}
        size={heroSize}
        isIconOnly={isIconOnly}
        isDisabled={disabled || isLoading}
        onClick={(event) => onClick?.(event as React.MouseEvent<HTMLButtonElement>)}
        className={extraClasses}
        {...(props as Record<string, unknown>)}
      >
        {isLoading && <Spinner size="sm" color="current" className="mr-1.5 shrink-0" />}
        {children}
      </HeroButton>
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
    <HeroButtonGroup
      className={`${attached ? '' : 'gap-2'} ${className}`}
      {...(props as Record<string, unknown>)}
    >
      {children}
    </HeroButtonGroup>
  );
};
