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
          {label && <span className="text-[14px] font-semibold text-[#130F26]">{label}</span>}
          {description && <span className="text-[12px] text-[#5A5575]">{description}</span>}
        </div>
      )}
      <HeroSwitch.Control
        className={`transition-colors ${
          isSelected ? 'bg-[#7C3AED]' : 'bg-[#E4E0F5] border border-[#D9D4F0]'
        }`}
      >
        <HeroSwitch.Thumb className="bg-[#FFFFFF] shadow-sm" />
      </HeroSwitch.Control>
    </HeroSwitch.Root>
  );
};
