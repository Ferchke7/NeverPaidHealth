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
        <div className={`p-4 rounded-[18px] bg-white border border-[#ECEAF6] royal-card-shadow flex items-center justify-between ${className}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[12px] bg-[#ECFDF5] border border-[#A7F3D0] text-[#059669] flex items-center justify-center">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#1E1B4B]">{t('pwa.installed')}</div>
              <div className="text-xs text-[#6B7280]">{t('pwa.offlineReady')}</div>
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
        <div className={`p-4 rounded-[18px] bg-white border border-[#ECEAF6] royal-card-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 ${className}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-[12px] bg-[#F0EFFE] border border-[#DDD6FE] text-[#6D28D9] flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-[#1E1B4B]">{t('pwa.installApp')}</div>
              <div className="text-xs text-[#6B7280]">{t('pwa.installDesc')}</div>
            </div>
          </div>
          <button
            onClick={promptInstall}
            className="min-h-[44px] w-full sm:w-auto justify-center px-4 py-2 rounded-[12px] violet-btn-gradient hover:opacity-95 text-white font-semibold text-xs flex items-center gap-1.5 shrink-0 transition-opacity cursor-pointer shadow-sm"
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
        className={`min-h-[44px] px-3 py-2 rounded-[12px] bg-[#F0EFFE] hover:bg-[#DDD6FE] text-[#6D28D9] border border-[#DDD6FE] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${className}`}
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
