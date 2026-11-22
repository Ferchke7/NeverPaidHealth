import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '../../../shared/lib/theme/themeStore.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

interface ThemeToggleProps {
  variant?: 'icon' | 'pill' | 'segmented';
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = 'icon',
  className = '',
}) => {
  const { theme, setTheme, toggleTheme } = useThemeStore();
  const { language } = useTranslation();

  const lightLabel =
    language === 'ru' ? 'Светлая' : language === 'uz' ? 'Yorugʻ' : 'Light';
  const darkLabel =
    language === 'ru' ? 'Тёмная' : language === 'uz' ? 'Qorongʻi' : 'Dark';

  if (variant === 'segmented') {
    return (
      <div
        className={`grid grid-cols-2 gap-1.5 p-1 rounded-[14px] bg-[var(--bg-well)] border border-[var(--border-subtle)] ${className}`}
        role="group"
        aria-label={language === 'ru' ? 'Тема' : language === 'uz' ? 'Mavzu' : 'Theme'}
      >
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`min-h-[40px] px-3 rounded-[10px] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            theme === 'light'
              ? 'bg-[var(--bg-surface)] text-[#6D28D9] border border-[var(--border-strong)] shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Sun className="w-3.5 h-3.5" />
          <span>{lightLabel}</span>
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`min-h-[40px] px-3 rounded-[10px] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            theme === 'dark'
              ? 'bg-[#6D28D9] text-white border border-transparent shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Moon className="w-3.5 h-3.5" />
          <span>{darkLabel}</span>
        </button>
      </div>
    );
  }

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? lightLabel : darkLabel}
        className={`h-[38px] px-3 rounded-[12px] bg-[var(--bg-well)] hover:bg-[var(--bg-lilac)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[#6D28D9] dark:hover:text-[#A78BFA] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${className}`}
      >
        {theme === 'dark' ? (
          <>
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span>{lightLabel}</span>
          </>
        ) : (
          <>
            <Moon className="w-3.5 h-3.5 text-[#6D28D9]" />
            <span>{darkLabel}</span>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={theme === 'dark' ? lightLabel : darkLabel}
      aria-label={theme === 'dark' ? lightLabel : darkLabel}
      className={`h-[38px] w-[38px] rounded-[12px] flex items-center justify-center transition-colors cursor-pointer ${className}`}
    >
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
};
