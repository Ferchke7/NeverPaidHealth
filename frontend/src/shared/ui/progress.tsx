import React from 'react';

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 100
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
  ...props
}) => {
  const percentage = Math.min(100, Math.max(0, ((value - minValue) / (maxValue - minValue)) * 100));

  const heightStyles = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  }[size];

  const activeColor = variant || color || 'primary';

  const colorStyles = {
    primary: 'bg-brand-500',
    brand: 'bg-brand-500',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-red-500',
    gradient: 'bg-gradient-to-r from-brand-500 via-emerald-400 to-teal-300',
  }[activeColor];

  return (
    <div className={`w-full space-y-1.5 ${className}`} {...props}>
      {(label || showValueLabel) && (
        <div className="flex items-center justify-between text-xs">
          {label && <span className="font-semibold text-zinc-300">{label}</span>}
          {showValueLabel && (
            <span className="font-mono font-bold text-zinc-200">{Math.round(percentage)}%</span>
          )}
        </div>
      )}

      <div className={`w-full bg-dark-800 rounded-full overflow-hidden p-0.5 border border-dark-700/80 ${heightStyles}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out shadow-sm ${colorStyles}`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={minValue}
          aria-valuemax={maxValue}
        />
      </div>
    </div>
  );
};
