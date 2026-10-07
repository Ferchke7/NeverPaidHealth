import React from 'react';

export interface SwitchProps {
  isSelected: boolean;
  onValueChange: (selected: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  isSelected,
  onValueChange,
  label,
  description,
  disabled = false,
  size = 'md',
  color = 'primary',
  className = '',
}) => {
  const switchSize = {
    sm: { track: 'w-8 h-4.5', thumb: 'w-3.5 h-3.5 translate-x-3.5' },
    md: { track: 'w-11 h-6', thumb: 'w-5 h-5 translate-x-5' },
    lg: { track: 'w-14 h-7.5', thumb: 'w-6.5 h-6.5 translate-x-6.5' },
  }[size];

  const colorBg = {
    primary: 'bg-brand-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
  }[color];

  return (
    <label
      className={`inline-flex items-center justify-between gap-3 cursor-pointer select-none ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
    >
      {(label || description) && (
        <div className="flex flex-col">
          {label && <span className="text-sm font-semibold text-zinc-200">{label}</span>}
          {description && <span className="text-xs text-zinc-400">{description}</span>}
        </div>
      )}

      <button
        type="button"
        role="switch"
        aria-checked={isSelected}
        disabled={disabled}
        onClick={() => !disabled && onValueChange(!isSelected)}
        className={`relative inline-flex shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
          switchSize.track
        } ${isSelected ? colorBg : 'bg-dark-700 border border-dark-600'}`}
      >
        <span
          className={`pointer-events-none inline-block rounded-full bg-white shadow-md transform transition duration-200 ease-in-out ${
            size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-6.5 h-6.5' : 'w-5 h-5'
          } ${isSelected ? (size === 'sm' ? 'translate-x-3.5' : size === 'lg' ? 'translate-x-6.5' : 'translate-x-5') : 'translate-x-0'}`}
        />
      </button>
    </label>
  );
};
