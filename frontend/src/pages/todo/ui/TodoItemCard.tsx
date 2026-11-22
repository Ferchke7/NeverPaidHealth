import React from 'react';
import {
  Clock,
  Play,
  CheckCircle2,
  Video,
  ExternalLink,
  Trash2,
  Edit3,
  AlertTriangle,
  ArrowRight,
  Calendar,
} from 'lucide-react';
import { TodoItem, TodoCategory } from '../../../entities/todo/model/types.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

interface TodoItemCardProps {
  item: TodoItem;
  isToday: boolean;
  isEditing?: boolean;
  onToggle: (id: string) => void;
  onStartFocus: (item: TodoItem) => void;
  onMoveToTomorrow?: (item: TodoItem) => void;
  onEdit: (item: TodoItem) => void;
  onDelete: (item: TodoItem) => void;
}

export const TodoItemCard: React.FC<TodoItemCardProps> = ({
  item,
  isToday,
  isEditing = false,
  onToggle,
  onStartFocus,
  onMoveToTomorrow,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();
  const isDone = item.status === 'completed';

  const getCategoryLabel = (cat: TodoCategory): string => {
    return t(`todo.cat.${cat}` as Parameters<typeof t>[0]) || cat;
  };

  const hasTime = !!(item.start_time || item.end_time);
  const timeString = hasTime
    ? `${item.start_time || '00:00'} — ${item.end_time || '...'}`
    : null;

  const targetMins = item.target_duration_minutes || 25;
  const spentMins = item.total_spent_minutes || 0;
  const dayProgressPct = Math.min(100, Math.round((spentMins / targetMins) * 100));

  return (
    <div
      className={`p-3.5 sm:p-4 rounded-[14px] bg-[#F8F7FC] border transition-colors space-y-3 ${
        isEditing
          ? 'border-[#6D28D9] bg-[#F5F3FF]'
          : isDone
            ? 'border-[#ECEAF6] opacity-75'
            : 'border-[#ECEAF6] hover:border-[#C4B5FD]'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        {/* Left: Checkbox + Content */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onToggle(item.id)}
            className={`min-h-[42px] min-w-[42px] rounded-[12px] border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
              isDone
                ? 'bg-[#10B981] text-white border-[#10B981]'
                : 'bg-white border-[#DDD6FE] text-[#94A3B8] hover:border-[#6D28D9] hover:text-[#6D28D9]'
            }`}
            aria-label={isDone ? 'Mark as pending' : 'Mark as completed'}
          >
            <CheckCircle2 className="w-5 h-5" />
          </button>

          <div className="min-w-0 flex-1 space-y-2">
            {/* Title & Status */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[14px] font-bold truncate ${
                  isDone ? 'line-through text-[#94A3B8]' : 'text-[#1E1B4B]'
                }`}
              >
                {item.title}
              </span>

              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-[6px] border ${
                  isDone
                    ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#059669]'
                    : 'bg-white border-[#ECEAF6] text-[#6B7280]'
                }`}
              >
                {isDone ? t('todo.doneStatus') : t('todo.pendingStatus')}
              </span>

              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-[6px] bg-[#F0EFFE] border border-[#DDD6FE] text-[#6D28D9]">
                {getCategoryLabel(item.category)}
              </span>

              {timeString && (
                <span className="text-[11px] font-mono tabular-nums px-2 py-0.5 rounded-[6px] bg-white border border-[#ECEAF6] text-[#1E1B4B] inline-flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#6D28D9]" />
                  <span>{timeString}</span>
                </span>
              )}

              {item.is_multi_day && (
                <span className="text-[11px] font-mono tabular-nums px-2 py-0.5 rounded-[6px] bg-white border border-[#ECEAF6] text-[#6B7280] inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#6D28D9]" />
                  <span>
                    {item.completed_days !== undefined
                      ? `${item.completed_days}/${item.total_days} ${t('todo.daysShort') || 'дн.'}`
                      : `${item.total_days} ${t('todo.daysShort') || 'дн.'}`}
                  </span>
                </span>
              )}

              {item.has_conflict && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-[6px] bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] inline-flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{t('todo.conflictGeneric') || 'Конфликт времени'}</span>
                </span>
              )}
            </div>

            {item.description && (
              <p className="text-[12px] text-[#6B7280] line-clamp-2 leading-relaxed">
                {item.description}
              </p>
            )}

            {/* Daily Minutes Progress */}
            <div className="flex items-center gap-3 flex-wrap pt-0.5">
              <div className="w-28 sm:w-36 h-1.5 rounded-full bg-[#ECEAF6] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#6D28D9] transition-all duration-300"
                  style={{ width: `${dayProgressPct}%` }}
                />
              </div>

              <div className="text-[12px] font-mono tabular-nums text-[#6B7280] flex items-center gap-1.5">
                <span>
                  {spentMins} / {targetMins} {t('todo.minuteShort') || 'м'}
                </span>
                {item.lifetime_spent_minutes !== undefined && item.lifetime_spent_minutes > spentMins && (
                  <span className="text-[#94A3B8] text-[11px]">
                    {t('todo.lifetimeTotal', { minutes: item.lifetime_spent_minutes }) ||
                      `(${item.lifetime_spent_minutes}m)`}
                  </span>
                )}
              </div>

              {item.meeting_url && (
                <a
                  href={item.meeting_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[#6D28D9] hover:underline font-semibold text-[12px] min-h-[38px] px-2"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>{t('todo.joinMeet') || 'Встреча'}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="flex items-center gap-2 pt-2.5 border-t border-[#ECEAF6] flex-wrap">
        {!isDone && (
          <button
            type="button"
            onClick={() => onStartFocus(item)}
            className={`min-h-[40px] px-3 rounded-[10px] text-[12px] font-bold border flex items-center gap-1.5 transition-colors cursor-pointer ${
              isToday
                ? 'bg-[#6D28D9] hover:bg-[#5B21B6] text-white border-[#6D28D9]'
                : 'bg-[#F0EFFE] hover:bg-[#DDD6FE] text-[#6D28D9] border-[#DDD6FE]'
            }`}
            title={t('todo.startPomodoro') || 'Запустить таймер'}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{t('todo.focus') || 'Фокус'}</span>
          </button>
        )}

        {!isDone && !item.is_multi_day && onMoveToTomorrow && (
          <button
            type="button"
            onClick={() => onMoveToTomorrow(item)}
            className="min-h-[40px] px-3 rounded-[10px] bg-white hover:bg-[#F0EFFE] border border-[#ECEAF6] text-[12px] font-semibold text-[#6B7280] hover:text-[#1E1B4B] flex items-center gap-1.5 transition-colors cursor-pointer"
            title={t('todo.moveToTomorrowTitle') || 'Перенести на завтра (+1 день)'}
          >
            <span>{t('todo.moveToTomorrow') || 'Завтра'}</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#6D28D9]" />
          </button>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={() => onEdit(item)}
            className={`min-h-[40px] px-3 rounded-[10px] border text-[12px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              isEditing
                ? 'bg-[#F0EFFE] border-[#DDD6FE] text-[#6D28D9]'
                : 'bg-white hover:bg-[#F0EFFE] border-[#ECEAF6] text-[#1E1B4B]'
            }`}
            title={t('common.edit') || 'Редактировать'}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('todo.editBtn')}</span>
          </button>

          <button
            type="button"
            onClick={() => onDelete(item)}
            className="min-h-[40px] min-w-[40px] px-3 rounded-[10px] bg-white hover:bg-[#FEF2F2] border border-[#ECEAF6] hover:border-[#FECACA] text-[#6B7280] hover:text-[#EF4444] flex items-center justify-center transition-colors cursor-pointer"
            title={t('common.delete') || 'Удалить'}
            aria-label={t('common.delete') || 'Удалить'}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
