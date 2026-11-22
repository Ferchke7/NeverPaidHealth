import React from 'react';
import { Clock, Flame, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '../../../shared/ui/card.tsx';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

interface TodoDaySummaryProps {
  completedTasks: number;
  totalTasks: number;
  totalPlannedMinutes: number;
  totalSpentMinutes: number;
}

export const TodoDaySummary: React.FC<TodoDaySummaryProps> = ({
  completedTasks,
  totalTasks,
  totalPlannedMinutes,
  totalSpentMinutes,
}) => {
  const { t } = useTranslation();

  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const timeProgress = totalPlannedMinutes > 0
    ? Math.min(100, Math.round((totalSpentMinutes / totalPlannedMinutes) * 100))
    : 0;

  const hUnit = t('todo.hourShort') || 'ч';
  const mUnit = t('todo.minuteShort') || 'м';

  const plannedHours = Math.floor(totalPlannedMinutes / 60);
  const plannedMins = totalPlannedMinutes % 60;
  const spentHours = Math.floor(totalSpentMinutes / 60);
  const spentMins = totalSpentMinutes % 60;

  return (
    <Card className="p-0">
      <CardContent className="p-4 space-y-3">
        {/* Top KPIs Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] bg-[#F0EFFE] border border-[#DDD6FE] flex items-center justify-center text-[#6D28D9] shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-[13px] font-bold text-[#1E1B4B] flex items-center gap-2">
              <span>{t('todo.dayProgress') || 'Прогресс дня'}</span>
              <span className="font-mono tabular-nums text-[#6D28D9] bg-[#F0EFFE] border border-[#DDD6FE] px-2 py-0.5 rounded-[8px] text-[12px]">
                {completedTasks}/{totalTasks} ({taskProgress}%)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[12px] text-[#6B7280] font-mono tabular-nums">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#6B7280]" />
              <span>
                {t('todo.plannedTime') || 'План'}: {plannedHours > 0 ? `${plannedHours}${hUnit} ` : ''}{plannedMins}{mUnit}
              </span>
            </span>
            <span className="text-[#CBD5E1]">·</span>
            <span className="flex items-center gap-1.5 text-[#6D28D9] font-bold">
              <Flame className="w-3.5 h-3.5" />
              <span>
                {t('todo.actualTime') || 'Факт'}: {spentHours > 0 ? `${spentHours}${hUnit} ` : ''}{spentMins}{mUnit} ({timeProgress}%)
              </span>
            </span>
          </div>
        </div>

        {/* Dual Progress Bars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-[#ECEAF6]">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[12px] text-[#6B7280]">
              <span>{t('todo.tasksCompletedLabel') || 'Выполнение задач'}</span>
              <span className="font-mono tabular-nums font-bold text-[#1E1B4B]">{completedTasks} / {totalTasks}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#ECEAF6] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#6D28D9] transition-all duration-300"
                style={{ width: `${taskProgress}%` }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[12px] text-[#6B7280]">
              <span>{t('todo.focusTimeLabel') || 'Время работы'}</span>
              <span className="font-mono tabular-nums font-bold text-[#1E1B4B]">{totalSpentMinutes} / {totalPlannedMinutes} {mUnit}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#ECFEFF] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#0891B2] transition-all duration-300"
                style={{ width: `${timeProgress}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
