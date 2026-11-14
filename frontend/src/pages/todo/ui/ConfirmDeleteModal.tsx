import React from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from '../../../shared/ui/modal.tsx';
import { Button } from '../../../shared/ui/button.tsx';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title,
  description,
  onClose,
  onConfirm,
  isLoading = false,
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      headerIcon={
        <div className="w-9 h-9 rounded-[10px] bg-red-950/30 border border-red-500/40 flex items-center justify-center text-red-400">
          <Trash2 className="w-4 h-4" />
        </div>
      }
      title={title}
      footer={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="md" onClick={onClose} disabled={isLoading}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" size="md" onClick={onConfirm} isLoading={isLoading}>
            {t('common.delete')}
          </Button>
        </div>
      }
    >
      <p className="text-[13px] text-[#a3a3a3] leading-relaxed">
        {description || t('common.deleteConfirm')}
      </p>
    </Modal>
  );
};
