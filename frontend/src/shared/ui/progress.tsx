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
        <div className="flex items-center justify-between text-xs mb-1">
          {label && <span className="font-semibold text-zinc-300">{label}</span>}
          {showValueLabel && <HeroProgressBar.Output className="font-mono font-bold text-zinc-200" />}
        </div>
      )}
      <HeroProgressBar.Track className="bg-dark-800 border border-dark-700/80">
        <HeroProgressBar.Fill />
      </HeroProgressBar.Track>
    </HeroProgressBar.Root>
  );
};
