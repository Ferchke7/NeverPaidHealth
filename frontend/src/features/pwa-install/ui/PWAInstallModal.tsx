import React from 'react';
import { Smartphone, Share, PlusSquare, CheckCircle } from 'lucide-react';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { Button } from '../../../shared/ui/button.tsx';
import { Modal } from '../../../shared/ui/modal.tsx';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  isIOS?: boolean;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
  isIOS = true,
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      icon={
        <div className="w-10 h-10 rounded-xl bg-dark-800 border border-brand-500/30 p-1.5 flex items-center justify-center shadow-lg">
          <img src="/icons/icon.svg" alt="duda.uz" className="w-full h-full" />
        </div>
      }
      title={t('pwa.installTitle')}
      subtitle={t('pwa.installDesc')}
      footer={
        <Button
          variant="primary"
          className="w-full font-bold shadow-md shadow-brand-500/20"
          onClick={onClose}
        >
          {t('common.done')}
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Step by step for iOS */}
        {isIOS ? (
          <div className="space-y-3 bg-dark-900/80 p-4 rounded-2xl border border-dark-750">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center shrink-0 mt-0.5 border border-brand-500/20">
                <Share className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <div className="font-bold text-zinc-100">{t('pwa.iosStep1')}</div>
                <div className="text-zinc-400 mt-0.5">{t('pwa.iosStep1Desc')}</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/20">
                <PlusSquare className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <div className="font-bold text-zinc-100">{t('pwa.iosStep2')}</div>
                <div className="text-zinc-400 mt-0.5">{t('pwa.iosStep2Desc')}</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 mt-0.5 border border-blue-500/20">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <div className="font-bold text-zinc-100">{t('pwa.iosStep3')}</div>
                <div className="text-zinc-400 mt-0.5">{t('pwa.iosStep3Desc')}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-dark-900/80 p-4 rounded-2xl border border-dark-750 text-xs text-zinc-300">
            <div className="flex items-center gap-2 mb-2 text-brand-400 font-bold">
              <Smartphone className="w-4 h-4" />
              <span>Android / Chrome</span>
            </div>
            <p className="text-zinc-400">{t('pwa.androidPrompt')}</p>
          </div>
        )}

        {/* Benefits */}
        <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-400">
          <div className="bg-dark-900/60 p-2.5 rounded-xl flex items-center gap-1.5 border border-dark-750">
            <span className="text-emerald-400 font-bold">✓</span> {t('pwa.featureNoAddressBar')}
          </div>
          <div className="bg-dark-900/60 p-2.5 rounded-xl flex items-center gap-1.5 border border-dark-750">
            <span className="text-emerald-400 font-bold">✓</span> {t('pwa.featureOffline')}
          </div>
          <div className="bg-dark-900/60 p-2.5 rounded-xl flex items-center gap-1.5 border border-dark-750">
            <span className="text-emerald-400 font-bold">✓</span> {t('pwa.featureInstant')}
          </div>
          <div className="bg-dark-900/60 p-2.5 rounded-xl flex items-center gap-1.5 border border-dark-750">
            <span className="text-emerald-400 font-bold">✓</span> {t('pwa.featureFullscreen')}
          </div>
        </div>
      </div>
    </Modal>
  );
};
