import React from 'react';
import { History, CheckCircle2, Trash2 } from 'lucide-react';
import { Card, CardContent, Badge } from '../../../shared/ui/card.tsx';
import { Button } from '../../../shared/ui/button.tsx';
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

  const totalMinutes = logs.reduce((acc, l) => acc + (l.duration_minutes || 0), 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remMinutes = totalMinutes % 60;

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
          <History className="w-4 h-4 text-brand-400" />
          <span>{t('todo.sessionsLog') || 'Журнал активности за'} {selectedDate}</span>
        </h2>
        <span className="text-xs text-zinc-400 font-mono">
          Итого: <strong className="text-emerald-400">{totalHours > 0 ? `${totalHours}ч ` : ''}{remMinutes}м</strong> ({logs.length} зап.)
        </span>
      </div>

      {logs.length === 0 ? (
        <Card className="p-8 text-center bg-dark-900 border-dark-800 text-xs text-zinc-500">
          {t('todo.noActivity') || 'За этот день не зафиксировано сессий активности.'}
        </Card>
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
              <Card
                key={log.id}
                className="bg-dark-900 border-dark-800 shadow-sm hover:border-dark-700 transition-colors"
              >
                <CardContent className="p-3 sm:p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-xl bg-dark-800 border border-dark-700 flex items-center justify-center text-emerald-400 shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-white text-sm truncate">
                          {log.task_title}
                        </span>
                        <Badge variant={getCategoryBadgeVariant(log.category)} size="sm">
                          {t(`todo.cat.${log.category}`) || log.category}
                        </Badge>
                      </div>

                      <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="font-mono text-zinc-300">
                          {startTime} — {endTime}
                        </span>
                        <span>•</span>
                        <span className="capitalize text-zinc-400">
                          {log.session_type}
                        </span>
                        {log.notes && (
                          <>
                            <span>•</span>
                            <span className="text-zinc-500 italic truncate max-w-[200px]">
                              {log.notes}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-black text-brand-400 font-mono">
                        +{log.duration_minutes} {t('common.minutes') || 'мин'}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="xs"
                      isIconOnly
                      onClick={() => onDeleteLog(log.id)}
                      className="text-zinc-500 hover:text-red-400"
                      title={t('common.delete') || 'Удалить'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
