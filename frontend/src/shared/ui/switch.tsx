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
      className={`flex items-center justify-between gap-3 cursor-pointer ${className}`}
    >
      {(label || description) && (
        <div className="flex flex-col">
          {label && <span className="text-[14px] font-medium text-[#fafafa]">{label}</span>}
          {description && <span className="text-[12px] text-[#a3a3a3]">{description}</span>}
        </div>
      )}
      <HeroSwitch.Control
        className={`transition-colors ${
          isSelected ? 'bg-[#34d399]' : 'bg-[#262626] border border-[#404040]'
        }`}
      >
        <HeroSwitch.Thumb className={isSelected ? 'bg-[#0a0a0a]' : 'bg-[#a3a3a3]'} />
      </HeroSwitch.Control>
    </HeroSwitch.Root>
  );
};
