import React from 'react';
import { Tabs as HeroTabs } from '@heroui/react';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

export interface TabsProps {
  tabs: TabItem[];
  selectedKey: string;
  onSelectionChange: (key: string) => void;
  variant?: 'solid' | 'bordered' | 'light' | 'underlined';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  selectedKey,
  onSelectionChange,
  variant = 'solid',
  size = 'md',
  className = '',
}) => {
  const sizeClass = {
    sm: 'text-[13px] min-h-[38px] py-1.5 px-3',
    md: 'text-[14px] min-h-[44px] py-2 px-4',
    lg: 'text-[14px] min-h-[44px] py-2 px-5',
  }[size];

  return (
    <HeroTabs.Root
      selectedKey={selectedKey}
      onSelectionChange={(key) => onSelectionChange(String(key))}
      variant={variant === 'underlined' ? 'secondary' : 'primary'}
      className={className}
    >
      <HeroTabs.ListContainer className="overflow-x-auto no-scrollbar max-w-full">
        <HeroTabs.List
          aria-label="Navigation Tabs"
          className="bg-[#FFFFFF] border border-[#ECEAF6] p-1 rounded-[16px] gap-1 shadow-[0_4px_14px_rgba(27,5,82,0.04)]"
        >
          {tabs.map((tab) => {
            const isSelected = selectedKey === tab.id;
            return (
              <HeroTabs.Tab
                key={tab.id}
                id={tab.id}
                className={`flex items-center gap-2 whitespace-nowrap rounded-[12px] font-semibold cursor-pointer transition-colors ${sizeClass} ${
                  isSelected ? 'text-[#FFFFFF]' : 'text-[#5A5575] hover:text-[#130F26]'
                }`}
              >
                {tab.icon && <span className="shrink-0 relative z-10">{tab.icon}</span>}
                <span className="relative z-10">{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`relative z-10 text-[11px] px-1.5 py-0.5 rounded-[6px] font-mono ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-[#F1EFFA] text-[#6D28D9]'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
                <HeroTabs.Indicator className="bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] rounded-[12px] shadow-none" />
              </HeroTabs.Tab>
            );
          })}
        </HeroTabs.List>
      </HeroTabs.ListContainer>
    </HeroTabs.Root>
  );
};
