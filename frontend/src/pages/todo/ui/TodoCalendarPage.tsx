import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Play,
  CheckCircle2,
  Video,
  ExternalLink,
  Trash2,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Flame,
  ListTodo,
  History,
  AlertTriangle,
  Trophy,
  ArrowRight,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Button } from '../../../shared/ui/button.tsx';
import { Card } from '../../../shared/ui/card.tsx';
import {
  TodoItem,
  DailyScheduleResponse,
  ActivityLogItem,
  TodoCategory,
} from '../../../entities/todo/model/types.ts';
import { useFocusTimerStore } from '../../../features/focus-timer/model/focusTimerStore.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { CreateTodoModal } from './CreateTodoModal.tsx';

type ViewTab = 'schedule' | 'calendar' | 'history';

export const TodoCalendarPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [activeTab, setActiveTab] = useState<ViewTab>('schedule');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickCategory, setQuickCategory] = useState<TodoCategory>('work');
  const [taskFilter, setTaskFilter] = useState<'all' | 'active' | 'completed'>('all');

  const startForTodo = useFocusTimerStore((s) => s.startForTodo);
  const startQuickSession = useFocusTimerStore((s) => s.startQuickSession);

  // 1. Fetch Daily Schedule & Todos for selectedDate
  const { data: schedule } = useQuery<DailyScheduleResponse>({
    queryKey: ['todos-daily', selectedDate],
    queryFn: () => apiClient<DailyScheduleResponse>(`/todos?date=${selectedDate}`),
  });

  // 2. Fetch Activity Logs
  const { data: rawActivityLogs } = useQuery<ActivityLogItem[]>({
    queryKey: ['activity-logs', selectedDate],
    queryFn: () => apiClient<ActivityLogItem[]>(`/todos/activity-logs?date=${selectedDate}`),
    enabled: activeTab === 'history',
  });
  const activityLogs = Array.isArray(rawActivityLogs) ? rawActivityLogs : [];

  // 3. Calendar Month query (todos for the whole month)
  const calYear = calendarDate.getFullYear();
  const calMonth = calendarDate.getMonth();
  const monthKey = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;

  const { data: monthSchedule } = useQuery<DailyScheduleResponse>({
    queryKey: ['todos-month', monthKey],
    queryFn: () => apiClient<DailyScheduleResponse>(`/todos?date=${monthKey}`),
    enabled: activeTab === 'calendar',
  });

  const { data: rawMonthLogs } = useQuery<ActivityLogItem[]>({
    queryKey: ['activity-logs-month', monthKey],
    queryFn: () => apiClient<ActivityLogItem[]>(`/todos/activity-logs?date=${monthKey}`),
    enabled: activeTab === 'calendar',
  });
  const monthLogs = Array.isArray(rawMonthLogs) ? rawMonthLogs : [];

  // 4. Mutations
  const createTodoMutation = useMutation({
    mutationFn: (newTodo: any) => apiClient.post('/todos', newTodo),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['todos-daily'] });
      void queryClient.invalidateQueries({ queryKey: ['todos-month'] });
    },
  });

  const updateTodoMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiClient.put(`/todos/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['todos-daily'] });
      void queryClient.invalidateQueries({ queryKey: ['todos-month'] });
    },
  });

  const toggleTodoMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/todos/${id}/toggle`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['todos-daily'] });
      void queryClient.invalidateQueries({ queryKey: ['todos-month'] });
      void queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      void queryClient.invalidateQueries({ queryKey: ['activity-logs-month'] });
    },
  });

  const deleteTodoMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/todos/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['todos-daily'] });
      void queryClient.invalidateQueries({ queryKey: ['todos-month'] });
      void queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      void queryClient.invalidateQueries({ queryKey: ['activity-logs-month'] });
    },
  });

  const deleteActivityLogMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/todos/activity-logs/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      void queryClient.invalidateQueries({ queryKey: ['activity-logs-month'] });
      void queryClient.invalidateQueries({ queryKey: ['todos-daily'] });
      void queryClient.invalidateQueries({ queryKey: ['todos-month'] });
    },
  });

  const handleQuickCreate = () => {
    const trimmed = quickTaskTitle.trim();
    if (!trimmed) return;
    createTodoMutation.mutate({
      title: trimmed,
      category: quickCategory,
      priority: 'medium',
      start_date: selectedDate,
      end_date: selectedDate,
      target_duration_minutes: 25,
    });
    setQuickTaskTitle('');
  };

  const handleMoveToTomorrow = (item: TodoItem) => {
    const currentStart = item.start_date || selectedDate;
    const d = new Date(currentStart);
    d.setDate(d.getDate() + 1);
    const nextDate = d.toISOString().split('T')[0];
    updateTodoMutation.mutate({
      id: item.id,
      data: {
        title: item.title,
        description: item.description,
        category: item.category,
        priority: item.priority,
        start_date: nextDate,
        end_date: nextDate,
        start_time: item.start_time,
        end_time: item.end_time,
        target_duration_minutes: item.target_duration_minutes,
        status: item.status,
      },
    });
  };

  // Date Navigation helpers for Daily view
  const handleShiftDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const handleSetToday = () => {
    const todayIso = new Date().toISOString().split('T')[0];
    setSelectedDate(todayIso);
  };

  // Month navigation helpers for Calendar view
  const handlePrevMonth = () => {
    setCalendarDate(new Date(calYear, calMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarDate(new Date(calYear, calMonth + 1, 1));
  };

  const handleCalendarToday = () => {
    const now = new Date();
    setCalendarDate(now);
    setSelectedDate(now.toISOString().split('T')[0]);
  };

  // Generate 7-day week strip around selectedDate
  const weekDays = useMemo(() => {
    const current = new Date(selectedDate);
    const dayOfWeek = current.getDay(); // 0 is Sun
    const startOfWeek = new Date(current);
    startOfWeek.setDate(current.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const dayNames = [
        t('days.sun'),
        t('days.mon'),
        t('days.tue'),
        t('days.wed'),
        t('days.thu'),
        t('days.fri'),
        t('days.sat'),
      ];
      return {
        iso,
        dayNumber: d.getDate(),
        dayName: dayNames[d.getDay()],
        isToday: iso === new Date().toISOString().split('T')[0],
        isSelected: iso === selectedDate,
      };
    });
  }, [selectedDate, t]);

  // Tasks by day in the current month
  const tasksByDay = useMemo(() => {
    const map: Record<string, { total: number; completed: number; items: TodoItem[] }> = {};
    for (const tItem of monthSchedule?.todos || []) {
      const d = tItem.start_date || (tItem.created_at ? tItem.created_at.slice(0, 10) : '');
      if (!d) continue;
      if (!map[d]) {
        map[d] = { total: 0, completed: 0, items: [] };
      }
      map[d].total += 1;
      if (tItem.status === 'completed') {
        map[d].completed += 1;
      }
      map[d].items.push(tItem);
    }
    return map;
  }, [monthSchedule]);

  // Activity logs by day in the current month
  const logsByDay = useMemo(() => {
    const map: Record<string, { count: number; minutes: number }> = {};
    for (const l of monthLogs) {
      const d = l.started_at ? l.started_at.slice(0, 10) : '';
      if (!d) continue;
      if (!map[d]) {
        map[d] = { count: 0, minutes: 0 };
      }
      map[d].count += 1;
      map[d].minutes += l.duration_minutes || 0;
    }
    return map;
  }, [monthLogs]);

  // Month Statistics Summary
  const monthStats = useMemo(() => {
    const monthTodos = monthSchedule?.todos || [];
    let completedCount = 0;
    const activeDaysSet = new Set<string>();

    for (const tItem of monthTodos) {
      const d = tItem.start_date || (tItem.created_at ? tItem.created_at.slice(0, 10) : '');
      if (d) activeDaysSet.add(d);
      if (tItem.status === 'completed') {
        completedCount++;
      }
    }

    let totalFocusMins = 0;
    for (const l of monthLogs) {
      if (l.started_at) {
        activeDaysSet.add(l.started_at.slice(0, 10));
      }
      totalFocusMins += l.duration_minutes || 0;
    }

    return {
      totalTasks: monthTodos.length,
      completedCount,
      totalFocusMins,
      activeDays: activeDaysSet.size,
    };
  }, [monthSchedule, monthLogs]);

  // Calendar matrix calculations
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayIndex = new Date(calYear, calMonth, 1).getDay(); // 0 = Sunday
  const startOffset = (firstDayIndex + 6) % 7; // Convert to Monday-start (0 = Mon, 6 = Sun)
  const prevMonthDays = new Date(calYear, calMonth, 0).getDate();

  const getCategoryBadge = (cat: TodoCategory) => {
    switch (cat) {
      case 'workout':
        return { label: t('todo.cat.workout'), color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
      case 'work':
        return { label: t('todo.cat.work'), color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
      case 'study':
        return { label: t('todo.cat.study'), color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
      case 'health':
        return { label: t('todo.cat.health'), color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
      case 'meeting':
        return { label: t('todo.cat.meeting'), color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
      default:
        return { label: t('todo.cat.personal'), color: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30' };
    }
  };

  const todos = Array.isArray(schedule?.todos) ? schedule.todos : [];
  const filteredTodos = useMemo(() => {
    if (taskFilter === 'active') return todos.filter((t) => t.status !== 'completed');
    if (taskFilter === 'completed') return todos.filter((t) => t.status === 'completed');
    return todos;
  }, [todos, taskFilter]);
  const totalPlannedMins = schedule?.total_planned_minutes || 0;
  const totalSpentMins = schedule?.total_spent_minutes || 0;
  const completedTasks = schedule?.completed_tasks || 0;
  const totalTasks = schedule?.total_tasks || 0;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-12 animate-fade-in">
      {/* 1. Header & Navigation Bar */}
      <div className="bg-dark-900 border border-dark-800 rounded-3xl p-3.5 sm:p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold shrink-0">
              <ListTodo className="w-4 h-4" />
            </div>
            <h1 className="text-base sm:text-xl font-black text-white tracking-tight truncate">
              {t('todo.title')}
            </h1>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => startQuickSession(t('focusTimer.session'), 'work', 25, '25m', 'pomodoro')}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-dark-800 hover:bg-dark-750 border border-dark-700 text-brand-400 font-bold text-xs flex items-center gap-1 transition-all active:scale-95 shadow-sm cursor-pointer"
              title={t('focusTimer.quick25Title')}
            >
              <Flame className="w-3.5 h-3.5 text-brand-400" />
              <span>{t('focusTimer.quick25')}</span>
            </button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingTodo(null);
                setIsCreateModalOpen(true);
              }}
              className="rounded-xl px-3 py-1.5 sm:py-2 font-bold text-xs flex items-center gap-1 shadow-lg shadow-brand-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>{t('todo.add')}</span>
            </Button>
          </div>
        </div>

        {/* View Mode Tabs (Tasks / Calendar / Activity Log) */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-dark-800 text-xs">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'schedule'
                ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-800'
            }`}
          >
            <ListTodo className="w-3.5 h-3.5" />
            <span>{t('todo.tasksForDay', { count: todos.length })}</span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'calendar'
                ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-800'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>{t('todo.calendar')}</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>{t('todo.activityLog')}</span>
          </button>
        </div>

        {/* Date Selector & Week Strip (Visible when in Daily or History tab) */}
        {activeTab !== 'calendar' && (
          <div className="pt-2 border-t border-dark-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleShiftDate(-1)}
                className="p-1.5 rounded-xl bg-dark-800 hover:bg-dark-700 text-zinc-300 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-brand-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-dark-800 border border-dark-700 rounded-xl px-2.5 py-1 text-xs text-zinc-100 font-semibold focus:outline-none focus:border-brand-500 cursor-pointer"
                />
              </div>

              <button
                onClick={() => handleShiftDate(1)}
                className="p-1.5 rounded-xl bg-dark-800 hover:bg-dark-700 text-zinc-300 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={handleSetToday}
                className="px-2.5 py-1 rounded-xl bg-dark-800 hover:bg-dark-700 text-zinc-300 font-semibold text-xs border border-dark-700 transition-colors"
              >
                {t('todo.today')}
              </button>
            </div>

            {/* 7-Day Week Buttons Strip */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {weekDays.map((wd) => (
                <button
                  key={wd.iso}
                  onClick={() => setSelectedDate(wd.iso)}
                  className={`flex flex-col items-center py-1.5 px-1 sm:px-2 rounded-xl transition-all ${
                    wd.isSelected
                      ? 'bg-brand-500 text-dark-950 font-extrabold shadow-md'
                      : wd.isToday
                      ? 'bg-brand-500/15 border border-brand-500/40 text-brand-400 font-bold'
                      : 'bg-dark-800/80 hover:bg-dark-700 text-zinc-400 hover:text-white border border-dark-700/60'
                  }`}
                >
                  <span className="text-[9px] uppercase tracking-wider">{wd.dayName}</span>
                  <span className="text-xs sm:text-sm">{wd.dayNumber}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Compact Daily Summary & Progress Bar */}
      {activeTab === 'schedule' && (
        <Card className="p-3.5 sm:p-4 bg-dark-900 border-dark-800 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Прогресс дня:</span>
              <span className="text-xs font-mono font-black text-brand-400">
                {completedTasks} / {totalTasks} ({progressPercent}%)
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <span className="flex items-center gap-1 font-mono">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>План: {Math.floor(totalPlannedMins / 60)}ч {totalPlannedMins % 60}м</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-mono text-emerald-400">
                <Flame className="w-3.5 h-3.5" />
                <span>Факт: {Math.floor(totalSpentMins / 60)}ч {totalSpentMins % 60}м</span>
              </span>
            </div>
          </div>

          {/* Visual progress bar */}
          <div className="w-full bg-dark-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-brand-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </Card>
      )}

      {/* Quick Inline Task Creator */}
      {activeTab === 'schedule' && (
        <div className="flex items-center gap-2 bg-dark-900 border border-dark-800 rounded-2xl p-2 sm:p-2.5 shadow-sm">
          <input
            type="text"
            placeholder="+ Быстрая задача на сегодня... (нажмите Enter)"
            value={quickTaskTitle}
            onChange={(e) => setQuickTaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleQuickCreate();
            }}
            className="bg-transparent flex-1 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none px-2"
          />
          <select
            value={quickCategory}
            onChange={(e) => setQuickCategory(e.target.value as TodoCategory)}
            className="bg-dark-800 border border-dark-700 text-[11px] sm:text-xs text-zinc-300 rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer"
          >
            <option value="work">Работа</option>
            <option value="workout">Тренировка</option>
            <option value="study">Учёба</option>
            <option value="health">Здоровье</option>
            <option value="meeting">Встреча</option>
            <option value="personal">Личное</option>
          </select>
          <Button
            size="sm"
            variant="primary"
            disabled={!quickTaskTitle.trim()}
            onClick={handleQuickCreate}
            className="rounded-xl px-3 py-1.5 text-xs font-bold shrink-0"
          >
            <Plus className="w-3.5 h-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Добавить</span>
          </Button>
        </div>
      )}

      {/* Filter Tabs: Все / Активные / Готовые */}
      {activeTab === 'schedule' && todos.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setTaskFilter('all')}
            className={`px-3 py-1 rounded-xl font-bold transition-all ${
              taskFilter === 'all'
                ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40'
                : 'bg-dark-900 text-zinc-400 hover:text-white border border-dark-800'
            }`}
          >
            Все ({todos.length})
          </button>
          <button
            onClick={() => setTaskFilter('active')}
            className={`px-3 py-1 rounded-xl font-bold transition-all ${
              taskFilter === 'active'
                ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40'
                : 'bg-dark-900 text-zinc-400 hover:text-white border border-dark-800'
            }`}
          >
            Активные ({todos.length - completedTasks})
          </button>
          <button
            onClick={() => setTaskFilter('completed')}
            className={`px-3 py-1 rounded-xl font-bold transition-all ${
              taskFilter === 'completed'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-dark-900 text-zinc-400 hover:text-white border border-dark-800'
            }`}
          >
            Готовые ({completedTasks})
          </button>
        </div>
      )}

      {/* 3. Main Content: Daily Schedule View */}
      {activeTab === 'schedule' && (
        <div className="space-y-3">
          {todos.length === 0 ? (
            <Card className="p-10 text-center bg-dark-900 border-dark-800 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-dark-800 border border-dark-700 flex items-center justify-center mx-auto text-zinc-400">
                <ListTodo className="w-6 h-6" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-zinc-200">
                {t('todo.noTasks', { date: selectedDate })}
              </h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                {t('todo.noTasksDesc')}
              </p>
              <Button
                variant="primary"
                onClick={() => {
                  setEditingTodo(null);
                  setIsCreateModalOpen(true);
                }}
                className="rounded-xl px-4 py-2 text-xs font-bold"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                {t('todo.createFirst')}
              </Button>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {filteredTodos.map((item) => {
                const badge = getCategoryBadge(item.category);
                const isDone = item.status === 'completed';
                const hasTime = item.start_time || item.end_time;
                const timeString = hasTime
                  ? `${item.start_time || '00:00'} — ${item.end_time || '...'}`
                  : null;

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isDone
                        ? 'bg-dark-950/60 border-dark-800/80 opacity-75'
                        : 'bg-dark-900 border-dark-800 hover:border-dark-700 shadow-md'
                    }`}
                  >
                    {/* Left: Checkbox + Title + Meta */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <button
                        onClick={() => toggleTodoMutation.mutate(item.id)}
                        className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                          isDone
                            ? 'bg-emerald-500 text-dark-950'
                            : 'border-2 border-zinc-600 hover:border-brand-500 text-transparent'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4 fill-current" />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-sm sm:text-base font-extrabold truncate ${
                              isDone ? 'line-through text-zinc-500' : 'text-white'
                            }`}
                          >
                            {item.title}
                          </span>

                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${badge.color}`}
                          >
                            {badge.label}
                          </span>

                          {timeString && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-dark-800 text-zinc-300 border border-dark-700 flex items-center gap-1 shrink-0 font-mono">
                              <Clock className="w-3 h-3 text-brand-400" />
                              {timeString}
                            </span>
                          )}

                          {item.has_conflict && (
                            <span
                              className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1 shrink-0"
                              title={t('todo.conflictWith', { with: item.conflicting_with || '' })}
                            >
                              <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                              <span>{t('todo.conflictBadge', { with: item.conflicting_with || t('todo.conflictGeneric') })}</span>
                            </span>
                          )}
                        </div>

                        {item.description && (
                          <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                            {item.description}
                          </p>
                        )}

                        {/* Duration & Progress Bar */}
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-400 flex-wrap">
                          <span>
                            {t('todo.target')} <strong className="text-zinc-200">{item.target_duration_minutes} {t('common.minutes')}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            {t('todo.accumulated')} <strong className="text-emerald-400">{item.total_spent_minutes} {t('common.minutes')}</strong>
                          </span>

                          {item.meeting_url && (
                            <>
                              <span>•</span>
                              <a
                                href={item.meeting_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-rose-400 hover:text-rose-300 font-bold hover:underline"
                              >
                                <Video className="w-3.5 h-3.5" />
                                <span>{t('todo.joinMeet')}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      {!isDone && (
                        <button
                          onClick={() =>
                            startForTodo({
                              todoId: item.id,
                              title: item.title,
                              category: item.category,
                              targetDurationMinutes: item.target_duration_minutes,
                              mode: 'pomodoro',
                            })
                          }
                          className="px-3 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-950 font-black text-xs flex items-center gap-1.5 transition-all shadow-md shadow-brand-500/20 active:scale-95"
                          title={t('focusTimer.startPomodoro')}
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>{t('todo.startPomodoro')}</span>
                        </button>
                      )}

                      {!isDone && (
                        <button
                          onClick={() => handleMoveToTomorrow(item)}
                          className="px-2.5 py-1.5 rounded-xl bg-dark-800 hover:bg-dark-750 text-zinc-400 hover:text-amber-400 border border-dark-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                          title="Перенести на завтра (+1 день)"
                        >
                          <span className="hidden sm:inline">Завтра</span>
                          <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setEditingTodo(item);
                          setIsCreateModalOpen(true);
                        }}
                        className="p-2 rounded-xl bg-dark-800 hover:bg-dark-700 text-zinc-400 hover:text-white transition-colors"
                        title={t('common.edit')}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          if (window.confirm(t('todo.deleteConfirm', { title: item.title }))) {
                            deleteTodoMutation.mutate(item.id);
                          }
                        }}
                        className="p-2 rounded-xl bg-dark-800 hover:bg-red-950/40 text-zinc-400 hover:text-red-400 transition-colors"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. Interactive Monthly Calendar Grid View */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          {/* Monthly Stats Summary Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="p-4 bg-gradient-to-br from-dark-900 to-brand-950/30 border-brand-500/30 flex items-center gap-3.5 shadow-lg">
              <div className="w-12 h-12 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-brand-400 font-mono">
                    {monthStats.completedCount} / {monthStats.totalTasks}
                  </span>
                  <span className="text-xs font-semibold text-zinc-400">{t('todo.completed')}</span>
                </div>
                <div className="text-[11px] text-zinc-400 font-medium">
                  {t('todo.monthTasks')}
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-dark-900 to-emerald-950/30 border-emerald-500/30 flex items-center gap-3.5 shadow-lg">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Flame className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-emerald-400 font-mono">
                    {Math.floor(monthStats.totalFocusMins / 60)}{t('common.hours')} {monthStats.totalFocusMins % 60}{t('common.minutes')}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400 font-medium">
                  {t('todo.focusTimeMonth')}
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-dark-900 to-blue-950/30 border-blue-500/30 flex items-center gap-3.5 shadow-lg">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-blue-400 font-mono">
                    {monthStats.activeDays}
                  </span>
                  <span className="text-xs font-semibold text-zinc-400">{t('days.fri')}</span>
                </div>
                <div className="text-[11px] text-zinc-400 font-medium">
                  {t('todo.activeDays')}
                </div>
              </div>
            </Card>
          </div>

          {/* Monthly Calendar Card */}
          <Card className="p-4 sm:p-5 bg-dark-900 border-dark-800 shadow-xl rounded-2xl space-y-4">
            {/* Calendar Navigation Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                  {calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h2>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCalendarToday}
                  className="px-2.5 py-1 text-xs font-bold rounded-xl bg-dark-800 hover:bg-dark-700 text-zinc-200 transition-colors border border-dark-700"
                >
                  {t('todo.today')}
                </button>
                <button
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-xl bg-dark-800 hover:bg-dark-700 text-zinc-300 transition-colors border border-dark-700"
                  title="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-xl bg-dark-800 hover:bg-dark-700 text-zinc-300 transition-colors border border-dark-700"
                  title="Next Month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] sm:text-xs font-extrabold text-zinc-400 uppercase tracking-wider py-1 border-b border-dark-800">
              {[t('days.mon'), t('days.tue'), t('days.wed'), t('days.thu'), t('days.fri'), t('days.sat'), t('days.sun')].map((day, idx) => (
                <div key={idx} className="py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days Matrix */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {/* Previous Month Inactive Days */}
              {Array.from({ length: startOffset }).map((_, i) => {
                const dayNum = prevMonthDays - startOffset + i + 1;
                return (
                  <div
                    key={`prev-${i}`}
                    className="min-h-[58px] sm:min-h-[76px] p-1.5 rounded-xl bg-dark-950/40 border border-dark-800/40 text-zinc-600 select-none opacity-40 text-xs"
                  >
                    <span>{dayNum}</span>
                  </div>
                );
              })}

              {/* Current Month Days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dateKey = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const dayData = tasksByDay[dateKey];
                const dayLog = logsByDay[dateKey];
                const isSelected = selectedDate === dateKey;
                const isToday = new Date().toISOString().slice(0, 10) === dateKey;

                const hasTasks = dayData && dayData.total > 0;
                const allDone = hasTasks && dayData.completed === dayData.total;
                const hasFocus = dayLog && dayLog.minutes > 0;

                return (
                  <div
                    key={dateKey}
                    onClick={() => setSelectedDate(dateKey)}
                    className={`min-h-[58px] sm:min-h-[76px] p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
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

                      {/* Small visual dot for activity */}
                      {allDone ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-500/50" />
                      ) : hasTasks ? (
                        <span className="w-2 h-2 rounded-full bg-brand-400" />
                      ) : hasFocus ? (
                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                      ) : null}
                    </div>

                    {/* Task and Focus pills inside day */}
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
                          <span>
                            {dayData.completed}/{dayData.total}
                          </span>
                        </div>
                      )}

                      {hasFocus && (
                        <div className="text-[9px] sm:text-[10px] font-bold px-1 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 truncate flex items-center gap-0.5">
                          <Flame className="w-2.5 h-2.5 shrink-0" />
                          <span>{dayLog.minutes}m</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Selected Date Detail View Below Calendar */}
          <div className="bg-dark-900 border border-dark-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-brand-400" />
                <h3 className="text-sm sm:text-base font-extrabold text-white">
                  {selectedDate}
                </h3>
                <span className="text-xs text-zinc-400">
                  ({todos.length} {t('todo.tasksForDay', { count: todos.length })})
                </span>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditingTodo(null);
                  setIsCreateModalOpen(true);
                }}
                className="rounded-xl px-2.5 py-1 text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('todo.add')}</span>
              </Button>
            </div>

            {todos.length === 0 ? (
              <p className="text-xs text-zinc-400 py-3 text-center">
                {t('todo.noTasks', { date: selectedDate })}
              </p>
            ) : (
              <div className="space-y-2">
                {todos.map((item) => {
                  const badge = getCategoryBadge(item.category);
                  const isDone = item.status === 'completed';

                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                        isDone
                          ? 'bg-dark-950/60 border-dark-800/80 opacity-75'
                          : 'bg-dark-800/70 border-dark-700/80'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <button
                          onClick={() => toggleTodoMutation.mutate(item.id)}
                          className={`w-5 h-5 rounded-md flex items-center justify-center transition-all shrink-0 ${
                            isDone
                              ? 'bg-emerald-500 text-dark-950'
                              : 'border-2 border-zinc-600 hover:border-brand-500 text-transparent'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 fill-current" />
                        </button>
                        <span
                          className={`text-xs sm:text-sm font-bold truncate ${
                            isDone ? 'line-through text-zinc-500' : 'text-white'
                          }`}
                        >
                          {item.title}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold border shrink-0 ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isDone && (
                          <button
                            onClick={() =>
                              startForTodo({
                                todoId: item.id,
                                title: item.title,
                                category: item.category,
                                targetDurationMinutes: item.target_duration_minutes,
                                mode: 'pomodoro',
                              })
                            }
                            className="px-2 py-1 rounded-lg bg-brand-500 text-dark-950 font-black text-[11px] flex items-center gap-1"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>{t('focusTimer.quick25')}</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (window.confirm(t('todo.deleteConfirm', { title: item.title }))) {
                              deleteTodoMutation.mutate(item.id);
                            }
                          }}
                          className="p-1 rounded-lg hover:bg-red-950/40 text-zinc-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Activity History View */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <History className="w-4 h-4 text-brand-400" />
              {t('todo.sessionsLog', { date: selectedDate })}
            </h2>
            <span className="text-xs text-zinc-400">
              {t('todo.totalEntries', { count: activityLogs.length })}
            </span>
          </div>

          {activityLogs.length === 0 ? (
            <Card className="p-8 text-center bg-dark-900 border-dark-800 text-xs text-zinc-500">
              {t('todo.noActivity')}
            </Card>
          ) : (
            <div className="space-y-2">
              {activityLogs.map((log) => {
                const badge = getCategoryBadge(log.category);
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
                    className="p-3.5 rounded-2xl bg-dark-900 border border-dark-800 flex items-center justify-between gap-3 shadow-sm hover:border-dark-700 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-dark-800 border border-dark-700 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-white text-sm truncate">
                            {log.task_title}
                          </span>
                          <span
                            className={`px-2 py-0.2 rounded text-[10px] font-bold border shrink-0 ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="font-mono text-zinc-300">
                            {startTime} — {endTime}
                          </span>
                          <span>•</span>
                          <span className="capitalize text-zinc-400">
                            {log.session_type === 'task_completed'
                              ? t('todo.taskCompleted') || 'Завершено'
                              : t('todo.mode', { mode: log.session_type })}
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
                          +{log.duration_minutes} {t('common.minutes')}
                        </div>
                      </div>

                      <button
                        onClick={() => deleteActivityLogMutation.mutate(log.id)}
                        className="p-1.5 rounded-lg bg-dark-800 hover:bg-red-950/40 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 6. Modal to Create/Edit Task */}
      <CreateTodoModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingTodo(null);
        }}
        onSubmit={(data) => {
          if (editingTodo) {
            updateTodoMutation.mutate({ id: editingTodo.id, data });
          } else {
            createTodoMutation.mutate(data);
          }
        }}
        initialTodo={editingTodo}
        defaultDate={selectedDate}
        existingTodos={todos}
      />
    </div>
  );
};

export default TodoCalendarPage;
