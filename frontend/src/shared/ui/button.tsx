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
        'bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] hover:from-[#7C3AED] hover:to-[#5B21B6] active:scale-[0.99] text-white border border-transparent font-semibold shadow-[0_8px_18px_rgba(109,40,217,0.24)]',
      secondary:
        'bg-[#F4F1FE] hover:bg-[#EDE9FE] text-[#6D28D9] border border-[#DDD6FE] font-semibold shadow-none',
      outline:
        'bg-[#FFFFFF] hover:bg-[#F8F7FC] text-[#130F26] border border-[#E4E0F5] hover:border-[#C4B5FD] font-semibold shadow-none',
      ghost:
        'bg-transparent hover:bg-[#F1EFFA] text-[#5A5575] hover:text-[#130F26] border border-transparent font-semibold shadow-none',
      flat:
        'bg-[#EDE9FE] hover:bg-[#DDD6FE] text-[#6D28D9] border border-[#DDD6FE] font-semibold shadow-none',
      success:
        'bg-[#ECFDF5] hover:bg-[#D1FAE5] text-[#047857] border border-[#A7F3D0] font-semibold shadow-none',
      danger:
        'bg-[#FFF1F2] hover:bg-[#FFE4E6] text-[#E11D48] border border-[#FECDD3] font-semibold shadow-none',
    };

    const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
      xs: isIconOnly ? 'w-8 h-8 min-w-8 p-0 text-xs rounded-[10px]' : 'h-8 min-h-8 px-2.5 text-xs gap-1.5 rounded-[10px]',
      sm: isIconOnly ? 'w-10 h-10 min-w-10 p-0 text-xs rounded-[12px]' : 'h-10 min-h-[40px] px-3.5 text-[13px] gap-1.5 rounded-[12px]',
      md: isIconOnly ? 'w-11 h-11 min-w-11 p-0 text-sm rounded-[14px]' : 'h-11 min-h-[44px] px-4 text-[14px] gap-2 rounded-[14px]',
      lg: isIconOnly ? 'w-12 h-12 min-w-12 p-0 text-base rounded-[16px]' : 'h-12 min-h-[48px] px-5 text-[15px] gap-2 rounded-[16px]',
    };

    const extraClasses = [
      'inline-flex items-center justify-center whitespace-nowrap transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
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
