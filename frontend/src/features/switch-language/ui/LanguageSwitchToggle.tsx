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
              className={`min-h-[44px] p-3 rounded-[14px] border flex flex-col items-center justify-center gap-1 transition-all text-xs font-semibold cursor-pointer ${
                isSelected
                  ? 'bg-[#EDE9FE] border-[#7C3AED] text-[#6D28D9]'
                  : 'bg-[#FFFFFF] border-[#E4E0F5] text-[#5A5575] hover:text-[#130F26] hover:bg-[#F8F7FC]'
              }`}
            >
              <span className="text-lg">{l.flag}</span>
              <span>{l.nativeName}</span>
              <span className="text-[10px] text-[#8F8AA8] font-mono font-normal">({l.code.toUpperCase()})</span>
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
        className="flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-[12px] bg-[#FFFFFF] border border-[#E4E0F5] hover:border-[#C4B5FD] text-xs font-semibold text-[#5A5575] hover:text-[#130F26] transition-colors cursor-pointer"
        title="Change Language"
      >
        <Globe className="w-3.5 h-3.5 text-[#7C3AED]" />
        <span className="font-bold uppercase text-[11px]">{currentOption.code}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-[16px] bg-[#FFFFFF] border border-[#ECEAF6] shadow-[0_14px_34px_rgba(27,5,82,0.12)] z-50 py-1 overflow-hidden">
          <div className="px-3 py-2 text-[10px] font-bold text-[#8F8AA8] uppercase tracking-wider border-b border-[#ECEAF6] flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-[#7C3AED]" />
            <span>Language</span>
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
                    ? 'bg-[#F4F1FE] text-[#6D28D9] font-bold'
                    : 'text-[#5A5575] hover:bg-[#F8F7FC] hover:text-[#130F26]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{l.flag}</span>
                  <div className="text-left">
                    <p className="leading-tight">{l.nativeName}</p>
                    <p className="text-[10px] text-[#8F8AA8] font-normal">{l.name}</p>
                  </div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-[#7C3AED]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
