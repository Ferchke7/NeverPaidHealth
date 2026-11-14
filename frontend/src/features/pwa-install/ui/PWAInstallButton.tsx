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
        <div className={`p-4 rounded-[14px] bg-[#171717] border border-[#404040] flex items-center justify-between ${className}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-[#022c22] border border-[#064e3b] text-[#34d399] flex items-center justify-center">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#fafafa]">{t('pwa.installed')}</div>
              <div className="text-xs text-[#a3a3a3]">{t('pwa.offlineReady')}</div>
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
        <div className={`p-4 rounded-[14px] bg-[#171717] border border-[#404040] flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 ${className}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-[10px] bg-[#022c22] border border-[#064e3b] text-[#34d399] flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#fafafa]">{t('pwa.installApp')}</div>
              <div className="text-xs text-[#a3a3a3]">{t('pwa.installDesc')}</div>
            </div>
          </div>
          <button
            onClick={promptInstall}
            className="min-h-[44px] w-full sm:w-auto justify-center px-4 py-2 rounded-[10px] bg-[#34d399] hover:bg-[#34d399]/90 text-[#0a0a0a] font-semibold text-xs flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
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
        className={`min-h-[44px] px-3 py-2 rounded-[10px] bg-[#022c22] hover:bg-[#022c22]/80 text-[#34d399] border border-[#064e3b] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${className}`}
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
