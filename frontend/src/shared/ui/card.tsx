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
    default: 'bg-[#171717] border border-[#404040] rounded-[14px] shadow-none',
    flat: 'bg-[#171717] border border-[#262626] rounded-[14px] shadow-none',
    bordered: 'bg-[#0a0a0a] border border-[#404040] rounded-[14px] shadow-none',
    glow: 'bg-[#171717] border border-[#34d399]/40 rounded-[14px] shadow-none',
  };

  const extraStyles = [
    surfaceStyles[variant],
    isHoverable ? 'hover:border-[#525252] transition-colors cursor-pointer' : '',
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
    className={`flex-row items-center justify-between pb-3 border-b border-[#262626] gap-2 ${className}`}
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
  <HeroCard.Title className={`font-semibold text-[#fafafa] flex items-center gap-2 ${className}`} {...props}>
    {children}
  </HeroCard.Title>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <HeroCard.Description className={`text-[13px] text-[#a3a3a3] mt-0.5 ${className}`} {...props}>
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
    className={`justify-between pt-3 border-t border-[#262626] gap-2 ${className}`}
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
    accent: 'warning',
    warning: 'warning',
    danger: 'danger',
    success: 'success',
    info: 'accent',
  };

  const badgeStyles: Record<NonNullable<BadgeProps['variant']>, string> = {
    brand: 'bg-[#022c22] text-[#34d399] border border-[#34d399]/20',
    neutral: 'bg-[#262626] text-[#a3a3a3] border border-[#404040]',
    accent: 'bg-[#022c22] text-[#34d399] border border-[#34d399]/20',
    warning: 'bg-[#262626] text-amber-300 border border-[#404040]',
    danger: 'bg-[#262626] text-red-400 border border-[#404040]',
    success: 'bg-[#022c22] text-[#34d399] border border-[#34d399]/20',
    info: 'bg-[#022c22] text-[#34d399] border border-[#34d399]/20',
  };

  return (
    <HeroChip.Root
      {...props}
      variant="soft"
      color={colorMap[variant]}
      size={size}
      className={`font-medium whitespace-nowrap rounded-[8px] ${badgeStyles[variant]} ${className}`}
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
    color === 'primary' || color === 'success' || color === 'secondary'
      ? variant === 'solid'
        ? 'bg-[#34d399] text-[#0a0a0a] border border-transparent'
        : 'bg-[#022c22] text-[#34d399] border border-[#34d399]/20'
      : color === 'danger'
        ? 'bg-[#262626] text-red-400 border border-[#404040]'
        : color === 'warning'
          ? 'bg-[#262626] text-amber-300 border border-[#404040]'
          : 'bg-[#262626] text-[#a3a3a3] border border-[#404040]';

  return (
    <HeroChip.Root
      {...props}
      variant={heroVariantMap[variant]}
      color={heroColorMap[color]}
      size={size}
      className={`gap-1 rounded-[8px] font-medium ${chipColorClass} ${className}`}
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
