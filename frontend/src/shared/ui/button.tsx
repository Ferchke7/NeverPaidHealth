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

    const extraClasses = [
      size === 'xs' ? (isIconOnly ? 'w-7 h-7 min-w-7 p-0 text-xs' : 'h-7 px-2.5 text-[11px] gap-1') : '',
      variant === 'success' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : '',
      variant === 'flat' ? 'bg-brand-500/15 text-brand-400 border border-brand-500/25' : '',
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
        onPress={(e) => {
          if (onClick) {
            onClick(e as unknown as React.MouseEvent<HTMLButtonElement>);
          }
        }}
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
      className={`${attached ? '' : 'gap-1.5'} ${className}`}
      {...(props as Record<string, unknown>)}
    >
      {children}
    </HeroButtonGroup>
  );
};
