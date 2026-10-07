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
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-semibold ${
                isSelected
                  ? 'bg-brand-500/15 border-brand-500/60 text-brand-400 ring-1 ring-brand-500/30'
                  : 'bg-dark-800/80 border-dark-700/80 text-zinc-400 hover:text-zinc-200 hover:bg-dark-700'
              }`}
            >
              <span className="text-lg">{l.flag}</span>
              <span>{l.nativeName}</span>
              <span className="text-[10px] text-zinc-500 font-normal">({l.code.toUpperCase()})</span>
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
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-dark-800 border border-dark-700 hover:border-dark-600 text-xs text-zinc-300 hover:text-white transition-colors"
        title="Change Language"
      >
        <span className="text-sm">{currentOption.flag}</span>
        <span className="font-semibold uppercase text-[11px]">{currentOption.code}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-44 rounded-xl bg-dark-800 border border-dark-700 shadow-2xl z-50 py-1 overflow-hidden">
          <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-dark-700/60 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-brand-400" />
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
                className={`w-full px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                  isSelected
                    ? 'bg-brand-500/20 text-brand-400 font-bold'
                    : 'text-zinc-300 hover:bg-dark-700 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{l.flag}</span>
                  <div className="text-left">
                    <p className="leading-tight">{l.nativeName}</p>
                    <p className="text-[10px] text-zinc-500 font-normal">{l.name}</p>
                  </div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-brand-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
