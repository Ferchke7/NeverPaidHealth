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
        <div className="w-10 h-10 rounded-[12px] bg-[#F0EFFE] border border-[#DDD6FE] p-1.5 flex items-center justify-center">
          <img src="/icons/icon.svg" alt="duda.uz" className="w-full h-full" />
        </div>
      }
      title={t('pwa.installTitle')}
      subtitle={t('pwa.installDesc')}
      footer={
        <Button
          variant="primary"
          className="w-full font-semibold"
          onClick={onClose}
        >
          {t('common.done')}
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Step by step for iOS */}
        {isIOS ? (
          <div className="space-y-3 bg-[#F8F7FC] p-4 rounded-[14px] border border-[#ECEAF6]">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-[10px] bg-[#F0EFFE] text-[#6D28D9] flex items-center justify-center shrink-0 mt-0.5 border border-[#DDD6FE]">
                <Share className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <div className="font-semibold text-[#1E1B4B]">{t('pwa.iosStep1')}</div>
                <div className="text-[#6B7280] mt-0.5">{t('pwa.iosStep1Desc')}</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-[10px] bg-[#F0EFFE] text-[#6D28D9] flex items-center justify-center shrink-0 mt-0.5 border border-[#DDD6FE]">
                <PlusSquare className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <div className="font-semibold text-[#1E1B4B]">{t('pwa.iosStep2')}</div>
                <div className="text-[#6B7280] mt-0.5">{t('pwa.iosStep2Desc')}</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-[10px] bg-[#ECFDF5] text-[#059669] flex items-center justify-center shrink-0 mt-0.5 border border-[#A7F3D0]">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <div className="font-semibold text-[#1E1B4B]">{t('pwa.iosStep3')}</div>
                <div className="text-[#6B7280] mt-0.5">{t('pwa.iosStep3Desc')}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#F8F7FC] p-4 rounded-[14px] border border-[#ECEAF6] text-xs text-[#6B7280]">
            <div className="flex items-center gap-2 mb-2 text-[#6D28D9] font-semibold">
              <Smartphone className="w-4 h-4" />
              <span>Android / Chrome</span>
            </div>
            <p className="text-[#6B7280]">{t('pwa.androidPrompt')}</p>
          </div>
        )}

        {/* Benefits */}
        <div className="grid grid-cols-2 gap-2 text-[11px] text-[#4B5563]">
          <div className="bg-[#F8F7FC] p-2.5 rounded-[10px] flex items-center gap-1.5 border border-[#ECEAF6]">
            <span className="text-[#10B981] font-bold">✓</span> {t('pwa.featureNoAddressBar')}
          </div>
          <div className="bg-[#F8F7FC] p-2.5 rounded-[10px] flex items-center gap-1.5 border border-[#ECEAF6]">
            <span className="text-[#10B981] font-bold">✓</span> {t('pwa.featureOffline')}
          </div>
          <div className="bg-[#F8F7FC] p-2.5 rounded-[10px] flex items-center gap-1.5 border border-[#ECEAF6]">
            <span className="text-[#10B981] font-bold">✓</span> {t('pwa.featureInstant')}
          </div>
          <div className="bg-[#F8F7FC] p-2.5 rounded-[10px] flex items-center gap-1.5 border border-[#ECEAF6]">
            <span className="text-[#10B981] font-bold">✓</span> {t('pwa.featureFullscreen')}
          </div>
        </div>
      </div>
    </Modal>
  );
};
