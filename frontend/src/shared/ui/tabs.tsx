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
    sm: 'text-xs py-1 px-2.5',
    md: 'text-xs py-1.5 px-3.5',
    lg: 'text-sm py-2 px-4',
  }[size];

  return (
    <HeroTabs.Root
      selectedKey={selectedKey}
      onSelectionChange={(key) => onSelectionChange(String(key))}
      variant={variant === 'underlined' ? 'secondary' : 'primary'}
      className={className}
    >
      <HeroTabs.ListContainer className="overflow-x-auto no-scrollbar max-w-full">
        <HeroTabs.List aria-label="Navigation Tabs" className="bg-dark-900 border border-dark-700/80 p-1 rounded-2xl">
          {tabs.map((tab) => {
            const isSelected = selectedKey === tab.id;
            return (
              <HeroTabs.Tab
                key={tab.id}
                id={tab.id}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl font-semibold cursor-pointer ${sizeClass} ${
                  isSelected ? 'text-dark-950 font-bold' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tab.icon && <span className="shrink-0 relative z-10">{tab.icon}</span>}
                <span className="relative z-10">{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`relative z-10 text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected ? 'bg-dark-950/20 text-dark-950' : 'bg-dark-700 text-zinc-300'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
                <HeroTabs.Indicator className="bg-brand-500 rounded-xl shadow-sm" />
              </HeroTabs.Tab>
            );
          })}
        </HeroTabs.List>
      </HeroTabs.ListContainer>
    </HeroTabs.Root>
  );
};
