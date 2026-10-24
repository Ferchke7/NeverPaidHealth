import React from 'react';
import { Clock, Flame, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '../../../shared/ui/card.tsx';
import { ProgressBar } from '../../../shared/ui/progress.tsx';
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

  const plannedHours = Math.floor(totalPlannedMinutes / 60);
  const plannedMins = totalPlannedMinutes % 60;
  const spentHours = Math.floor(totalSpentMinutes / 60);
  const spentMins = totalSpentMinutes % 60;

  return (
    <Card className="bg-dark-900 border-dark-800 shadow-xl">
      <CardContent className="p-3.5 sm:p-4 space-y-3">
        {/* Top KPIs Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>{t('todo.dayProgress') || 'Прогресс дня'}</span>
                <span className="font-mono text-brand-400 font-extrabold">
                  {completedTasks}/{totalTasks} ({taskProgress}%)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5 font-mono">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>
                {t('todo.plannedTime') || 'План'}: {plannedHours > 0 ? `${plannedHours}ч ` : ''}{plannedMins}м
              </span>
            </span>
            <span className="text-zinc-600">•</span>
            <span className="flex items-center gap-1.5 font-mono text-emerald-400 font-bold">
              <Flame className="w-3.5 h-3.5" />
              <span>
                {t('todo.actualTime') || 'Факт'}: {spentHours > 0 ? `${spentHours}ч ` : ''}{spentMins}м ({timeProgress}%)
              </span>
            </span>
          </div>
        </div>

        {/* Dual Progress Bars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-dark-800/80">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>{t('todo.tasksCompletedLabel') || 'Выполнение задач'}</span>
              <span className="font-mono text-zinc-200">{completedTasks} из {totalTasks}</span>
            </div>
            <ProgressBar
              value={taskProgress}
              color={taskProgress === 100 && totalTasks > 0 ? 'success' : 'brand'}
              size="sm"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>{t('todo.focusTimeLabel') || 'Время работы'}</span>
              <span className="font-mono text-zinc-200">{totalSpentMinutes} из {totalPlannedMinutes} м</span>
            </div>
            <ProgressBar
              value={timeProgress}
              color={timeProgress >= 100 ? 'success' : 'warning'}
              size="sm"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
