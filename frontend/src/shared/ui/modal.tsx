import React, { useEffect } from 'react';
import { X } from 'lucide-react';

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
  const effectiveSubtitle = subtitle || description;
  const effectiveIcon = icon || headerIcon;
  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
    full: 'max-w-4xl',
  }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        className={`relative w-full ${sizeStyles} bg-dark-850 border border-dark-700/80 rounded-t-3xl sm:rounded-2xl shadow-2xl z-10 flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden ${className}`}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        {(title || effectiveIcon) && (
          <div className="px-4 sm:px-6 py-4 border-b border-dark-700/70 flex items-center justify-between gap-3 shrink-0 bg-dark-900/40">
            <div className="flex items-center gap-3 min-w-0">
              {effectiveIcon && <div className="shrink-0">{effectiveIcon}</div>}
              <div className="min-w-0">
                {title && (
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                    {title}
                  </h3>
                )}
                {effectiveSubtitle && (
                  <p className="text-xs text-zinc-400 mt-0.5 truncate">{effectiveSubtitle}</p>
                )}
              </div>
            </div>
            {!hideCloseButton && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-dark-800 transition-colors shrink-0 cursor-pointer"
                title="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 overscroll-contain">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-4 sm:px-6 py-3.5 bg-dark-900/80 border-t border-dark-700/70 flex items-center justify-end gap-2.5 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
