import React from 'react';
import { Download } from 'lucide-react';
import { usePWAInstall } from '../model/usePWAInstall.ts';
import { PWAInstallModal } from './PWAInstallModal.tsx';
import { Button } from '../../../shared/ui/button.tsx';
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
      <div className="mb-5 bg-white border border-[#ECEAF6] royal-card-shadow rounded-[18px] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-[12px] bg-[#F0EFFE] border border-[#DDD6FE] p-1.5 flex items-center justify-center shrink-0">
            <img src="/icons/icon.svg" alt="duda.uz" className="w-full h-full" />
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-bold text-[#1E1B4B]">
              {t('pwa.installTitle')}
            </div>
            <p className="text-[12px] text-[#6B7280] mt-0.5 max-w-xl line-clamp-2 sm:line-clamp-none">
              {t('pwa.installDesc')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
          <Button variant="outline" size="sm" onClick={dismiss}>
            {t('pwa.dismiss')}
          </Button>
          <Button variant="primary" size="sm" onClick={promptInstall}>
            <Download className="w-3.5 h-3.5" />
            <span>{t('pwa.installBtn')}</span>
          </Button>
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
