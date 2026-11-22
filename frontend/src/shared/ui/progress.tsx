import React from 'react';
import { ProgressBar as HeroProgressBar } from '@heroui/react';

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  minValue?: number;
  maxValue?: number;
  label?: string;
  showValueLabel?: boolean;
  color?: 'primary' | 'brand' | 'success' | 'warning' | 'danger' | 'gradient';
  variant?: 'primary' | 'brand' | 'success' | 'warning' | 'danger' | 'gradient';
  size?: 'sm' | 'md' | 'lg';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  minValue = 0,
  maxValue = 100,
  label,
  showValueLabel = false,
  color,
  variant,
  size = 'md',
  className = '',
}) => {
  const activeColor = variant || color || 'primary';
  const heroColorMap: Record<
    NonNullable<ProgressBarProps['color']>,
    'accent' | 'default' | 'success' | 'warning' | 'danger'
  > = {
    primary: 'accent',
    brand: 'accent',
    success: 'success',
    warning: 'warning',
    danger: 'danger',
    gradient: 'accent',
  };

  const fillClass =
    activeColor === 'danger'
      ? 'bg-rose-500'
      : activeColor === 'warning'
        ? 'bg-amber-500'
        : activeColor === 'success'
          ? 'bg-[#10B981]'
          : 'bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9]';

  const trackHeight = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-3',
  }[size];

  return (
    <HeroProgressBar.Root
      value={value}
      minValue={minValue}
      maxValue={maxValue}
      color={heroColorMap[activeColor]}
      size={size}
      aria-label={label || 'Progress'}
      className={`w-full ${className}`}
    >
      {(label || showValueLabel) && (
        <div className="flex items-center justify-between text-xs mb-1.5">
          {label && <span className="font-semibold text-[#5A5575]">{label}</span>}
          {showValueLabel && <HeroProgressBar.Output className="font-mono font-bold text-[#130F26]" />}
        </div>
      )}
      <HeroProgressBar.Track className={`bg-[#F1EFFA] border-0 rounded-full ${trackHeight}`}>
        <HeroProgressBar.Fill className={`${fillClass} rounded-full`} />
      </HeroProgressBar.Track>
    </HeroProgressBar.Root>
  );
};
