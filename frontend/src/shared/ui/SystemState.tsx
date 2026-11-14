import React from 'react';
import { Card } from './card.tsx';
import { Button } from './button.tsx';
import { Skeleton } from './skeleton.tsx';

export interface SystemStateCardProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export const SystemStateCard: React.FC<SystemStateCardProps> = ({
  eyebrow,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  children,
  className = '',
}) => {
  return (
    <Card className={`p-5 sm:p-6 ${className}`}>
      <div className="space-y-3">
        {eyebrow && (
          <div className="text-[12px] font-medium text-[#a3a3a3]">{eyebrow}</div>
        )}
        <div className="text-[18px] font-semibold text-[#fafafa] tracking-tight">
          {title}
        </div>
        {children}
        {description && (
          <p className="text-[13px] text-[#a3a3a3] leading-relaxed">{description}</p>
        )}
        {(actionLabel || secondaryActionLabel) && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {actionLabel && onAction && (
              <Button variant="primary" size="md" onClick={onAction}>
                {actionLabel}
              </Button>
            )}
            {secondaryActionLabel && onSecondaryAction && (
              <Button variant="outline" size="md" onClick={onSecondaryAction}>
                {secondaryActionLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export const LoadingStateCard: React.FC<{
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  className?: string;
}> = ({
  eyebrow,
  title = 'Загружаем данные',
  subtitle = 'Подождите немного...',
  className = '',
}) => (
  <SystemStateCard eyebrow={eyebrow} title={title} description={subtitle} className={className}>
    <div className="space-y-2.5 pt-1">
      <Skeleton className="h-3 w-36 rounded-full" />
      <Skeleton className="h-9 w-full rounded-[10px]" />
      <Skeleton className="h-9 w-full rounded-[10px]" />
    </div>
  </SystemStateCard>
);

export const EmptyStateCard: React.FC<{
  eyebrow?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}> = (props) => <SystemStateCard {...props} />;

export const ErrorStateCard: React.FC<{
  eyebrow?: string;
  title?: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
}> = ({
  eyebrow,
  title = 'Не удалось загрузить данные',
  description = 'Сервер не ответил. Попробуйте повторить запрос.',
  retryLabel = 'Повторить',
  onRetry,
  className = '',
}) => (
  <Card className={`p-5 sm:p-6 ${className}`}>
    <div className="space-y-3">
      {eyebrow && <div className="text-[12px] font-medium text-[#a3a3a3]">{eyebrow}</div>}
      <div className="text-[18px] font-semibold text-[#fafafa] tracking-tight">{title}</div>
      <p className="text-[13px] text-[#a3a3a3] leading-relaxed">{description}</p>
      {onRetry && (
        <div className="pt-1">
          <Button variant="outline" size="md" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  </Card>
);

export const OfflineStateCard: React.FC<{
  eyebrow?: string;
  title?: string;
  draftTitle?: string;
  draftStatus?: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
}> = ({
  eyebrow,
  title = 'Нет подключения',
  draftTitle = 'Черновик на устройстве',
  draftStatus = 'Несинхронизировано',
  description = 'Проверьте сеть и повторите попытку.',
  retryLabel = 'Повторить',
  onRetry,
  className = '',
}) => (
  <Card className={`p-5 sm:p-6 ${className}`}>
    <div className="space-y-3">
      {eyebrow && <div className="text-[12px] font-medium text-[#a3a3a3]">{eyebrow}</div>}
      <div className="text-[18px] font-semibold text-[#fafafa] tracking-tight">{title}</div>
      <div className="bg-[#262626] rounded-[10px] p-3.5 space-y-1">
        <div className="text-[14px] font-medium text-[#fafafa]">{draftTitle}</div>
        <div className="text-[12px] text-[#a3a3a3]">{draftStatus}</div>
      </div>
      <p className="text-[13px] text-[#a3a3a3]">{description}</p>
      {onRetry && (
        <Button variant="outline" size="md" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  </Card>
);
