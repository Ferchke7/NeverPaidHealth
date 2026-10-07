import React from 'react';
import { Smartphone, Share, PlusSquare, CheckCircle, X } from 'lucide-react';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-dark-900 border border-dark-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-100 p-1.5 rounded-lg hover:bg-dark-800 transition-colors"
          title={t('common.close')}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with App Icon */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl bg-dark-800 border border-brand-500/30 p-2 flex items-center justify-center shadow-lg">
            <img src="/icons/icon.svg" alt="duda.uz" className="w-full h-full" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-100">{t('pwa.installTitle')}</h3>
            <p className="text-xs text-zinc-400">{t('pwa.installDesc')}</p>
          </div>
        </div>

        {/* Step by step for iOS */}
        {isIOS ? (
          <div className="space-y-3.5 bg-dark-800/60 p-4 rounded-xl border border-dark-700">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center shrink-0 mt-0.5">
                <Share className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <div className="font-semibold text-zinc-200">{t('pwa.iosStep1')}</div>
                <div className="text-zinc-400 mt-0.5">{t('pwa.iosStep1Desc')}</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <PlusSquare className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <div className="font-semibold text-zinc-200">{t('pwa.iosStep2')}</div>
                <div className="text-zinc-400 mt-0.5">{t('pwa.iosStep2Desc')}</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <div className="font-semibold text-zinc-200">{t('pwa.iosStep3')}</div>
                <div className="text-zinc-400 mt-0.5">{t('pwa.iosStep3Desc')}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-dark-800/60 p-4 rounded-xl border border-dark-700 text-xs text-zinc-300">
            <div className="flex items-center gap-2 mb-2 text-brand-400 font-semibold">
              <Smartphone className="w-4 h-4" />
              <span>Android / Chrome</span>
            </div>
            <p className="text-zinc-400">{t('pwa.androidPrompt')}</p>
          </div>
        )}

        {/* Benefits reminder */}
        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-zinc-400">
          <div className="bg-dark-800/40 p-2 rounded-lg flex items-center gap-1.5 border border-dark-750">
            <span className="text-emerald-400 font-bold">✓</span> Без адресной строки
          </div>
          <div className="bg-dark-800/40 p-2 rounded-lg flex items-center gap-1.5 border border-dark-750">
            <span className="text-emerald-400 font-bold">✓</span> Оффлайн-доступ
          </div>
          <div className="bg-dark-800/40 p-2 rounded-lg flex items-center gap-1.5 border border-dark-750">
            <span className="text-emerald-400 font-bold">✓</span> Мгновенный запуск
          </div>
          <div className="bg-dark-800/40 p-2 rounded-lg flex items-center gap-1.5 border border-dark-750">
            <span className="text-emerald-400 font-bold">✓</span> Полный экран (100dvh)
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-black font-bold text-sm transition-all shadow-md shadow-brand-500/20"
        >
          {t('common.done')}
        </button>
      </div>
    </div>
  );
};
