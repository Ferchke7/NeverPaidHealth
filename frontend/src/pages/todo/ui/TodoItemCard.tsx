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
import { Card, Badge, Chip } from '../../../shared/ui/card.tsx';
import { Button } from '../../../shared/ui/button.tsx';
import { ProgressBar } from '../../../shared/ui/progress.tsx';
import { TodoItem, TodoCategory } from '../../../entities/todo/model/types.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

interface TodoItemCardProps {
  item: TodoItem;
  isToday: boolean;
  onToggle: (id: string) => void;
  onStartFocus: (item: TodoItem) => void;
  onMoveToTomorrow?: (item: TodoItem) => void;
  onEdit: (item: TodoItem) => void;
  onDelete: (item: TodoItem) => void;
}

export const TodoItemCard: React.FC<TodoItemCardProps> = ({
  item,
  isToday,
  onToggle,
  onStartFocus,
  onMoveToTomorrow,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();
  const isDone = item.status === 'completed';

  const getCategoryBadgeVariant = (cat: TodoCategory): 'brand' | 'accent' | 'info' | 'success' | 'warning' | 'danger' | 'neutral' => {
    switch (cat) {
      case 'workout':
        return 'warning';
      case 'work':
        return 'info';
      case 'study':
        return 'brand';
      case 'health':
        return 'success';
      case 'meeting':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  const getCategoryLabel = (cat: TodoCategory): string => {
    return t(`todo.cat.${cat}`) || cat;
  };

  const hasTime = !!(item.start_time || item.end_time);
  const timeString = hasTime
    ? `${item.start_time || '00:00'} — ${item.end_time || '...'}`
    : null;

  const targetMins = item.target_duration_minutes || 25;
  const spentMins = item.total_spent_minutes || 0;
  const dayProgressPct = Math.min(100, Math.round((spentMins / targetMins) * 100));

  return (
    <Card
      isHoverable={!isDone}
      className={`p-3.5 sm:p-4 rounded-2xl transition-all ${
        isDone
          ? 'bg-dark-950/50 border-dark-800/80 opacity-75'
          : 'bg-dark-900 border-dark-800 hover:border-dark-700 shadow-md'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Checkbox + Content */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Toggle Button */}
          <Button
            size="xs"
            isIconOnly
            variant={isDone ? 'success' : 'outline'}
            onClick={() => onToggle(item.id)}
            className={`mt-0.5 rounded-lg shrink-0 ${
              isDone
                ? 'bg-emerald-500 text-dark-950 border-emerald-500'
                : 'border-zinc-600 text-transparent hover:border-brand-500'
            }`}
            aria-label={isDone ? 'Mark as pending' : 'Mark as completed'}
          >
            <CheckCircle2 className={`w-4 h-4 ${isDone ? 'fill-current text-dark-950' : 'text-zinc-500'}`} />
          </Button>

          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Title & Metadata Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`text-sm sm:text-base font-extrabold truncate ${
                  isDone ? 'line-through text-zinc-500' : 'text-white'
                }`}
              >
                {item.title}
              </span>

              <Badge variant={getCategoryBadgeVariant(item.category)} size="sm">
                {getCategoryLabel(item.category)}
              </Badge>

              {timeString && (
                <Chip variant="bordered" color="default" className="text-[10px] font-mono">
                  <Clock className="w-3 h-3 text-brand-400" />
                  <span>{timeString}</span>
                </Chip>
              )}

              {item.is_multi_day && (
                <Badge variant="accent" size="sm" className="flex items-center gap-1 font-mono">
                  <Calendar className="w-3 h-3" />
                  <span>
                    {item.completed_days !== undefined ? `${item.completed_days}/${item.total_days} дн.` : `${item.total_days} дн.`}
                  </span>
                </Badge>
              )}

              {item.has_conflict && (
                <Badge variant="danger" size="sm" className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                  <span>{t('todo.conflictGeneric') || 'Конфликт времени'}</span>
                </Badge>
              )}
            </div>

            {item.description && (
              <p className="text-xs text-zinc-400 line-clamp-2">
                {item.description}
              </p>
            )}

            {/* Daily Minutes Progress */}
            <div className="pt-1 flex items-center gap-3 flex-wrap">
              <div className="w-28 sm:w-36">
                <ProgressBar
                  value={dayProgressPct}
                  size="sm"
                  color={dayProgressPct >= 100 ? 'success' : 'brand'}
                />
              </div>

              <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5">
                <span>{spentMins} / {targetMins} м</span>
                {item.lifetime_spent_minutes !== undefined && item.lifetime_spent_minutes > spentMins && (
                  <span className="text-zinc-500 text-[10px]">
                    (всего {item.lifetime_spent_minutes}м)
                  </span>
                )}
              </div>

              {item.meeting_url && (
                <a
                  href={item.meeting_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-rose-400 hover:text-rose-300 font-bold text-xs hover:underline ml-1"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>{t('todo.joinMeet') || 'Встреча'}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
          {!isDone && (
            <Button
              variant={isToday ? 'primary' : 'outline'}
              size="xs"
              onClick={() => onStartFocus(item)}
              className="font-bold flex items-center gap-1"
              title={t('focusTimer.startPomodoro') || 'Запустить таймер'}
            >
              <Play className="w-3 h-3 fill-current" />
              <span>{t('todo.focus') || 'Фокус'}</span>
            </Button>
          )}

          {!isDone && !item.is_multi_day && onMoveToTomorrow && (
            <Button
              variant="outline"
              size="xs"
              onClick={() => onMoveToTomorrow(item)}
              className="text-zinc-400 hover:text-amber-400 border-dark-700"
              title="Перенести на завтра (+1 день)"
            >
              <span className="hidden sm:inline">Завтра</span>
              <ArrowRight className="w-3 h-3 text-amber-400" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="xs"
            isIconOnly
            onClick={() => onEdit(item)}
            className="text-zinc-400 hover:text-white"
            title={t('common.edit') || 'Редактировать'}
          >
            <Edit3 className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="xs"
            isIconOnly
            onClick={() => onDelete(item)}
            className="text-zinc-400 hover:text-red-400"
            title={t('common.delete') || 'Удалить'}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
