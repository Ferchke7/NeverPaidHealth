import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
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

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const isCompact = size === 'sm';

  const sizeStyles = {
    sm: 'max-w-[380px]',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
    full: 'max-w-4xl',
  }[size];

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex ${
        isCompact
          ? 'items-center justify-center p-4'
          : 'items-end sm:items-center justify-center p-0 sm:p-4'
      }`}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#090812]/55 dark:bg-black/70 backdrop-blur-[3px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog Surface */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative z-10 w-full mx-auto ${sizeStyles} bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] ${
          isCompact
            ? 'rounded-[24px]'
            : 'rounded-t-[26px] sm:rounded-[24px]'
        } shadow-[0_24px_64px_rgba(10,6,28,0.28)] dark:shadow-[0_24px_64px_rgba(0,0,0,0.65)] flex flex-col max-h-[90dvh] sm:max-h-[85dvh] overflow-hidden ${className}`}
      >
        {/* Drag Indicator for non-compact mobile bottom sheets */}
        {!isCompact && (
          <div className="sm:hidden flex justify-center pt-2.5 pb-0.5 shrink-0">
            <span className="w-9 h-1 rounded-full bg-[var(--border-strong)]" />
          </div>
        )}

        {(title || effectiveIcon || !hideCloseButton) && (
          <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3 shrink-0 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {effectiveIcon && <div className="shrink-0">{effectiveIcon}</div>}
              <div className="min-w-0 flex-1">
                {title && (
                  <h2 className="text-[17px] font-bold text-[var(--text-primary)] tracking-tight leading-snug">
                    {title}
                  </h2>
                )}
                {effectiveSubtitle && (
                  <p className="text-[12.5px] text-[var(--text-secondary)] mt-0.5 line-clamp-2">
                    {effectiveSubtitle}
                  </p>
                )}
              </div>
            </div>
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label={t('common.close')}
                className="w-8 h-8 rounded-full bg-[var(--bg-well)] hover:bg-[var(--bg-lilac)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center shrink-0 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4 overscroll-contain text-[var(--text-primary)]">
          {children}
        </div>

        {footer && (
          <div
            className={`px-5 pb-5 pt-2 shrink-0 flex items-center gap-2.5 [&>*]:flex-1 sm:[&>*]:flex-initial sm:justify-end ${
              !isCompact ? 'pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-5' : ''
            }`}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
