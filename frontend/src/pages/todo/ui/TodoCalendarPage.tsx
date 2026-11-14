import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Flame,
  ListTodo,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  History,
  AlertCircle,
  X,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Volume2,
  VolumeX,
  Maximize2,
  Pencil,
  Calendar,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Button } from '../../../shared/ui/button.tsx';
import { Card } from '../../../shared/ui/card.tsx';
import { Input, Textarea } from '../../../shared/ui/input.tsx';
import { Skeleton } from '../../../shared/ui/skeleton.tsx';
import {
  TodoItem,
  DailyScheduleResponse,
  ActivityLogItem,
  TodoCategory,
} from '../../../entities/todo/model/types.ts';
import { invalidateTodoQueries } from '../../../entities/todo/api/todoQueries.ts';
import { todoStorage } from '../../../entities/todo/api/todoStorage.ts';
import { useFocusTimerStore, TimerMode } from '../../../features/focus-timer/model/focusTimerStore.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { usePageSEO } from '../../../shared/lib/seo/usePageSEO.ts';
import { toLocalDateKey, formatDate } from '../../../shared/lib/dates.ts';
import { generateUUID } from '../../../shared/lib/uuid.ts';
import {
  isSoundEnabled,
  playTaskCompleteSound,
  playTaskUncheckSound,
} from '../../../shared/lib/audio/soundEffects.ts';
import { CreateTodoModal } from './CreateTodoModal.tsx';
import { TodoDaySummary } from './TodoDaySummary.tsx';
import { TodoQuickAdd } from './TodoQuickAdd.tsx';
import { TodoItemCard } from './TodoItemCard.tsx';
import { TodoActivityLog } from './TodoActivityLog.tsx';
import { ConfirmDeleteModal } from './ConfirmDeleteModal.tsx';

function parseLocalDateKey(dateStr: string): Date {
  const parts = dateStr.split('-').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date();
}

function formatTimerClock(secs: number): string {
  const totalSecs = Math.max(0, Math.floor(secs));
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const TODO_CATEGORIES: TodoCategory[] = [
  'work',
  'workout',
  'study',
  'health',
  'meeting',
  'personal',
];

export const TodoCalendarPage: React.FC = () => {
  usePageSEO({ pageKey: 'todo', canonicalPath: '/todo' });
  const { t, language } = useTranslation();
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState(() => toLocalDateKey(new Date()));
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);
  const [deletingTodo, setDeletingTodo] = useState<TodoItem | null>(null);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  // Inline editor fields (populated when editingTodo is chosen)
  const inlineEditRef = useRef<HTMLDivElement>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<TodoCategory>('work');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editDuration, setEditDuration] = useState(25);
  const [editMeetingUrl, setEditMeetingUrl] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Focus timer store + inline timer controls
  const {
    isActive: isTimerActive,
    isRunning: isTimerRunning,
    taskTitle: timerTaskTitle,
    mode: timerMode,
    pomodoroPhase,
    secondsRemaining,
    secondsElapsedTotal,
    targetTotalMinutes,
    startForTodo,
    startQuickSession,
    pause: pauseTimer,
    resume: resumeTimer,
    setMode: setTimerMode,
    resetCurrentPhase,
    stopAndLog,
    closeModal: closeTimerModal,
    openModal: openTimerModal,
  } = useFocusTimerStore();

  const [idleMode, setIdleMode] = useState<TimerMode>('pomodoro');
  const [soundOn, setSoundOn] = useState<boolean>(() => isSoundEnabled());
  const [isLoggingFocus, setIsLoggingFocus] = useState(false);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    localStorage.setItem('np_sound_enabled', next ? 'true' : 'false');
  };

  useEffect(() => {
    if (editingTodo) {
      setEditTitle(editingTodo.title);
      setEditCategory(editingTodo.category);
      setEditStartTime(editingTodo.start_time || '');
      setEditEndTime(editingTodo.end_time || '');
      setEditDuration(editingTodo.target_duration_minutes || 25);
      setEditMeetingUrl(editingTodo.meeting_url || '');
      setEditDescription(editingTodo.description || '');
    }
  }, [editingTodo]);

  // 1. Fetch Daily Schedule & Todos for selectedDate (offline-first with backend merge)
  const { data: schedule, isLoading: isLoadingDay } = useQuery<DailyScheduleResponse>({
    queryKey: ['todos-daily', selectedDate],
    initialData: () => todoStorage.getDailySchedule(selectedDate),
    queryFn: async () => {
      const local = todoStorage.getDailySchedule(selectedDate);
      if (!useAuthStore.getState().isAuthenticated) {
        return local;
      }
      try {
        const res = await apiClient<DailyScheduleResponse>(`/todos?date=${selectedDate}`);
        if (res && Array.isArray(res.todos)) {
          const backendIds = new Set(res.todos.map((item) => item.id));
          const localOnly = local.todos.filter((item) => !backendIds.has(item.id));
          const mergedTodos = [...localOnly, ...res.todos];
          return {
            ...res,
            todos: mergedTodos,
            total_tasks: mergedTodos.length,
            completed_tasks: mergedTodos.filter((item) => item.status === 'completed').length,
          };
        }
      } catch {
        // Fallback safely to local storage
      }
      return local;
    },
  });

  // 2. Fetch Activity Logs for selectedDate (offline-first fallback)
  const { data: rawActivityLogs } = useQuery<ActivityLogItem[]>({
    queryKey: ['activity-logs', selectedDate],
    initialData: () => todoStorage.getActivityLogs(selectedDate),
    queryFn: async () => {
      const localLogs = todoStorage.getActivityLogs(selectedDate);
      if (!useAuthStore.getState().isAuthenticated) {
        return localLogs;
      }
      try {
        const res = await apiClient<ActivityLogItem[]>(`/todos/activity-logs?date=${selectedDate}`);
        if (Array.isArray(res) && res.length > 0) return res;
      } catch {
        // Fallback to local storage
      }
      return localLogs;
    },
  });
  const activityLogs = Array.isArray(rawActivityLogs) ? rawActivityLogs : [];

  // 3. Mutations with optimistic updates
  const createTodoMutation = useMutation({
    mutationFn: async (newTodo: Record<string, unknown>) => {
      setActionError(null);
      return todoStorage.createTodo(newTodo as Parameters<typeof todoStorage.createTodo>[0]);
    },
    onMutate: async (newTodo) => {
      await queryClient.cancelQueries({ queryKey: ['todos-daily', selectedDate] });
      const previousSchedule = queryClient.getQueryData<DailyScheduleResponse>([
        'todos-daily',
        selectedDate,
      ]);
      if (previousSchedule) {
        const optimisticItem: TodoItem = {
          id: generateUUID(),
          user_id: 'local-user',
          title: String(newTodo.title || ''),
          description: String(newTodo.description || ''),
          category: (newTodo.category as TodoCategory) || 'workout',
          priority: (newTodo.priority as TodoItem['priority']) || 'medium',
          event_type: 'task',
          start_date: String(newTodo.start_date || selectedDate),
          end_date: String(newTodo.end_date || selectedDate),
          start_time: newTodo.start_time as string | undefined,
          end_time: newTodo.end_time as string | undefined,
          target_duration_minutes: Number(newTodo.target_duration_minutes) || 25,
          total_spent_minutes: 0,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        queryClient.setQueryData<DailyScheduleResponse>(['todos-daily', selectedDate], {
          ...previousSchedule,
          total_tasks: previousSchedule.total_tasks + 1,
          todos: [optimisticItem, ...previousSchedule.todos],
        });
      }
      return { previousSchedule };
    },
    onError: (err: unknown, _, context) => {
      if (context?.previousSchedule) {
        queryClient.setQueryData(['todos-daily', selectedDate], context.previousSchedule);
      }
      setActionError(
        err instanceof Error ? err.message : t('todo.taskError')
      );
    },
    onSuccess: () => {
      invalidateTodoQueries(queryClient);
      setIsCreateModalOpen(false);
      setActionError(null);
    },
  });

  const updateTodoMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      setActionError(null);
      return todoStorage.updateTodo(id, data as Parameters<typeof todoStorage.updateTodo>[1]);
    },
    onError: (err: unknown) => {
      setActionError(
        err instanceof Error ? err.message : t('todo.taskError')
      );
    },
    onSuccess: () => {
      invalidateTodoQueries(queryClient);
      setEditingTodo(null);
      setActionError(null);
    },
  });

  const toggleTodoMutation = useMutation({
    mutationFn: async (id: string) => {
      return todoStorage.toggleTodo(id, selectedDate);
    },
    onSuccess: ({ completed }) => {
      if (completed) {
        playTaskCompleteSound();
      } else {
        playTaskUncheckSound();
      }
      invalidateTodoQueries(queryClient);
    },
  });

  const deleteTodoMutation = useMutation({
    mutationFn: async (id: string) => {
      return todoStorage.deleteTodo(id);
    },
    onSuccess: (_, id) => {
      if (editingTodo?.id === id) {
        setEditingTodo(null);
      }
      invalidateTodoQueries(queryClient);
      setDeletingTodo(null);
    },
  });

  const deleteActivityLogMutation = useMutation({
    mutationFn: async (id: string) => {
      return todoStorage.deleteActivityLog(id);
    },
    onSuccess: () => {
      invalidateTodoQueries(queryClient);
      setDeletingLogId(null);
    },
  });

  const handleQuickAdd = (title: string, category: TodoCategory) => {
    createTodoMutation.mutate({
      title,
      category,
      priority: 'medium',
      start_date: selectedDate,
      end_date: selectedDate,
      target_duration_minutes: 25,
    });
  };

  const handleMoveToTomorrow = (item: TodoItem) => {
    const currentStart = item.start_date || selectedDate;
    const d = parseLocalDateKey(currentStart);
    d.setDate(d.getDate() + 1);
    const nextDate = toLocalDateKey(d);
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
      },
    });
  };

  const handleShiftDate = (days: number) => {
    const current = parseLocalDateKey(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(toLocalDateKey(current));
  };

  const handleSetToday = () => {
    setSelectedDate(toLocalDateKey(new Date()));
  };

  const todayStr = toLocalDateKey(new Date());
  const isSelectedToday = selectedDate === todayStr;

  const formattedDate = useMemo(() => {
    return formatDate(selectedDate, language);
  }, [selectedDate, language]);

  // 7-day Mon..Sun strip centered around selectedDate's week
  const weekDays = useMemo(() => {
    const anchor = parseLocalDateKey(selectedDate);
    const dayOfWeek = anchor.getDay(); // 0 (Sun)..6 (Sat)
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + diffToMonday);
    const locale = language === 'ru' ? 'ru-RU' : language === 'uz' ? 'uz-Latn-UZ' : 'en-US';
    const weekdayFormatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });

    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const key = toLocalDateKey(day);
      return {
        key,
        weekday: weekdayFormatter.format(day),
        dayNum: day.getDate(),
        isToday: key === todayStr,
        isSelected: key === selectedDate,
      };
    });
  }, [selectedDate, todayStr, language]);

  const todos = Array.isArray(schedule?.todos) ? schedule.todos : [];
  const completedTasks = schedule?.completed_tasks || 0;
  const totalTasks = schedule?.total_tasks || 0;

  const filteredTodos = useMemo(() => {
    if (taskFilter === 'active') return todos.filter((item) => item.status !== 'completed');
    if (taskFilter === 'completed') return todos.filter((item) => item.status === 'completed');
    return todos;
  }, [todos, taskFilter]);

  const filterTabs = useMemo(
    () => [
      { id: 'all' as const, label: t('todo.filterAll'), badge: todos.length },
      {
        id: 'active' as const,
        label: t('todo.filterActive'),
        badge: Math.max(0, todos.length - completedTasks),
      },
      { id: 'completed' as const, label: t('todo.filterCompleted'), badge: completedTasks },
    ],
    [todos.length, completedTasks, t]
  );

  const activeTimerDisplay = isTimerActive
    ? timerMode === 'stopwatch'
      ? formatTimerClock(secondsElapsedTotal)
      : formatTimerClock(secondsRemaining)
    : idleMode === 'stopwatch'
      ? '00:00'
      : '25:00';

  const currentMode = isTimerActive ? timerMode : idleMode;

  const handleInlineStartPause = () => {
    if (isTimerActive) {
      if (isTimerRunning) pauseTimer();
      else resumeTimer();
    } else {
      startQuickSession(t('focusTimer.session'), 'work', 25, '25m', idleMode);
      closeTimerModal();
    }
  };

  const handleInlineFinish = async () => {
    if (!isTimerActive || isLoggingFocus) return;
    setIsLoggingFocus(true);
    try {
      await stopAndLog(false, '');
    } catch {
      setActionError(t('todo.taskError'));
    } finally {
      setIsLoggingFocus(false);
    }
  };

  const handleSaveInlineEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTodo || !editTitle.trim()) return;
    updateTodoMutation.mutate({
      id: editingTodo.id,
      data: {
        title: editTitle.trim(),
        category: editCategory,
        priority: editingTodo.priority,
        start_date: editingTodo.start_date,
        end_date: editingTodo.end_date,
        start_time: editStartTime || undefined,
        end_time: editEndTime || undefined,
        target_duration_minutes: Math.max(5, Number(editDuration) || 25),
        meeting_url: editMeetingUrl.trim() || undefined,
        description: editDescription.trim() || undefined,
      },
    });
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-16">
      {/* Action Error Banner */}
      {actionError && (
        <div className="flex items-center justify-between p-3.5 bg-red-950/30 border border-red-500/40 rounded-[10px] text-red-300 text-[13px]">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="font-medium">{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="min-h-[44px] min-w-[44px] rounded-[10px] hover:bg-[#262626] flex items-center justify-center text-red-300 hover:text-[#fafafa] cursor-pointer"
            aria-label={t('common.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Top Plan Header + Week Strip */}
      <Card className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-[#022c22] border border-[#064e3b] flex items-center justify-center text-[#34d399] shrink-0">
              <ListTodo className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-[#fafafa] leading-tight">
                {t('todo.planTitle')}
              </h1>
              <p className="text-[13px] text-[#a3a3a3] mt-0.5">
                {t('todo.subtitle')} ·{' '}
                <span className="text-[#fafafa] font-medium">
                  {isSelectedToday ? t('todo.today') : formattedDate}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-[#0a0a0a] border border-[#404040] rounded-[10px] p-1">
              <button
                type="button"
                onClick={() => handleShiftDate(-1)}
                className="min-h-[44px] px-2.5 rounded-[8px] hover:bg-[#262626] text-[#a3a3a3] hover:text-[#fafafa] flex items-center gap-1 text-[12px] font-medium transition-colors cursor-pointer"
                aria-label={t('todo.prevDay')}
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">{t('todo.prevDay')}</span>
              </button>

              <button
                type="button"
                onClick={handleSetToday}
                className={`min-h-[44px] px-3 rounded-[8px] text-[12px] font-semibold transition-colors cursor-pointer ${
                  isSelectedToday
                    ? 'bg-[#022c22] text-[#34d399] border border-[#064e3b]'
                    : 'text-[#fafafa] hover:bg-[#262626]'
                }`}
              >
                {t('todo.today')}
              </button>

              <button
                type="button"
                onClick={() => handleShiftDate(1)}
                className="min-h-[44px] px-2.5 rounded-[8px] hover:bg-[#262626] text-[#a3a3a3] hover:text-[#fafafa] flex items-center gap-1 text-[12px] font-medium transition-colors cursor-pointer"
                aria-label={t('todo.nextDay')}
              >
                <span className="hidden sm:inline">{t('todo.nextDay')}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <label className="relative flex items-center bg-[#0a0a0a] border border-[#404040] rounded-[10px] px-3 min-h-[44px] text-[12px] text-[#fafafa] font-mono tabular-nums cursor-pointer">
              <Calendar className="w-4 h-4 text-[#34d399] mr-2 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="min-h-[44px] bg-transparent text-[#fafafa] focus:outline-none cursor-pointer"
                aria-label={t('todo.calendar')}
              />
            </label>

            <Button
              variant="primary"
              size="md"
              onClick={() => setIsCreateModalOpen(true)}
              className="gap-1.5 font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>{t('todo.add')}</span>
            </Button>
          </div>
        </div>

        {/* Mon-Sun Week Strip */}
        <div className="grid grid-cols-7 gap-1.5 pt-3 border-t border-[#262626]">
          {weekDays.map((day) => (
            <button
              key={day.key}
              type="button"
              onClick={() => setSelectedDate(day.key)}
              className={`min-h-[54px] rounded-[10px] border flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                day.isSelected
                  ? 'bg-[#022c22] border-[#064e3b] text-[#34d399]'
                  : 'bg-[#0a0a0a] border-[#262626] text-[#a3a3a3] hover:border-[#404040] hover:text-[#fafafa]'
              }`}
            >
              <span className="text-[11px] uppercase font-medium tracking-wide">
                {day.weekday}
              </span>
              <span className="text-[15px] font-semibold font-mono tabular-nums flex items-center gap-1">
                {day.dayNum}
                {day.isToday && !day.isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
                )}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {/* 2. Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_0.95fr] gap-4 items-start">
        {/* Left Column: Day Summary + Tasks + Activity Log */}
        <div className="min-w-0 space-y-4">
          <TodoDaySummary
            completedTasks={completedTasks}
            totalTasks={totalTasks}
            totalPlannedMinutes={schedule?.total_planned_minutes || 0}
            totalSpentMinutes={schedule?.total_spent_minutes || 0}
          />

          <Card className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[#262626] pb-3">
              <div>
                <h2 className="text-[16px] font-semibold text-[#fafafa]">
                  {t('todo.stepsTitle')}
                </h2>
                <p className="text-[12px] text-[#a3a3a3] mt-0.5">
                  {t('todo.completedOf', { completed: completedTasks, total: totalTasks })}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                {filterTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTaskFilter(tab.id)}
                    className={`min-h-[44px] px-3 rounded-[10px] text-[12px] font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                      taskFilter === tab.id
                        ? 'bg-[#022c22] border-[#064e3b] text-[#34d399]'
                        : 'bg-[#0a0a0a] border-[#404040] text-[#a3a3a3] hover:text-[#fafafa]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="font-mono tabular-nums text-[11px] opacity-80">
                      {tab.badge}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <TodoQuickAdd onAdd={handleQuickAdd} isLoading={createTodoMutation.isPending} />

            {isLoadingDay && todos.length === 0 ? (
              <div className="space-y-2.5">
                <Skeleton className="h-20 w-full" variant="rounded" />
                <Skeleton className="h-20 w-full" variant="rounded" />
                <Skeleton className="h-20 w-full" variant="rounded" />
              </div>
            ) : todos.length === 0 ? (
              <div className="p-8 text-center bg-[#0a0a0a] border border-dashed border-[#404040] rounded-[10px] space-y-3">
                <div className="w-11 h-11 rounded-[10px] bg-[#171717] border border-[#262626] flex items-center justify-center mx-auto text-[#737373]">
                  <ListTodo className="w-5 h-5" />
                </div>
                <h3 className="text-[14px] font-semibold text-[#fafafa]">
                  {t('todo.noTasks', { date: formattedDate })}
                </h3>
                <p className="text-[12px] text-[#a3a3a3] max-w-md mx-auto">
                  {t('todo.noTasksDesc')}
                </p>
                <div className="pt-1">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="font-semibold gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t('todo.add')}</span>
                  </Button>
                </div>
              </div>
            ) : filteredTodos.length === 0 ? (
              <div className="p-6 text-center bg-[#0a0a0a] border border-[#262626] rounded-[10px] text-[12px] text-[#a3a3a3]">
                {t('todo.noFilteredTasks', { filter: taskFilter })}
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredTodos.map((item) => (
                  <TodoItemCard
                    key={item.id}
                    item={item}
                    isToday={isSelectedToday}
                    isEditing={editingTodo?.id === item.id}
                    onToggle={(id) => toggleTodoMutation.mutate(id)}
                    onStartFocus={(target) =>
                      startForTodo({
                        todoId: target.id,
                        title: target.title,
                        category: target.category,
                        targetDurationMinutes: target.target_duration_minutes,
                      })
                    }
                    onMoveToTomorrow={handleMoveToTomorrow}
                    onEdit={(target) => {
                      setEditingTodo(target);
                      setTimeout(() => {
                        inlineEditRef.current?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'nearest',
                        });
                      }, 50);
                    }}
                    onDelete={(target) => setDeletingTodo(target)}
                  />
                ))}
              </div>
            )}
          </Card>

          {/* Activity Log Toggle + List */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => setIsActivityLogOpen((prev) => !prev)}
              className="w-full min-h-[48px] flex items-center justify-between px-4 py-2.5 rounded-[14px] bg-[#171717] border border-[#404040] hover:border-[#34d399]/60 text-[13px] text-[#fafafa] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 font-medium">
                <History className="w-4 h-4 text-[#34d399]" />
                <span>{t('todo.activityLogToggle')}</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono tabular-nums bg-[#022c22] text-[#34d399] border border-[#064e3b]">
                  {t('todo.activityLogEntries', { count: activityLogs.length })}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[#a3a3a3] text-[12px]">
                <span>
                  {isActivityLogOpen ? t('todo.hideActivityLog') : t('todo.showActivityLog')}
                </span>
                {isActivityLogOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </button>

            {isActivityLogOpen && (
              <TodoActivityLog
                logs={activityLogs}
                selectedDate={selectedDate}
                onDeleteLog={(id) => setDeletingLogId(id)}
              />
            )}
          </div>
        </div>

        {/* Right Column: Inline Focus Timer + Inline Task Editor */}
        <div className="min-w-0 space-y-4">
          {/* Inline Focus Timer Card */}
          <Card className="p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between gap-2 border-b border-[#262626] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-[10px] bg-[#022c22] border border-[#064e3b] flex items-center justify-center text-[#34d399] shrink-0">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-[15px] font-semibold text-[#fafafa]">
                    {t('todo.focusTitle')}
                  </h2>
                  <p className="text-[12px] text-[#a3a3a3]">{t('todo.focusSubtitle')}</p>
                </div>
              </div>

              {isTimerActive && (
                <button
                  type="button"
                  onClick={openTimerModal}
                  className="min-h-[44px] min-w-[44px] rounded-[10px] bg-[#0a0a0a] hover:bg-[#262626] border border-[#404040] text-[#a3a3a3] hover:text-[#fafafa] flex items-center justify-center transition-colors cursor-pointer"
                  title={t('focusTimer.title')}
                  aria-label={t('focusTimer.title')}
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Timer Modes */}
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'pomodoro', label: t('todo.focusModePomodoro') },
                  { id: 'target_timer', label: t('todo.focusModeTimer') },
                  { id: 'stopwatch', label: t('todo.focusModeStopwatch') },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    if (isTimerActive) setTimerMode(m.id);
                    else setIdleMode(m.id);
                  }}
                  className={`min-h-[44px] px-1.5 rounded-[10px] text-[11px] sm:text-[12px] font-medium border transition-colors cursor-pointer truncate ${
                    currentMode === m.id
                      ? 'bg-[#022c22] border-[#064e3b] text-[#34d399]'
                      : 'bg-[#0a0a0a] border-[#404040] text-[#a3a3a3] hover:text-[#fafafa]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Clock Well */}
            <div className="p-4 sm:p-5 rounded-[10px] bg-[#0a0a0a] border border-[#262626] text-center space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-[12px]">
                <span className="px-2.5 py-1 rounded-[6px] bg-[#022c22] border border-[#064e3b] text-[#34d399] font-medium">
                  {pomodoroPhase === 'work' ? t('todo.focusWork') : t('todo.focusBreak')}
                </span>
                <span className="text-[#a3a3a3] truncate max-w-[180px]">
                  {isTimerActive ? timerTaskTitle || t('focusTimer.session') : t('todo.freeSession')}
                </span>
              </div>

              <div className="text-[46px] sm:text-[52px] font-semibold font-mono tabular-nums tracking-tight text-[#fafafa] leading-none py-1">
                {activeTimerDisplay}
              </div>

              <div className="text-[12px] font-mono tabular-nums text-[#737373]">
                {t('todo.accumulated')}{' '}
                <span className="text-[#fafafa]">
                  {Math.floor(secondsElapsedTotal / 60)} / {targetTotalMinutes} {t('todo.minuteShort')}
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleInlineStartPause}
                className="col-span-2 min-h-[44px] px-3 rounded-[10px] bg-[#34d399] hover:bg-[#10b981] text-[#0a0a0a] font-semibold text-[13px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {isTimerActive && isTimerRunning ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>{t('focusTimer.pause')}</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>{t('focusTimer.start')}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={resetCurrentPhase}
                disabled={!isTimerActive}
                className="min-h-[44px] px-3 rounded-[10px] bg-[#0a0a0a] hover:bg-[#262626] border border-[#404040] text-[#fafafa] text-[12px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#a3a3a3]" />
                <span>{t('focusTimer.reset')}</span>
              </button>

              <button
                type="button"
                onClick={handleInlineFinish}
                disabled={!isTimerActive || isLoggingFocus}
                className="min-h-[44px] px-3 rounded-[10px] bg-[#022c22] hover:bg-[#064e3b] border border-[#064e3b] text-[#34d399] text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t('todo.finishSession')}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={toggleSound}
              className="w-full min-h-[44px] px-3 rounded-[10px] bg-[#0a0a0a] hover:bg-[#262626] border border-[#404040] text-[#a3a3a3] hover:text-[#fafafa] text-[12px] font-medium flex items-center justify-between transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                {soundOn ? (
                  <Volume2 className="w-4 h-4 text-[#34d399]" />
                ) : (
                  <VolumeX className="w-4 h-4 text-[#737373]" />
                )}
                <span>{soundOn ? t('todo.soundOn') : t('todo.soundOff')}</span>
              </span>
              <span
                className={`text-[11px] font-mono px-2 py-0.5 rounded-[6px] border ${
                  soundOn
                    ? 'bg-[#022c22] border-[#064e3b] text-[#34d399]'
                    : 'bg-[#171717] border-[#404040] text-[#737373]'
                }`}
              >
                {soundOn ? 'ON' : 'OFF'}
              </span>
            </button>
          </Card>

          {/* Inline Task Edit Card */}
          <div ref={inlineEditRef}>
            <Card className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-[#262626] pb-3">
                <div className="flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-[#34d399]" />
                  <h2 className="text-[15px] font-semibold text-[#fafafa]">
                    {t('todo.inlineEditTitle')}
                  </h2>
                </div>

                {editingTodo && (
                  <button
                    type="button"
                    onClick={() => setEditingTodo(null)}
                    className="min-h-[44px] min-w-[44px] rounded-[10px] hover:bg-[#262626] flex items-center justify-center text-[#a3a3a3] hover:text-[#fafafa] cursor-pointer"
                    aria-label={t('common.close')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {!editingTodo ? (
                <div className="space-y-3">
                  <p className="text-[12px] text-[#a3a3a3] leading-relaxed">
                    {t('todo.inlineEditEmpty')}
                  </p>
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="w-full gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t('todo.add')}</span>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSaveInlineEdit} className="space-y-3">
                  <Input
                    label={t('todo.titleInput')}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder={t('todo.titlePlaceholder')}
                  />

                  <div className="space-y-1.5">
                    <label className="block text-[12px] font-medium text-[#a3a3a3]">
                      {t('todo.categoryLabel')}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {TODO_CATEGORIES.map((catId) => (
                        <button
                          key={catId}
                          type="button"
                          onClick={() => setEditCategory(catId)}
                          className={`min-h-[44px] px-2.5 rounded-[10px] text-[12px] font-medium border truncate transition-colors cursor-pointer ${
                            editCategory === catId
                              ? 'bg-[#022c22] border-[#064e3b] text-[#34d399]'
                              : 'bg-[#0a0a0a] border-[#404040] text-[#a3a3a3] hover:text-[#fafafa]'
                          }`}
                        >
                          {t(`todo.cat.${catId}` as Parameters<typeof t>[0])}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <Input
                      label={t('todo.startTime')}
                      type="time"
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                    />
                    <Input
                      label={t('todo.endTime')}
                      type="time"
                      value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                    />
                  </div>

                  <Input
                    label={t('todo.targetDaily')}
                    type="number"
                    min={5}
                    max={480}
                    step={5}
                    value={String(editDuration)}
                    onChange={(e) => setEditDuration(Number(e.target.value) || 25)}
                    className="font-mono tabular-nums"
                  />

                  <Input
                    label={t('todo.meetingUrl')}
                    type="url"
                    placeholder="https://meet.google.com/..."
                    value={editMeetingUrl}
                    onChange={(e) => setEditMeetingUrl(e.target.value)}
                  />

                  <Textarea
                    label={t('todo.notesLabel')}
                    rows={2}
                    placeholder={t('todo.notesPlaceholder')}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      onClick={() => setEditingTodo(null)}
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      disabled={!editTitle.trim() || updateTodoMutation.isPending}
                      className="flex-1 font-semibold"
                    >
                      {t('todo.saveChanges')}
                    </Button>
                  </div>
                </form>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Create Task Modal */}
      <CreateTodoModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        defaultDate={selectedDate}
        initialTodo={null}
        existingTodos={todos}
        onSubmit={(payload) => createTodoMutation.mutate(payload)}
      />

      {/* Confirm Task Deletion Modal */}
      <ConfirmDeleteModal
        isOpen={!!deletingTodo}
        title={t('todo.confirmDeleteTitle')}
        description={
          deletingTodo ? t('todo.confirmDeleteDesc', { title: deletingTodo.title }) : ''
        }
        isLoading={deleteTodoMutation.isPending}
        onConfirm={() => {
          if (deletingTodo) {
            deleteTodoMutation.mutate(deletingTodo.id);
          }
        }}
        onClose={() => setDeletingTodo(null)}
      />

      {/* Confirm Activity Log Deletion Modal */}
      <ConfirmDeleteModal
        isOpen={!!deletingLogId}
        title={t('todo.confirmDeleteLogTitle')}
        description={t('todo.confirmDeleteLogDesc')}
        isLoading={deleteActivityLogMutation.isPending}
        onConfirm={() => {
          if (deletingLogId) {
            deleteActivityLogMutation.mutate(deletingLogId);
          }
        }}
        onClose={() => setDeletingLogId(null)}
      />
    </div>
  );
};
