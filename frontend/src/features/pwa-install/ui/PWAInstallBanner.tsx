import React from 'react';
import { Download, Sparkles } from 'lucide-react';
import { usePWAInstall } from '../model/usePWAInstall.ts';
import { PWAInstallModal } from './PWAInstallModal.tsx';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

export const PWAInstallBanner: React.FC = () => {
  const {
    isStandalone,
    isDismissed,
    isIOS,
    isIOSModalOpen,
    promptInstall,
    dismiss,
    closeGuide,
  } = usePWAInstall();

  const { t } = useTranslation();

  // If already running as installed app or dismissed, don't show the floating banner
  if (isStandalone || isDismissed) {
    return (
      <PWAInstallModal
        isOpen={isIOSModalOpen}
        onClose={closeGuide}
        isIOS={isIOS}
      />
    );
  }

  return (
    <>
      <div className="mb-4 bg-gradient-to-r from-brand-950/60 via-dark-800 to-emerald-950/40 border border-brand-500/30 rounded-2xl p-3.5 sm:p-4 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-dark-900 border border-brand-500/40 p-1.5 flex items-center justify-center shrink-0 shadow-md">
            <img src="/icons/icon.svg" alt="duda.uz" className="w-full h-full" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-zinc-100 flex items-center gap-1">
                {t('pwa.installTitle')}
                <Sparkles className="w-3.5 h-3.5 text-brand-400" />
              </span>
            </div>
            <p className="text-xs text-zinc-300 mt-0.5 max-w-xl line-clamp-1 sm:line-clamp-none">
              {t('pwa.installDesc')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={dismiss}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-dark-700/50 rounded-lg transition-colors"
          >
            {t('pwa.dismiss')}
          </button>
          <button
            onClick={promptInstall}
            className="flex-1 sm:flex-none px-4 py-1.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-black font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-brand-500/20 transition-all active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('pwa.installBtn')}</span>
          </button>
        </div>
      </div>

      <PWAInstallModal
        isOpen={isIOSModalOpen}
        onClose={closeGuide}
        isIOS={isIOS}
      />
    </>
  );
};
