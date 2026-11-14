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
            <div className="w-8 h-8 rounded-[10px] bg-[#022c22] border border-[#064e3b] flex items-center justify-center text-[#34d399] shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-[13px] font-semibold text-[#fafafa] flex items-center gap-2">
              <span>{t('todo.dayProgress') || 'Прогресс дня'}</span>
              <span className="font-mono tabular-nums text-[#34d399] bg-[#022c22] border border-[#064e3b] px-2 py-0.5 rounded-[6px] text-[12px]">
                {completedTasks}/{totalTasks} ({taskProgress}%)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[12px] text-[#a3a3a3] font-mono tabular-nums">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#a3a3a3]" />
              <span>
                {t('todo.plannedTime') || 'План'}: {plannedHours > 0 ? `${plannedHours}${hUnit} ` : ''}{plannedMins}{mUnit}
              </span>
            </span>
            <span className="text-[#404040]">·</span>
            <span className="flex items-center gap-1.5 text-[#34d399] font-semibold">
              <Flame className="w-3.5 h-3.5" />
              <span>
                {t('todo.actualTime') || 'Факт'}: {spentHours > 0 ? `${spentHours}${hUnit} ` : ''}{spentMins}{mUnit} ({timeProgress}%)
              </span>
            </span>
          </div>
        </div>

        {/* Dual Progress Bars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-[#262626]">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[12px] text-[#a3a3a3]">
              <span>{t('todo.tasksCompletedLabel') || 'Выполнение задач'}</span>
              <span className="font-mono tabular-nums text-[#fafafa]">{completedTasks} / {totalTasks}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[#262626] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#34d399] transition-all duration-300"
                style={{ width: `${taskProgress}%` }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[12px] text-[#a3a3a3]">
              <span>{t('todo.focusTimeLabel') || 'Время работы'}</span>
              <span className="font-mono tabular-nums text-[#fafafa]">{totalSpentMinutes} / {totalPlannedMinutes} {mUnit}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[#262626] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#34d399] transition-all duration-300"
                style={{ width: `${timeProgress}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
