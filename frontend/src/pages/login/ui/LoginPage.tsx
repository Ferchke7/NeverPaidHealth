import React from 'react';
import { Dumbbell } from 'lucide-react';
import { GoogleSignInButton } from '../../../features/auth-google/ui/AuthButtons.tsx';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { SupportedLanguage } from '../../../shared/lib/i18n/types.ts';
import { usePageSEO } from '../../../shared/lib/seo/usePageSEO.ts';

export const LoginPage: React.FC = () => {
  usePageSEO({ pageKey: 'login', canonicalPath: '/login' });
  const { t, language, setLanguage, languages } = useTranslation();

  return (
    <div className="min-h-[100dvh] w-full bg-[#F4F3FA] text-[#130F26] flex flex-col">
      {/* Top Royal Bar */}
      <header className="w-full max-w-[1280px] mx-auto px-5 sm:px-10 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[14px] violet-btn-gradient flex items-center justify-center text-white shadow-[0_8px_18px_rgba(109,40,217,0.24)]">
            <Dumbbell className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[20px] font-bold tracking-tight text-[#130F26] block leading-none">
              duda.uz
            </span>
            <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-[#7C3AED]">
              GYM & STRENGTH PRO
            </span>
          </div>
        </div>

        <div
          className="flex items-center gap-1 bg-white border border-[#ECEAF6] p-1 rounded-[14px] shadow-[0_4px_14px_rgba(27,5,82,0.04)]"
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
                    : 'text-[#5A5575] hover:text-[#130F26] hover:bg-[#F8F7FC]'
                }`}
              >
                {lang.code.toUpperCase()}
              </button>
            );
          })}
        </div>
      </header>

      {/* Centered Royal Violet Auth Card */}
      <main className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-[468px] bg-[#FFFFFF] border border-[#ECEAF6] rounded-[28px] shadow-[0_18px_46px_rgba(27,5,82,0.10)] overflow-hidden">
          <div className="royal-hero-gradient p-6 sm:p-8 text-white space-y-2.5">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/15 text-[11px] font-bold uppercase tracking-[0.08em] text-[#EDE9FE]">
              {t('auth.webBadge')}
            </div>
            <h1 className="text-[24px] sm:text-[26px] font-bold leading-[1.2] tracking-tight text-white">
              {t('auth.headline')}
            </h1>
            <p className="text-[14px] text-[#DDD6FE]">{t('auth.signInSubtitle')}</p>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <GoogleSignInButton />

            <div className="border-t border-[#ECEAF6] pt-5 space-y-4">
              <div className="p-3.5 rounded-[16px] bg-[#F8F7FC] border border-[#ECEAF6] space-y-0.5">
                <div className="text-[14px] font-bold text-[#130F26]">
                  {t('auth.featureWorkoutsTitle')}
                </div>
                <div className="text-[13px] text-[#5A5575]">
                  {t('auth.featureWorkoutsDesc')}
                </div>
              </div>

              <div className="p-3.5 rounded-[16px] bg-[#F8F7FC] border border-[#ECEAF6] space-y-0.5">
                <div className="text-[14px] font-bold text-[#130F26]">
                  {t('auth.featureHistoryTitle')}
                </div>
                <div className="text-[13px] text-[#5A5575]">
                  {t('auth.featureHistoryDesc')}
                </div>
              </div>

              <div className="p-3.5 rounded-[16px] bg-[#F8F7FC] border border-[#ECEAF6] space-y-0.5">
                <div className="text-[14px] font-bold text-[#130F26]">
                  {t('auth.featureProgressTitle')}
                </div>
                <div className="text-[13px] text-[#5A5575]">
                  {t('auth.featureProgressDesc')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
