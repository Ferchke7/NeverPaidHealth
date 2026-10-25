import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import { Button } from '../../../shared/ui/button.tsx';
import { Card, CardContent } from '../../../shared/ui/card.tsx';
import { TodoItem, ActivityLogItem, DayProgressItem } from '../../../entities/todo/model/types.ts';
import { toLocalDateKey } from '../../../shared/lib/dates.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

interface TodoMiniCalendarProps {
  calendarDate: Date;
  onCalendarDateChange: (date: Date) => void;
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  monthTodos: TodoItem[];
  monthLogs: ActivityLogItem[];
  dayProgressList?: DayProgressItem[];
}

export const TodoMiniCalendar: React.FC<TodoMiniCalendarProps> = ({
  calendarDate,
  onCalendarDateChange,
  selectedDate,
  onSelectDate,
  monthTodos,
  monthLogs,
  dayProgressList = [],
}) => {
  const { t } = useTranslation();

  const calYear = calendarDate.getFullYear();
  const calMonth = calendarDate.getMonth();

  const handlePrevMonth = () => {
    onCalendarDateChange(new Date(calYear, calMonth - 1, 1));
  };

  const handleNextMonth = () => {
    onCalendarDateChange(new Date(calYear, calMonth + 1, 1));
  };

  const handleToday = () => {
    const now = new Date();
    onCalendarDateChange(now);
    onSelectDate(toLocalDateKey(now));
  };

  // Build lookup maps
  const progressMap = useMemo(() => {
    const map = new Map<string, DayProgressItem>();
    for (const p of dayProgressList) {
      map.set(`${p.todo_id}_${p.day}`, p);
    }
    return map;
  }, [dayProgressList]);

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const tasksByDay = useMemo(() => {
    const map = new Map<string, { total: number; completed: number }>();
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dateKey = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      let total = 0;
      let completed = 0;

      for (const item of monthTodos) {
        if (dateKey >= item.start_date && dateKey <= item.end_date) {
          total++;
          const dp = progressMap.get(`${item.id}_${dateKey}`);
          const isDone = dp ? dp.status === 'completed' : item.status === 'completed';
          if (isDone) completed++;
        }
      }
      map.set(dateKey, { total, completed });
    }
    return map;
  }, [calYear, calMonth, daysInMonth, monthTodos, progressMap]);

  const logsMinutesByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const log of monthLogs) {
      const d = log.log_date || (log.started_at ? log.started_at.slice(0, 10) : '');
      if (d) {
        map.set(d, (map.get(d) || 0) + (log.duration_minutes || 0));
      }
    }
    return map;
  }, [monthLogs]);

  // Calendar matrix calculation (Monday-first)
  const firstDayIndex = new Date(calYear, calMonth, 1).getDay(); // 0 is Sun
  const startOffset = (firstDayIndex + 6) % 7;
  const prevMonthDays = new Date(calYear, calMonth, 0).getDate();

  const monthName = calendarDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  const todayStr = toLocalDateKey(new Date());

  const dayHeaders = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  return (
    <Card className="bg-dark-900 border-dark-800 rounded-3xl shadow-xl overflow-hidden">
      <CardContent className="p-3.5 sm:p-4 space-y-3">
        {/* Month Header & Controls */}
        <div className="flex items-center justify-between gap-1">
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-extrabold text-white capitalize truncate">
              {monthName}
            </h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="xs"
              isIconOnly
              onClick={handlePrevMonth}
              aria-label="Previous month"
              className="text-zinc-400 hover:text-white"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={handleToday}
              className="text-[10px] px-2 py-0.5 font-bold"
            >
              {t('todo.today') || 'Сегодня'}
            </Button>
            <Button
              variant="ghost"
              size="xs"
              isIconOnly
              onClick={handleNextMonth}
              aria-label="Next month"
              className="text-zinc-400 hover:text-white"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Day-of-week Headers */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {dayHeaders.map((dh, i) => (
            <div
              key={dh}
              className={`text-[10px] font-bold uppercase tracking-wider ${
                i >= 5 ? 'text-zinc-500' : 'text-zinc-400'
              }`}
            >
              {dh}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Previous month filler cells */}
          {Array.from({ length: startOffset }, (_, i) => {
            const dayNum = prevMonthDays - startOffset + i + 1;
            return (
              <div
                key={`prev-${dayNum}`}
                className="h-8 rounded-xl flex items-center justify-center text-[11px] text-zinc-600 font-mono select-none"
              >
                {dayNum}
              </div>
            );
          })}

          {/* Current month days */}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const dayNum = i + 1;
            const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === todayStr;

            const dayData = tasksByDay.get(dateStr) || { total: 0, completed: 0 };
            const focusMins = logsMinutesByDay.get(dateStr) || 0;
            const hasTasks = dayData.total > 0;
            const isAllCompleted = hasTasks && dayData.completed === dayData.total;

            return (
              <button
                key={dateStr}
                onClick={() => onSelectDate(dateStr)}
                className={`h-8 rounded-xl flex flex-col items-center justify-center relative transition-all cursor-pointer font-mono ${
                  isSelected
                    ? 'bg-brand-500 text-dark-950 font-black shadow-md ring-2 ring-brand-400/50'
                    : isToday
                    ? 'bg-brand-500/15 border border-brand-500/50 text-brand-400 font-bold'
                    : 'bg-dark-800/60 hover:bg-dark-750 text-zinc-300 hover:text-white'
                }`}
              >
                <span className="text-[11px] leading-none">{dayNum}</span>

                {/* Status Dot / Indicator */}
                <div className="flex items-center gap-0.5 mt-0.5">
                  {isAllCompleted ? (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-dark-950' : 'bg-emerald-400'
                      }`}
                    />
                  ) : hasTasks ? (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-dark-950' : 'bg-amber-400'
                      }`}
                    />
                  ) : null}

                  {focusMins > 0 && (
                    <span
                      className={`w-1 h-1 rounded-full ${
                        isSelected ? 'bg-dark-950' : 'bg-blue-400'
                      }`}
                      title={`${focusMins}м фокуса`}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="pt-2 border-t border-dark-800/80 flex items-center justify-between text-[10px] text-zinc-400 font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Готово</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>В процессе</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span className="flex items-center gap-0.5">
              <Flame className="w-2.5 h-2.5 text-blue-400" />
              Фокус
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
