import React from 'react';
import { History, CheckCircle2, Trash2 } from 'lucide-react';
import { Card } from '../../../shared/ui/card.tsx';
import { ActivityLogItem, TodoCategory } from '../../../entities/todo/model/types.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

interface TodoActivityLogProps {
  logs: ActivityLogItem[];
  selectedDate: string;
  onDeleteLog: (id: string) => void;
}

export const TodoActivityLog: React.FC<TodoActivityLogProps> = ({
  logs,
  selectedDate,
  onDeleteLog,
}) => {
  const { t } = useTranslation();

  const totalMinutes = logs.reduce((acc, l) => acc + (l.duration_minutes || 0), 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remMinutes = totalMinutes % 60;
  const hUnit = t('todo.hourShort') || 'ч';
  const mUnit = t('todo.minuteShort') || 'м';

  const getCategoryLabel = (cat: TodoCategory) =>
    t(`todo.cat.${cat}` as Parameters<typeof t>[0]) || cat;

  return (
    <Card className="p-4 sm:p-5 space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-[#262626] pb-3">
        <h2 className="text-[14px] font-semibold text-[#fafafa] flex items-center gap-2">
          <History className="w-4 h-4 text-[#34d399]" />
          <span>{t('todo.sessionsLog', { date: selectedDate })}</span>
        </h2>
        <span className="text-[12px] text-[#a3a3a3] font-mono tabular-nums">
          {t('todo.totalSummary') || 'Итого:'}{' '}
          <strong className="text-[#34d399]">
            {totalHours > 0 ? `${totalHours}${hUnit} ` : ''}
            {remMinutes}
            {mUnit}
          </strong>{' '}
          ({t('todo.activityLogEntries', { count: logs.length }) || `${logs.length}`})
        </span>
      </div>

      {logs.length === 0 ? (
        <div className="p-6 text-center bg-[#0a0a0a] border border-dashed border-[#404040] rounded-[10px] text-[12px] text-[#a3a3a3] leading-relaxed">
          {t('todo.noActivity')}
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const startTime = new Date(log.started_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            const endTime = new Date(log.ended_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={log.id}
                className="bg-[#0a0a0a] border border-[#262626] rounded-[10px] p-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-[10px] bg-[#022c22] border border-[#064e3b] flex items-center justify-center text-[#34d399] shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#fafafa] text-[13px] truncate">
                        {log.task_title}
                      </span>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-[6px] bg-[#171717] border border-[#404040] text-[#a3a3a3]">
                        {getCategoryLabel(log.category)}
                      </span>
                    </div>

                    <div className="text-[12px] text-[#a3a3a3] flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="font-mono tabular-nums text-[#fafafa]">
                        {startTime} — {endTime}
                      </span>
                      <span className="text-[#404040]">·</span>
                      <span className="capitalize">{log.session_type}</span>
                      {log.notes && (
                        <>
                          <span className="text-[#404040]">·</span>
                          <span className="text-[#737373] truncate max-w-[200px]">
                            {log.notes}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-[13px] font-semibold text-[#34d399] font-mono tabular-nums">
                    +{log.duration_minutes} {t('common.minutes') || 'мин'}
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteLog(log.id)}
                    className="min-h-[44px] min-w-[44px] rounded-[10px] bg-[#171717] hover:bg-red-950/30 border border-[#404040] hover:border-red-500/40 text-[#a3a3a3] hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer"
                    title={t('common.delete') || 'Удалить'}
                    aria-label={t('common.delete') || 'Удалить'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};
