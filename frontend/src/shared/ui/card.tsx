import React from 'react';
import {
  Card as HeroCard,
  Chip as HeroChip,
} from '@heroui/react';
import { X } from 'lucide-react';

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
  const heroVariantMap: Record<
    NonNullable<CardProps['variant']>,
    'default' | 'secondary' | 'tertiary' | 'transparent'
  > = {
    default: 'default',
    flat: 'secondary',
    bordered: 'transparent',
    glow: 'default',
  };

  const surfaceStyles: Record<NonNullable<CardProps['variant']>, string> = {
    default: 'bg-[#FFFFFF] border border-[#ECEAF6] rounded-[22px] shadow-[0_10px_28px_rgba(27,5,82,0.06)]',
    flat: 'bg-[#F8F7FC] border border-[#ECEAF6] rounded-[20px] shadow-none',
    bordered: 'bg-[#FFFFFF] border border-[#E4E0F5] rounded-[20px] shadow-none',
    glow: 'bg-[#FFFFFF] border border-[#C4B5FD] rounded-[22px] shadow-[0_12px_30px_rgba(124,58,237,0.12)]',
  };

  const extraStyles = [
    surfaceStyles[variant],
    isHoverable ? 'hover:border-[#C4B5FD] hover:shadow-[0_14px_32px_rgba(27,5,82,0.09)] transition-all cursor-pointer' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <HeroCard.Root variant={heroVariantMap[variant]} className={extraStyles} {...props}>
      {children}
    </HeroCard.Root>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <HeroCard.Header
    className={`flex-row items-center justify-between pb-3 border-b border-[#ECEAF6] gap-2 ${className}`}
    {...props}
  >
    {children}
  </HeroCard.Header>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <HeroCard.Title className={`font-bold text-[#130F26] flex items-center gap-2 ${className}`} {...props}>
    {children}
  </HeroCard.Title>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <HeroCard.Description className={`text-[13px] text-[#5A5575] mt-0.5 ${className}`} {...props}>
    {children}
  </HeroCard.Description>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <HeroCard.Content className={`py-2 ${className}`} {...props}>
    {children}
  </HeroCard.Content>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <HeroCard.Footer
    className={`justify-between pt-3 border-t border-[#ECEAF6] gap-2 ${className}`}
    {...props}
  >
    {children}
  </HeroCard.Footer>
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
  const colorMap: Record<
    NonNullable<BadgeProps['variant']>,
    'accent' | 'default' | 'warning' | 'danger' | 'success'
  > = {
    brand: 'accent',
    neutral: 'default',
    accent: 'accent',
    warning: 'warning',
    danger: 'danger',
    success: 'success',
    info: 'accent',
  };

  const badgeStyles: Record<NonNullable<BadgeProps['variant']>, string> = {
    brand: 'bg-[#EDE9FE] text-[#6D28D9] border border-[#DDD6FE]',
    neutral: 'bg-[#F4F3FA] text-[#5A5575] border border-[#ECEAF6]',
    accent: 'bg-[#EDE9FE] text-[#7C3AED] border border-[#DDD6FE]',
    warning: 'bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]',
    danger: 'bg-[#FFF1F2] text-[#E11D48] border border-[#FECDD3]',
    success: 'bg-[#DCFCE7] text-[#15803D] border border-[#A7F3D0]',
    info: 'bg-[#E0F2FE] text-[#0284C7] border border-[#BAE6FD]',
  };

  return (
    <HeroChip.Root
      {...props}
      variant="soft"
      color={colorMap[variant]}
      size={size}
      className={`font-semibold whitespace-nowrap rounded-[10px] ${badgeStyles[variant]} ${className}`}
    >
      <HeroChip.Label>{children}</HeroChip.Label>
    </HeroChip.Root>
  );
};

export interface ChipProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'> {
  variant?: 'solid' | 'bordered' | 'flat' | 'dot';
  color?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  onClose?: () => void;
}

export const Chip: React.FC<ChipProps> = ({
  className = '',
  variant = 'flat',
  color = 'primary',
  size = 'sm',
  onClose,
  children,
  ...props
}) => {
  const heroColorMap: Record<
    NonNullable<ChipProps['color']>,
    'default' | 'accent' | 'success' | 'warning' | 'danger'
  > = {
    default: 'default',
    primary: 'accent',
    success: 'success',
    warning: 'warning',
    danger: 'danger',
    secondary: 'accent',
  };

  const heroVariantMap: Record<
    NonNullable<ChipProps['variant']>,
    'primary' | 'secondary' | 'soft' | 'tertiary'
  > = {
    solid: 'primary',
    bordered: 'tertiary',
    flat: 'soft',
    dot: 'secondary',
  };

  const chipColorClass =
    color === 'primary' || color === 'secondary'
      ? variant === 'solid'
        ? 'bg-[#7C3AED] text-white border border-transparent'
        : 'bg-[#EDE9FE] text-[#6D28D9] border border-[#DDD6FE]'
      : color === 'success'
        ? variant === 'solid'
          ? 'bg-[#10B981] text-white border border-transparent'
          : 'bg-[#DCFCE7] text-[#15803D] border border-[#A7F3D0]'
        : color === 'danger'
          ? 'bg-[#FFF1F2] text-[#E11D48] border border-[#FECDD3]'
          : color === 'warning'
            ? 'bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]'
            : 'bg-[#F4F3FA] text-[#5A5575] border border-[#ECEAF6]';

  return (
    <HeroChip.Root
      {...props}
      variant={heroVariantMap[variant]}
      color={heroColorMap[color]}
      size={size}
      className={`gap-1 rounded-[10px] font-semibold ${chipColorClass} ${className}`}
    >
      <HeroChip.Label>{children}</HeroChip.Label>
      {onClose && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="ml-1 hover:opacity-75 transition-opacity cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </HeroChip.Root>
  );
};
