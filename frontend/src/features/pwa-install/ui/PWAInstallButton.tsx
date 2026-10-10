import React from 'react';
import { Download, Smartphone, Check } from 'lucide-react';
import { usePWAInstall } from '../model/usePWAInstall.ts';
import { PWAInstallModal } from './PWAInstallModal.tsx';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

interface PWAInstallButtonProps {
  variant?: 'button' | 'card' | 'compact';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'button',
  className = '',
}) => {
  const {
    isStandalone,
    isIOS,
    isIOSModalOpen,
    promptInstall,
    closeGuide,
  } = usePWAInstall();

  const { t } = useTranslation();

  if (isStandalone) {
    if (variant === 'card') {
      return (
        <div className={`p-4 rounded-xl bg-dark-800/40 border border-dark-700 flex items-center justify-between ${className}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-200">{t('pwa.installed')}</div>
              <div className="text-xs text-zinc-400">{t('pwa.offlineReady')}</div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  if (variant === 'card') {
    return (
      <>
        <div className={`p-4 rounded-xl bg-dark-800 border border-brand-500/30 flex items-center justify-between gap-4 ${className}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-200">{t('pwa.installApp')}</div>
              <div className="text-xs text-zinc-400">{t('pwa.installDesc')}</div>
            </div>
          </div>
          <button
            onClick={promptInstall}
            className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-black font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>{t('pwa.installBtn')}</span>
          </button>
        </div>

        <PWAInstallModal
          isOpen={isIOSModalOpen}
          onClose={closeGuide}
          isIOS={isIOS}
        />
      </>
    );
  }

  return (
    <>
      <button
        onClick={promptInstall}
        className={`px-3 py-1.5 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all ${className}`}
        title={t('pwa.installApp')}
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{t('pwa.installBtn')}</span>
      </button>

      <PWAInstallModal
        isOpen={isIOSModalOpen}
        onClose={closeGuide}
        isIOS={isIOS}
      />
    </>
  );
};
