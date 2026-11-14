import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check } from 'lucide-react';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { SupportedLanguage } from '../../../shared/lib/i18n/types.ts';

interface LanguageSwitchToggleProps {
  variant?: 'header' | 'dropdown' | 'inline';
}

export const LanguageSwitchToggle: React.FC<LanguageSwitchToggleProps> = ({ variant = 'header' }) => {
  const { language, setLanguage, languages } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentOption = languages.find((l) => l.code === language) || languages[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (variant === 'inline') {
    return (
      <div className="grid grid-cols-3 gap-2">
        {languages.map((l) => {
          const isSelected = l.code === language;
          return (
            <button
              key={l.code}
              type="button"
              onClick={() => setLanguage(l.code as SupportedLanguage)}
              className={`min-h-[44px] p-3 rounded-[10px] border flex flex-col items-center justify-center gap-1 transition-colors text-xs font-semibold cursor-pointer ${
                isSelected
                  ? 'bg-[#022c22] border-[#064e3b] text-[#34d399]'
                  : 'bg-[#0a0a0a] border-[#404040] text-[#a3a3a3] hover:text-[#fafafa]'
              }`}
            >
              <span className="text-lg">{l.flag}</span>
              <span>{l.nativeName}</span>
              <span className="text-[10px] text-[#737373] font-mono font-normal">({l.code.toUpperCase()})</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-[10px] bg-[#0a0a0a] border border-[#404040] hover:border-[#525252] text-xs font-medium text-[#a3a3a3] hover:text-[#fafafa] transition-colors cursor-pointer"
        title="Change Language"
      >
        <Globe className="w-3.5 h-3.5 text-[#34d399]" />
        <span className="font-semibold uppercase text-[11px]">{currentOption.code}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-[12px] bg-[#171717] border border-[#404040] z-50 py-1 overflow-hidden">
          <div className="px-3 py-2 text-[10px] font-semibold text-[#737373] uppercase tracking-wider border-b border-[#262626] flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-[#34d399]" />
            <span>Select Language</span>
          </div>

          {languages.map((l) => {
            const isSelected = l.code === language;
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  setLanguage(l.code as SupportedLanguage);
                  setIsOpen(false);
                }}
                className={`w-full min-h-[44px] px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#022c22] text-[#34d399] font-semibold'
                    : 'text-[#a3a3a3] hover:bg-[#262626] hover:text-[#fafafa]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{l.flag}</span>
                  <div className="text-left">
                    <p className="leading-tight">{l.nativeName}</p>
                    <p className="text-[10px] text-[#737373] font-normal">{l.name}</p>
                  </div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-[#34d399]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
