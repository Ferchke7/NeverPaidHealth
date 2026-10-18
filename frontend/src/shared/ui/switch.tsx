import React from 'react';
import { Switch as HeroSwitch } from '@heroui/react';

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
  className = '',
}) => {
  return (
    <HeroSwitch.Root
      isSelected={isSelected}
      onChange={onValueChange}
      isDisabled={disabled}
      size={size}
      className={`flex items-center justify-between gap-3 ${className}`}
    >
      {(label || description) && (
        <div className="flex flex-col">
          {label && <span className="text-sm font-semibold text-zinc-200">{label}</span>}
          {description && <span className="text-xs text-zinc-400">{description}</span>}
        </div>
      )}
      <HeroSwitch.Control>
        <HeroSwitch.Thumb />
      </HeroSwitch.Control>
    </HeroSwitch.Root>
  );
};
