import React from 'react';

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
  const sizeStyles = {
    sm: 'px-2.5 py-1 text-xs gap-1.5',
    md: 'px-3.5 py-2 text-xs gap-2',
    lg: 'px-4.5 py-2.5 text-sm gap-2.5',
  }[size];

  return (
    <div
      className={`flex items-center gap-1.5 overflow-x-auto no-scrollbar ${
        variant === 'bordered'
          ? 'p-1 rounded-2xl bg-dark-900 border border-dark-700'
          : variant === 'solid'
          ? 'p-1 rounded-2xl bg-dark-900/90'
          : ''
      } ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isSelected = selectedKey === tab.id;

        const activeStyles = isSelected
          ? 'bg-brand-500 text-dark-950 font-bold shadow-md shadow-brand-500/20'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-800/80 border border-transparent';

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelectionChange(tab.id)}
            className={`font-semibold rounded-xl transition-all duration-150 flex items-center whitespace-nowrap cursor-pointer select-none ${sizeStyles} ${activeStyles}`}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isSelected ? 'bg-dark-950/20 text-dark-950' : 'bg-dark-700 text-zinc-300'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
