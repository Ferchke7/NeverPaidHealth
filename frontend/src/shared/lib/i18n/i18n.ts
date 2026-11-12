import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SupportedLanguage, SUPPORTED_LANGUAGES } from './types.ts';
import { en } from './translations/en.ts';
import { ru } from './translations/ru.ts';
import { uz } from './translations/uz.ts';

const translations: Record<SupportedLanguage, Record<string, string>> = {
  en,
  ru,
  uz,
};

interface I18nState {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set, get) => ({
      language: (() => {
        if (typeof window !== 'undefined') {
          try {
            const urlParams = new URLSearchParams(window.location.search);
            const urlLang = urlParams.get('lang');
            if (urlLang === 'en' || urlLang === 'ru' || urlLang === 'uz') {
              localStorage.setItem('np_app_lang', urlLang);
              if (typeof document !== 'undefined') document.documentElement.lang = urlLang;
              return urlLang;
            }
            const stored = localStorage.getItem('np_app_lang') as SupportedLanguage;
            if (stored === 'en' || stored === 'ru' || stored === 'uz') {
              if (typeof document !== 'undefined') document.documentElement.lang = stored;
              return stored;
            }
            const browserLang = (navigator.language || '').toLowerCase();
            if (browserLang.startsWith('uz')) {
              if (typeof document !== 'undefined') document.documentElement.lang = 'uz';
              return 'uz';
            }
            if (browserLang.startsWith('en')) {
              if (typeof document !== 'undefined') document.documentElement.lang = 'en';
              return 'en';
            }
          } catch {
            // fallback
          }
        }
        return 'ru';
      })(),

      setLanguage: (lang: SupportedLanguage) => {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('np_app_lang', lang);
        }
        if (typeof document !== 'undefined') {
          document.documentElement.lang = lang;
        }
        set({ language: lang });
      },

      t: (key: string, params?: Record<string, string | number>): string => {
        const lang = get().language || 'ru';
        const currentDict = translations[lang] || translations.ru;
        let text = currentDict[key] || translations.en[key] || key;

        if (params) {
          Object.entries(params).forEach(([paramKey, val]) => {
            text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(val));
          });
        }
        return text;
      },
    }),
    {
      name: 'np_language_preference_v1',
    }
  )
);

// Convenience hook
export function useTranslation() {
  const language = useI18nStore((s) => s.language);
  const setLanguage = useI18nStore((s) => s.setLanguage);
  const t = useI18nStore((s) => s.t);

  return { language, setLanguage, t, languages: SUPPORTED_LANGUAGES };
}

// Standalone translation helper for non-hook contexts
export function t(key: string, params?: Record<string, string | number>): string {
  return useI18nStore.getState().t(key, params);
}

