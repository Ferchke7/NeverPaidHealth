import React, { useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Flame,
  Trophy,
  Plus,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../shared/ui/card.tsx';
import { Button } from '../../../shared/ui/button.tsx';
import { TodoItem, ActivityLogItem, DayProgressItem } from '../../../entities/todo/model/types.ts';
import { TodoItemCard } from './TodoItemCard.tsx';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { toLocalDateKey } from '../../../shared/lib/dates.ts';

interface TodoMonthCalendarProps {
  calendarDate: Date;
  onCalendarDateChange: (date: Date) => void;
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  monthTodos: TodoItem[];
  monthLogs: ActivityLogItem[];
  dayProgressList?: DayProgressItem[];
  onToggleTodo: (id: string) => void;
  onStartFocus: (item: TodoItem) => void;
  onEditTodo: (item: TodoItem) => void;
  onDeleteTodo: (item: TodoItem) => void;
  onOpenCreateModal: () => void;
}

export const TodoMonthCalendar: React.FC<TodoMonthCalendarProps> = ({
  calendarDate,
  onCalendarDateChange,
  selectedDate,
  onSelectDate,
  monthTodos,
  monthLogs,
  dayProgressList = [],
  onToggleTodo,
  onStartFocus,
  onEditTodo,
  onDeleteTodo,
  onOpenCreateModal,
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

  // Day progress lookup map: todoID_day -> DayProgressItem
  const progressMap = useMemo(() => {
    const map = new Map<string, DayProgressItem>();
    for (const p of dayProgressList) {
      map.set(`${p.todo_id}_${p.day}`, p);
    }
    return map;
  }, [dayProgressList]);

  // Activity logs by day
  const logsByDay = useMemo(() => {
    const map = new Map<string, { count: number; minutes: number }>();
    for (const l of monthLogs) {
      const d = l.log_date || (l.started_at ? l.started_at.slice(0, 10) : '');
      if (!d) continue;
      const curr = map.get(d) || { count: 0, minutes: 0 };
      curr.count += 1;
      curr.minutes += l.duration_minutes || 0;
      map.set(d, curr);
    }
    return map;
  }, [monthLogs]);

  // Tasks by day in the month
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const tasksByDay = useMemo(() => {
    const map = new Map<string, { total: number; completed: number; items: TodoItem[] }>();

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dateKey = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const activeForDay: TodoItem[] = [];
      let compCount = 0;

      for (const tItem of monthTodos) {
        if (dateKey >= tItem.start_date && dateKey <= tItem.end_date) {
          const dp = progressMap.get(`${tItem.id}_${dateKey}`);
          const isDone = dp ? dp.status === 'completed' : tItem.status === 'completed';

          const itemCopy: TodoItem = {
            ...tItem,
            status: isDone ? 'completed' : 'pending',
            total_spent_minutes: dp ? dp.spent_minutes : 0,
            completed_at: dp?.completed_at,
          };
          activeForDay.push(itemCopy);
          if (isDone) compCount++;
        }
      }

      map.set(dateKey, {
        total: activeForDay.length,
        completed: compCount,
        items: activeForDay,
      });
    }

    return map;
  }, [calYear, calMonth, daysInMonth, monthTodos, progressMap]);

  // Month Statistics
  const monthStats = useMemo(() => {
    let completedCount = 0;
    let totalTasks = 0;
    const activeDaysSet = new Set<string>();

    for (const [day, data] of tasksByDay.entries()) {
      if (data.total > 0) {
        totalTasks += data.total;
        completedCount += data.completed;
        if (data.completed > 0) activeDaysSet.add(day);
      }
    }

    let totalFocusMins = 0;
    for (const [day, log] of logsByDay.entries()) {
      totalFocusMins += log.minutes;
      if (log.minutes > 0) activeDaysSet.add(day);
    }

    return {
      totalTasks,
      completedCount,
      totalFocusMins,
      activeDays: activeDaysSet.size,
    };
  }, [tasksByDay, logsByDay]);

  // Calendar matrix calculation
  const firstDayIndex = new Date(calYear, calMonth, 1).getDay(); // 0 = Sun
  const startOffset = (firstDayIndex + 6) % 7; // Monday-first
  const prevMonthDays = new Date(calYear, calMonth, 0).getDate();

  const selectedDayData = tasksByDay.get(selectedDate) || { total: 0, completed: 0, items: [] };

  return (
    <div className="space-y-4">
      {/* 1. Monthly Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 bg-gradient-to-br from-dark-900 to-brand-950/30 border-brand-500/30 shadow-lg">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-brand-400 font-mono">
                {monthStats.completedCount} / {monthStats.totalTasks}
              </div>
              <div className="text-xs text-zinc-400 font-medium">
                {t('todo.monthTasks') || 'Задач за месяц'}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-dark-900 to-emerald-950/30 border-emerald-500/30 shadow-lg">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                {Math.floor(monthStats.totalFocusMins / 60)}ч {monthStats.totalFocusMins % 60}м
              </div>
              <div className="text-xs text-zinc-400 font-medium">
                {t('todo.focusTimeMonth') || 'Время фокуса'}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-dark-900 to-blue-950/30 border-blue-500/30 shadow-lg">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-blue-400 font-mono">
                {monthStats.activeDays}
              </div>
              <div className="text-xs text-zinc-400 font-medium">
                {t('todo.activeDays') || 'Активных дней'}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* 2. Calendar Grid Card */}
      <Card className="p-3.5 sm:p-5 bg-dark-900 border-dark-800 shadow-xl space-y-3">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <h2 className="text-sm sm:text-base font-extrabold text-white tracking-tight capitalize">
              {calendarDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="xs" onClick={handleToday} className="text-xs font-bold">
              {t('todo.today') || 'Сегодня'}
            </Button>
            <Button variant="ghost" size="xs" isIconOnly onClick={handlePrevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="xs" isIconOnly onClick={handleNextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] sm:text-xs font-extrabold text-zinc-400 uppercase tracking-wider py-1 border-b border-dark-800/80">
          {[t('days.mon'), t('days.tue'), t('days.wed'), t('days.thu'), t('days.fri'), t('days.sat'), t('days.sun')].map((day, idx) => (
            <div key={idx} className="py-0.5">
              {day}
            </div>
          ))}
        </div>

        {/* Days Matrix */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {/* Previous Month Offset */}
          {Array.from({ length: startOffset }).map((_, i) => {
            const dayNum = prevMonthDays - startOffset + i + 1;
            return (
              <div
                key={`prev-${i}`}
                className="min-h-[58px] sm:min-h-[72px] p-1.5 rounded-xl bg-dark-950/30 border border-dark-800/30 text-zinc-600 select-none opacity-40 text-xs"
              >
                <span>{dayNum}</span>
              </div>
            );
          })}

          {/* Current Month Days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateKey = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const dayData = tasksByDay.get(dateKey);
            const dayLog = logsByDay.get(dateKey);
            const isSelected = selectedDate === dateKey;
            const isToday = toLocalDateKey(new Date()) === dateKey;

            const hasTasks = dayData && dayData.total > 0;
            const allDone = hasTasks && dayData.completed === dayData.total;
            const hasFocus = dayLog && dayLog.minutes > 0;

            return (
              <div
                key={dateKey}
                onClick={() => onSelectDate(dateKey)}
                className={`min-h-[58px] sm:min-h-[72px] p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
                  isSelected
                    ? 'bg-brand-500/15 border-brand-500 shadow-md ring-2 ring-brand-500/30'
                    : isToday
                    ? 'bg-dark-800 border-brand-500/50 hover:border-brand-400'
                    : 'bg-dark-950/60 border-dark-800 hover:border-dark-700 hover:bg-dark-800/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-black ${
                      isToday
                        ? 'w-5 h-5 rounded-full bg-brand-500 text-dark-950 flex items-center justify-center font-black'
                        : isSelected
                        ? 'text-brand-400 font-black'
                        : 'text-zinc-300'
                    }`}
                  >
                    {dayNum}
                  </span>

                  {allDone ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-500/50" />
                  ) : hasTasks ? (
                    <span className="w-2 h-2 rounded-full bg-brand-400" />
                  ) : hasFocus ? (
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                  ) : null}
                </div>

                <div className="mt-1 space-y-0.5">
                  {hasTasks && (
                    <div
                      className={`text-[9px] sm:text-[10px] font-bold px-1 py-0.2 rounded truncate flex items-center gap-0.5 ${
                        allDone
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-dark-800 text-zinc-300 border border-dark-700'
                      }`}
                    >
                      <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                      <span>{dayData.completed}/{dayData.total}</span>
                    </div>
                  )}

                  {hasFocus && (
                    <div className="text-[9px] sm:text-[10px] font-bold px-1 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 truncate flex items-center gap-0.5">
                      <Flame className="w-2.5 h-2.5 shrink-0" />
                      <span>{dayLog.minutes}м</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 3. Selected Day Tasks List */}
      <Card className="bg-dark-900 border-dark-800 shadow-xl">
        <CardHeader className="p-3.5 sm:p-4 flex items-center justify-between">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-brand-400" />
            <span>{selectedDate}</span>
            <span className="text-xs text-zinc-400 font-normal">
              ({selectedDayData.items.length} {t('todo.tasksForDay', { count: selectedDayData.items.length }) || 'задач'})
            </span>
          </CardTitle>

          <Button
            variant="primary"
            size="xs"
            onClick={onOpenCreateModal}
            className="flex items-center gap-1 font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('todo.add') || 'Добавить'}</span>
          </Button>
        </CardHeader>

        <CardContent className="p-3.5 sm:p-4 pt-1 space-y-2">
          {selectedDayData.items.length === 0 ? (
            <p className="text-xs text-zinc-400 py-4 text-center">
              {t('todo.noTasks', { date: selectedDate }) || 'Нет задач на этот день.'}
            </p>
          ) : (
            selectedDayData.items.map((item) => (
              <TodoItemCard
                key={item.id}
                item={item}
                isToday={toLocalDateKey(new Date()) === selectedDate}
                onToggle={onToggleTodo}
                onStartFocus={onStartFocus}
                onEdit={onEditTodo}
                onDelete={onDeleteTodo}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};
