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
      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-[#ECEAF6] pb-3">
        <h2 className="text-[14px] font-bold text-[#1E1B4B] flex items-center gap-2">
          <History className="w-4 h-4 text-[#6D28D9]" />
          <span>{t('todo.sessionsLog', { date: selectedDate })}</span>
        </h2>
        <span className="text-[12px] text-[#6B7280] font-mono tabular-nums">
          {t('todo.totalSummary') || 'Итого:'}{' '}
          <strong className="text-[#6D28D9]">
            {totalHours > 0 ? `${totalHours}${hUnit} ` : ''}
            {remMinutes}
            {mUnit}
          </strong>{' '}
          ({t('todo.activityLogEntries', { count: logs.length }) || `${logs.length}`})
        </span>
      </div>

      {logs.length === 0 ? (
        <div className="p-6 text-center bg-[#F8F7FC] border border-dashed border-[#DDD6FE] rounded-[12px] text-[12px] text-[#6B7280] leading-relaxed">
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
                className="bg-[#F8F7FC] border border-[#ECEAF6] rounded-[12px] p-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-[10px] bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-center text-[#10B981] shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[#1E1B4B] text-[13px] truncate">
                        {log.task_title}
                      </span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-[6px] bg-white border border-[#ECEAF6] text-[#6B7280]">
                        {getCategoryLabel(log.category)}
                      </span>
                    </div>

                    <div className="text-[12px] text-[#6B7280] flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="font-mono tabular-nums text-[#1E1B4B] font-medium">
                        {startTime} — {endTime}
                      </span>
                      <span className="text-[#CBD5E1]">·</span>
                      <span className="capitalize">{log.session_type}</span>
                      {log.notes && (
                        <>
                          <span className="text-[#CBD5E1]">·</span>
                          <span className="text-[#6B7280] truncate max-w-[200px]">
                            {log.notes}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-[13px] font-bold text-[#6D28D9] font-mono tabular-nums">
                    +{log.duration_minutes} {t('common.minutes') || 'мин'}
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteLog(log.id)}
                    className="min-h-[40px] min-w-[40px] rounded-[10px] bg-white hover:bg-[#FEF2F2] border border-[#ECEAF6] hover:border-[#FECACA] text-[#6B7280] hover:text-[#EF4444] flex items-center justify-center transition-colors cursor-pointer"
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
