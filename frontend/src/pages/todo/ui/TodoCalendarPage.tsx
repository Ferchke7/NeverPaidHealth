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
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Flame,
  ListTodo,
  History,
  AlertTriangle,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Button } from '../../../shared/ui/button.tsx';
import { Card } from '../../../shared/ui/card.tsx';
import {
  TodoItem,
  DailyScheduleResponse,
  ActivityLogItem,
  ProductivityStatsResponse,
  TodoCategory,
} from '../../../entities/todo/model/types.ts';
import { useFocusTimerStore } from '../../../features/focus-timer/model/focusTimerStore.ts';
import { CreateTodoModal } from './CreateTodoModal.tsx';

type ViewTab = 'schedule' | 'history' | 'stats';

export const TodoCalendarPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [activeTab, setActiveTab] = useState<ViewTab>('schedule');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);

  const startForTodo = useFocusTimerStore((s) => s.startForTodo);
  const startQuickSession = useFocusTimerStore((s) => s.startQuickSession);

  // 1. Fetch Daily Schedule & Todos for selectedDate
  const { data: schedule } = useQuery<DailyScheduleResponse>({
    queryKey: ['todos-daily', selectedDate],
    queryFn: () => apiClient<DailyScheduleResponse>(`/todos?date=${selectedDate}`),
  });

  // 2. Fetch Activity Logs ("Что я делал")
  const { data: activityLogs = [] } = useQuery<ActivityLogItem[]>({
    queryKey: ['activity-logs', selectedDate],
    queryFn: () => apiClient<ActivityLogItem[]>(`/todos/activity-logs?date=${selectedDate}`),
    enabled: activeTab === 'history',
  });

  // 3. Fetch Productivity Stats
  const { data: stats } = useQuery<ProductivityStatsResponse>({
    queryKey: ['productivity-stats', 7],
    queryFn: () => apiClient<ProductivityStatsResponse>('/todos/stats?days=7'),
    enabled: activeTab === 'stats',
  });

  // 4. Mutations
  const createTodoMutation = useMutation({
    mutationFn: (newTodo: any) => apiClient.post('/todos', newTodo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos-daily'] });
    },
  });

  const updateTodoMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiClient.put(`/todos/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos-daily'] });
    },
  });

  const toggleTodoMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/todos/${id}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos-daily'] });
    },
  });

  const deleteTodoMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/todos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos-daily'] });
    },
  });

  // Date Navigation helpers
  const handleShiftDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const handleSetToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
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
      const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
      return {
        iso,
        dayNumber: d.getDate(),
        dayName: dayNames[d.getDay()],
        isToday: iso === new Date().toISOString().split('T')[0],
        isSelected: iso === selectedDate,
      };
    });
  }, [selectedDate]);

  const getCategoryBadge = (cat: TodoCategory) => {
    switch (cat) {
      case 'workout':
        return { label: 'Тренировка', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
      case 'work':
        return { label: 'Работа', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
      case 'study':
        return { label: 'Обучение', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
      case 'health':
        return { label: 'Здоровье', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
      case 'meeting':
        return { label: 'Google Meet', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
      default:
        return { label: 'Заметка', color: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30' };
    }
  };

  const todos = schedule?.todos || [];
  const totalPlannedMins = schedule?.total_planned_minutes || 0;
  const totalSpentMins = schedule?.total_spent_minutes || 0;
  const completedTasks = schedule?.completed_tasks || 0;
  const totalTasks = schedule?.total_tasks || 0;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-12 animate-fade-in">
      {/* 1. Header & Quick Actions Bar */}
      <div className="bg-dark-900 border border-dark-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold">
                <ListTodo className="w-4 h-4" />
              </div>
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Todo & Расписание
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/15 text-brand-400 border border-brand-500/30">
                Календарь + Помодоро
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Планирование дня со временем, длительностью и историей выполнения
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => startQuickSession('Фокус-сессия', 'work', 'pomodoro')}
              className="px-3 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 border border-dark-700 text-brand-400 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
              title="Запустить свободный 25-минутный Помодоро"
            >
              <Flame className="w-4 h-4 text-brand-400" />
              <span>Помодоро 25м</span>
            </button>

            <Button
              variant="primary"
              onClick={() => {
                setEditingTodo(null);
                setIsCreateModalOpen(true);
              }}
              className="rounded-xl px-3.5 py-2 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-brand-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Добавить задачу</span>
            </Button>
          </div>
        </div>

        {/* Date Selector & Week Strip */}
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
              Сегодня
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

        {/* View Mode Tabs (Schedule / History / Stats) */}
        <div className="flex items-center gap-1.5 pt-1 border-t border-dark-800 text-xs">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'schedule'
                ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-800'
            }`}
          >
            <ListTodo className="w-3.5 h-3.5" />
            <span>Задачи на день ({todos.length})</span>
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
            <span>Что я делал (Лог)</span>
          </button>

          <button
            onClick={() => setActiveTab('stats')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'stats'
                ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Статистика недели</span>
          </button>
        </div>
      </div>

      {/* 2. Daily Summary Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3.5 bg-dark-900 border-dark-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold text-zinc-500">Запланировано</div>
            <div className="text-base sm:text-lg font-black text-white mt-0.5">
              {Math.floor(totalPlannedMins / 60)}ч {totalPlannedMins % 60}м
            </div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Clock className="w-4 h-4" />
          </div>
        </Card>

        <Card className="p-3.5 bg-dark-900 border-dark-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold text-zinc-500">Затрачено (Фокус)</div>
            <div className="text-base sm:text-lg font-black text-emerald-400 mt-0.5">
              {Math.floor(totalSpentMins / 60)}ч {totalSpentMins % 60}м
            </div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Flame className="w-4 h-4" />
          </div>
        </Card>

        <Card className="p-3.5 bg-dark-900 border-dark-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold text-zinc-500">Завершено задач</div>
            <div className="text-base sm:text-lg font-black text-brand-400 mt-0.5">
              {completedTasks} / {totalTasks}
            </div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </Card>

        <Card className="p-3.5 bg-dark-900 border-dark-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold text-zinc-500">Прогресс дня</div>
            <div className="text-base sm:text-lg font-black text-white mt-0.5">
              {progressPercent}%
            </div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <TrendingUp className="w-4 h-4" />
          </div>
        </Card>
      </div>

      {/* 3. Main Content: Daily Schedule View */}
      {activeTab === 'schedule' && (
        <div className="space-y-3">
          {todos.length === 0 ? (
            <Card className="p-10 text-center bg-dark-900 border-dark-800 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-dark-800 border border-dark-700 flex items-center justify-center mx-auto text-zinc-400">
                <ListTodo className="w-6 h-6" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-zinc-200">
                На {selectedDate} задач пока нет
              </h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Составьте расписание дня, задайте целевое время и запускайте Помодоро-таймер.
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
                Создать первую задачу
              </Button>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {todos.map((item) => {
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
                              title={`Пересекается по времени: ${item.conflicting_with || ''}`}
                            >
                              <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                              <span>Пересечение: {item.conflicting_with || 'Конфликт'}</span>
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
                            Цель: <strong className="text-zinc-200">{item.target_duration_minutes} мин</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Накоплено: <strong className="text-emerald-400">{item.total_spent_minutes} мин</strong>
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
                                <span>Войти в Google Meet</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      {/* Start Focus / Pomodoro Timer Button */}
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
                          title="Запустить Помодоро-таймер для этой задачи"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Запустить 🍅</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setEditingTodo(item);
                          setIsCreateModalOpen(true);
                        }}
                        className="p-2 rounded-xl bg-dark-800 hover:bg-dark-700 text-zinc-400 hover:text-white transition-colors"
                        title="Редактировать"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          if (window.confirm(`Удалить задачу "${item.title}"?`)) {
                            deleteTodoMutation.mutate(item.id);
                          }
                        }}
                        className="p-2 rounded-xl bg-dark-800 hover:bg-red-950/40 text-zinc-400 hover:text-red-400 transition-colors"
                        title="Удалить"
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

      {/* 4. Activity History View ("Что я делал") */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <History className="w-4 h-4 text-brand-400" />
              Лог выполненных сессий за {selectedDate}
            </h2>
            <span className="text-xs text-zinc-400">
              Всего записей: {activityLogs.length}
            </span>
          </div>

          {activityLogs.length === 0 ? (
            <Card className="p-8 text-center bg-dark-900 border-dark-800 text-xs text-zinc-500">
              За выбранную дату сессий таймера пока не зафиксировано. Запустите задачу, чтобы время автоматически записалось в лог.
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
                    className="p-3.5 rounded-2xl bg-dark-900 border border-dark-800 flex items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-dark-800 border border-dark-700 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-white text-sm truncate">
                            {log.task_title}
                          </span>
                          <span
                            className={`px-2 py-0.2 rounded text-[10px] font-bold border shrink-0 ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-zinc-300">
                            {startTime} — {endTime}
                          </span>
                          <span>•</span>
                          <span className="capitalize text-zinc-400">
                            Режим: {log.session_type}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-black text-brand-400 font-mono">
                        +{log.duration_minutes} мин
                      </div>
                      <div className="text-[10px] text-zinc-500">учтено в прогрессе</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. Productivity Stats View */}
      {activeTab === 'stats' && stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card className="p-4 bg-dark-900 border-dark-800 space-y-2">
              <span className="text-xs font-bold text-zinc-400 uppercase">
                Общий фокус за 7 дней
              </span>
              <div className="text-2xl font-black text-brand-400 font-mono">
                {Math.floor(stats.total_focus_minutes / 60)} ч {stats.total_focus_minutes % 60} мин
              </div>
              <p className="text-xs text-zinc-400">
                Суммарное время работы над задачами и тренировками в режиме концентрации.
              </p>
            </Card>

            <Card className="p-4 bg-dark-900 border-dark-800 space-y-2">
              <span className="text-xs font-bold text-zinc-400 uppercase">
                Завершено сессий
              </span>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                {stats.total_tasks_done}
              </div>
              <p className="text-xs text-zinc-400">
                Успешно завершенных помодоро и рабочих блоков.
              </p>
            </Card>
          </div>

          {/* Category Breakdown */}
          <Card className="p-4 bg-dark-900 border-dark-800 space-y-3">
            <h3 className="text-sm font-extrabold text-white">Распределение времени по категориям</h3>
            <div className="space-y-2.5">
              {stats.category_breakdown.map((cb) => {
                const badge = getCategoryBadge(cb.category);
                const percent =
                  stats.total_focus_minutes > 0
                    ? Math.round((cb.total_minutes / stats.total_focus_minutes) * 100)
                    : 0;

                return (
                  <div key={cb.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-200">{badge.label}</span>
                      <span className="font-mono text-zinc-400">
                        {cb.total_minutes} мин ({percent}%)
                      </span>
                    </div>
                    <div className="w-full bg-dark-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-brand-500 h-full rounded-full transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
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
