import React from 'react';
import { Modal as HeroModal } from '@heroui/react';
import { X } from 'lucide-react';
import { Button } from './button.tsx';
import { useTranslation } from '../lib/i18n/i18n.ts';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  headerIcon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  hideCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  description,
  icon,
  headerIcon,
  size = 'md',
  children,
  footer,
  className = '',
  hideCloseButton = false,
}) => {
  const { t } = useTranslation();
  const effectiveSubtitle = subtitle || description;
  const effectiveIcon = icon || headerIcon;

  const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
    full: 'max-w-4xl',
  }[size];

  return (
    <HeroModal.Root
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <HeroModal.Backdrop className="fixed inset-0 bg-[#0a0a0a]/85 z-50 animate-in fade-in duration-150">
        <HeroModal.Container className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <HeroModal.Dialog
            className={`relative w-full ${sizeStyles} bg-[#171717] border border-[#404040] rounded-t-[14px] sm:rounded-[14px] shadow-none flex flex-col max-h-[90dvh] sm:max-h-[85dvh] pb-[env(safe-area-inset-bottom)] sm:pb-0 overflow-hidden ${className}`}
          >
            {(title || effectiveIcon) && (
              <HeroModal.Header className="px-5 sm:px-6 py-4 border-b border-[#262626] flex items-center justify-between gap-3 shrink-0 bg-[#171717]">
                <div className="flex items-center gap-3 min-w-0">
                  {effectiveIcon && <div className="shrink-0">{effectiveIcon}</div>}
                  <div className="min-w-0">
                    {title && (
                      <HeroModal.Heading className="text-base sm:text-lg font-semibold text-[#fafafa] tracking-tight truncate">
                        {title}
                      </HeroModal.Heading>
                    )}
                    {effectiveSubtitle && (
                      <p className="text-[13px] text-[#a3a3a3] mt-0.5 truncate">{effectiveSubtitle}</p>
                    )}
                  </div>
                </div>
                {!hideCloseButton && (
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    onClick={onClose}
                    className="text-[#a3a3a3] hover:text-[#fafafa] shrink-0"
                    aria-label={t('common.close')}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </HeroModal.Header>
            )}

            <HeroModal.Body className="flex-1 overflow-y-auto p-5 sm:p-6 overscroll-contain">
              {children}
            </HeroModal.Body>

            {footer && (
              <HeroModal.Footer className="px-5 sm:px-6 py-4 bg-[#171717] border-t border-[#262626] flex items-center justify-end gap-2.5 shrink-0">
                {footer}
              </HeroModal.Footer>
            )}
          </HeroModal.Dialog>
        </HeroModal.Container>
      </HeroModal.Backdrop>
    </HeroModal.Root>
  );
};

export default Modal;
