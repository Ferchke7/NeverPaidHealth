import React from 'react';
import { GoogleSignInButton } from '../../../features/auth-google/ui/AuthButtons.tsx';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { SupportedLanguage } from '../../../shared/lib/i18n/types.ts';
import { usePageSEO } from '../../../shared/lib/seo/usePageSEO.ts';

export const LoginPage: React.FC = () => {
  usePageSEO({ pageKey: 'login', canonicalPath: '/login' });
  const { t, language, setLanguage, languages } = useTranslation();

  return (
    <div className="min-h-[100dvh] w-full bg-[#0a0a0a] text-[#fafafa] flex flex-col">
      {/* Top Bar */}
      <header className="w-full max-w-[1280px] mx-auto px-5 sm:px-10 py-6 flex items-center justify-between">
        <span className="text-[20px] sm:text-[22px] font-bold tracking-tight text-[#fafafa]">
          duda.uz
        </span>

        <div className="flex items-center gap-1" role="group" aria-label={t('profile.languagePreference')}>
          {languages.map((lang) => {
            const isActive = language === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLanguage(lang.code as SupportedLanguage)}
                className={`min-h-[44px] min-w-[44px] px-3 rounded-[8px] text-[13px] font-medium uppercase transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#022c22] text-[#34d399]'
                    : 'text-[#a3a3a3] hover:text-[#fafafa] hover:bg-[#171717]'
                }`}
              >
                {lang.code.toUpperCase()}
              </button>
            );
          })}
        </div>
      </header>

      {/* Centered Obsidian Auth Card */}
      <main className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-[448px] bg-[#171717] border border-[#404040] rounded-[14px] p-6 sm:p-8 space-y-6">
          <div className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#34d399]">
              {t('auth.webBadge')}
            </div>

            <h1 className="text-[24px] sm:text-[26px] font-bold text-[#fafafa] leading-[1.2] tracking-tight">
              {t('auth.headline')}
            </h1>

            <p className="text-[14px] text-[#a3a3a3]">
              {t('auth.signInSubtitle')}
            </p>
          </div>

          <GoogleSignInButton />

          <div className="border-t border-[#262626] pt-5 space-y-4">
            <div className="space-y-0.5">
              <div className="text-[14px] font-semibold text-[#fafafa]">
                {t('auth.featureWorkoutsTitle')}
              </div>
              <div className="text-[13px] text-[#a3a3a3]">
                {t('auth.featureWorkoutsDesc')}
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="text-[14px] font-semibold text-[#fafafa]">
                {t('auth.featureHistoryTitle')}
              </div>
              <div className="text-[13px] text-[#a3a3a3]">
                {t('auth.featureHistoryDesc')}
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="text-[14px] font-semibold text-[#fafafa]">
                {t('auth.featureProgressTitle')}
              </div>
              <div className="text-[13px] text-[#a3a3a3]">
                {t('auth.featureProgressDesc')}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
