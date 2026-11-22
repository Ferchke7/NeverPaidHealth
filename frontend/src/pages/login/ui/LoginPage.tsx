import React from 'react';
import { Dumbbell } from 'lucide-react';
import { GoogleSignInButton } from '../../../features/auth-google/ui/AuthButtons.tsx';
import { ThemeToggle } from '../../../features/switch-theme/ui/ThemeToggle.tsx';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { SupportedLanguage } from '../../../shared/lib/i18n/types.ts';
import { usePageSEO } from '../../../shared/lib/seo/usePageSEO.ts';

export const LoginPage: React.FC = () => {
  usePageSEO({ pageKey: 'login', canonicalPath: '/login' });
  const { t, language, setLanguage, languages } = useTranslation();

  return (
    <div className="min-h-[100dvh] w-full bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col">
      {/* Top Bar */}
      <header className="w-full max-w-[1280px] mx-auto px-5 sm:px-10 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[14px] violet-btn-gradient flex items-center justify-center text-white shadow-[0_8px_18px_rgba(109,40,217,0.24)]">
            <Dumbbell className="w-5 h-5" />
          </div>
          <span className="text-[20px] font-bold tracking-tight text-[var(--text-primary)] block leading-none">
            duda.uz
          </span>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[#6D28D9]" />
          <div
            className="flex items-center gap-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-1 rounded-[14px] shadow-[0_4px_14px_rgba(27,5,82,0.04)]"
            role="group"
            aria-label={t('profile.languagePreference')}
          >
            {languages.map((lang) => {
              const isActive = language === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setLanguage(lang.code as SupportedLanguage)}
                  className={`min-h-[38px] min-w-[44px] px-3 rounded-[10px] text-[12px] font-bold uppercase transition-all cursor-pointer ${
                    isActive
                      ? 'violet-btn-gradient text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-well)]'
                  }`}
                >
                  {lang.code.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Centered Royal Violet Auth Card */}
      <main className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-[440px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[28px] shadow-[0_18px_46px_rgba(27,5,82,0.10)] overflow-hidden">
          <div className="royal-hero-gradient p-6 sm:p-8 text-white space-y-2">
            <h1 className="text-[24px] sm:text-[26px] font-bold leading-[1.2] tracking-tight text-white">
              {t('auth.headline')}
            </h1>
            <p className="text-[14px] text-[#DDD6FE]">{t('auth.signInSubtitle')}</p>
          </div>

          <div className="p-6 sm:p-8 space-y-4">
            <GoogleSignInButton />
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
