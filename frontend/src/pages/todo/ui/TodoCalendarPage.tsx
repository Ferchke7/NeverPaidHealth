import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Button } from '../../../shared/ui/button.tsx';
import { Card, CardContent } from '../../../shared/ui/card.tsx';
import { Tabs } from '../../../shared/ui/tabs.tsx';
import { Skeleton } from '../../../shared/ui/skeleton.tsx';
import {
  TodoItem,
  DailyScheduleResponse,
  ActivityLogItem,
  TodoCategory,
} from '../../../entities/todo/model/types.ts';
import { invalidateTodoQueries } from '../../../entities/todo/api/todoQueries.ts';
import { todoStorage } from '../../../entities/todo/api/todoStorage.ts';
import { useFocusTimerStore } from '../../../features/focus-timer/model/focusTimerStore.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { usePageSEO } from '../../../shared/lib/seo/usePageSEO.ts';
import { toLocalDateKey, formatDate } from '../../../shared/lib/dates.ts';
import { generateUUID } from '../../../shared/lib/uuid.ts';
import { playTaskCompleteSound, playTaskUncheckSound } from '../../../shared/lib/audio/soundEffects.ts';
import { CreateTodoModal } from './CreateTodoModal.tsx';
import { TodoDaySummary } from './TodoDaySummary.tsx';
import { TodoQuickAdd } from './TodoQuickAdd.tsx';
import { TodoItemCard } from './TodoItemCard.tsx';
import { TodoActivityLog } from './TodoActivityLog.tsx';
import { ConfirmDeleteModal } from './ConfirmDeleteModal.tsx';

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
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const startForTodo = useFocusTimerStore((s) => s.startForTodo);
  const startQuickSession = useFocusTimerStore((s) => s.startQuickSession);

  // 1. Fetch Daily Schedule & Todos for selectedDate (offline-first with seamless backend merge)
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
          // Merge local and backend todos so no locally created task is ever lost
          const backendIds = new Set(res.todos.map((t) => t.id));
          const localOnly = local.todos.filter((t) => !backendIds.has(t.id));
          const mergedTodos = [...localOnly, ...res.todos];
          return {
            ...res,
            todos: mergedTodos,
            total_tasks: mergedTodos.length,
            completed_tasks: mergedTodos.filter((t) => t.status === 'completed').length,
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

  // 3. Mutations with optimistic updates and visible error handling
  const createTodoMutation = useMutation({
    mutationFn: async (newTodo: any) => {
      setActionError(null);
      return todoStorage.createTodo(newTodo);
    },
    onMutate: async (newTodo) => {
      await queryClient.cancelQueries({ queryKey: ['todos-daily', selectedDate] });
      const previousSchedule = queryClient.getQueryData<DailyScheduleResponse>(['todos-daily', selectedDate]);
      if (previousSchedule) {
        const optimisticItem: TodoItem = {
          id: generateUUID(),
          user_id: 'local-user',
          title: newTodo.title,
          description: newTodo.description || '',
          category: newTodo.category || 'workout',
          priority: newTodo.priority || 'medium',
          event_type: 'task',
          start_date: newTodo.start_date || selectedDate,
          end_date: newTodo.end_date || selectedDate,
          start_time: newTodo.start_time,
          end_time: newTodo.end_time,
          target_duration_minutes: newTodo.target_duration_minutes || 25,
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
    onError: (err: any, _, context) => {
      if (context?.previousSchedule) {
        queryClient.setQueryData(['todos-daily', selectedDate], context.previousSchedule);
      }
      setActionError(err?.message || t('todo.taskError') || 'Ошибка при сохранении задачи');
    },
    onSuccess: () => {
      invalidateTodoQueries(queryClient);
      setIsCreateModalOpen(false);
      setActionError(null);
    },
  });

  const updateTodoMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      setActionError(null);
      return todoStorage.updateTodo(id, data);
    },
    onError: (err: any) => {
      setActionError(err?.message || t('todo.taskError') || 'Ошибка при обновлении задачи');
    },
    onSuccess: () => {
      invalidateTodoQueries(queryClient);
      setIsCreateModalOpen(false);
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
    onSuccess: () => {
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
    const d = new Date(currentStart);
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

  // Date Navigation helpers
  const handleShiftDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(toLocalDateKey(current));
  };

  const handleSetToday = () => {
    setSelectedDate(toLocalDateKey(new Date()));
  };

  const handleSetTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setSelectedDate(toLocalDateKey(d));
  };

  const handleSetYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setSelectedDate(toLocalDateKey(d));
  };

  const todayStr = toLocalDateKey(new Date());
  const isSelectedToday = selectedDate === todayStr;

  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toLocalDateKey(d);
  }, []);

  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toLocalDateKey(d);
  }, []);

  const formattedDate = useMemo(() => {
    return formatDate(selectedDate, language);
  }, [selectedDate, language]);

  const todos = Array.isArray(schedule?.todos) ? schedule.todos : [];
  const completedTasks = schedule?.completed_tasks || 0;
  const totalTasks = schedule?.total_tasks || 0;

  const filteredTodos = useMemo(() => {
    if (taskFilter === 'active') return todos.filter((item) => item.status !== 'completed');
    if (taskFilter === 'completed') return todos.filter((item) => item.status === 'completed');
    return todos;
  }, [todos, taskFilter]);

  // Filter tabs for daily view
  const filterTabs = useMemo(
    () => [
      { id: 'all', label: t('todo.filterAll') || 'Все', badge: todos.length },
      { id: 'active', label: t('todo.filterActive') || 'Активные', badge: Math.max(0, todos.length - completedTasks) },
      { id: 'completed', label: t('todo.filterCompleted') || 'Готовые', badge: completedTasks },
    ],
    [todos.length, completedTasks, t]
  );

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-16 animate-fade-in">
      {/* Action Error Banner */}
      {actionError && (
        <div className="flex items-center justify-between p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-rose-300 text-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="font-semibold">{actionError}</span>
          </div>
          <Button
            size="xs"
            variant="ghost"
            isIconOnly
            onClick={() => setActionError(null)}
            className="text-rose-300 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* 1. Header Card (Focused Single Responsibility: Day's Tasks) */}
      <Card className="bg-dark-900 border-dark-800 rounded-3xl shadow-xl">
        <CardContent className="p-4 sm:p-5 space-y-3.5">
          {/* Top Row: Title + Action Buttons */}
          <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold shrink-0">
                <ListTodo className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-black text-white tracking-tight truncate">
                  {t('todo.title') || 'План на день'}
                </h1>
                <p className="text-[11px] text-zinc-400 truncate">
                  {isSelectedToday ? t('todo.today') || 'Сегодня' : formattedDate} • {t('todo.completedOf', { completed: completedTasks, total: totalTasks }) || `${completedTasks} из ${totalTasks} задач выполнено`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => startQuickSession(t('focusTimer.session') || 'Фокус', 'work', 25, '25m', 'pomodoro')}
                className="text-brand-400 font-bold text-xs flex items-center gap-1 border-dark-700"
                title={t('focusTimer.quick25Title') || 'Запустить 25м таймер'}
              >
                <Flame className="w-3.5 h-3.5 text-brand-400" />
                <span>{t('focusTimer.quick25') || 'Фокус 25м'}</span>
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditingTodo(null);
                  setIsCreateModalOpen(true);
                }}
                className="font-bold text-xs flex items-center gap-1 shadow-lg shadow-brand-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>{t('todo.add') || 'Новая задача'}</span>
              </Button>
            </div>
          </div>

          {/* Clean Day Navigation Bar */}
          <div className="pt-2 border-t border-dark-800/80 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant={selectedDate === yesterdayStr ? 'primary' : 'ghost'}
                size="xs"
                onClick={handleSetYesterday}
                className="text-xs font-semibold px-2.5 py-1"
              >
                {t('todo.yesterday') || 'Вчера'}
              </Button>
              <Button
                variant={isSelectedToday ? 'primary' : 'ghost'}
                size="xs"
                onClick={handleSetToday}
                className="text-xs font-semibold px-2.5 py-1"
              >
                {t('todo.today') || 'Сегодня'}
              </Button>
              <Button
                variant={selectedDate === tomorrowStr ? 'primary' : 'ghost'}
                size="xs"
                onClick={handleSetTomorrow}
                className="text-xs font-semibold px-2.5 py-1"
              >
                {t('todo.tomorrow') || 'Завтра'}
              </Button>
            </div>

            {/* Date Picker & Arrows */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="xs"
                isIconOnly
                onClick={() => handleShiftDate(-1)}
                className="text-zinc-300 hover:text-white"
                aria-label="Previous day"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-dark-800 border border-dark-700 rounded-xl px-2.5 py-1 text-xs text-zinc-100 font-semibold focus:outline-none focus:border-brand-500 cursor-pointer font-mono"
              />

              <Button
                variant="ghost"
                size="xs"
                isIconOnly
                onClick={() => handleShiftDate(1)}
                className="text-zinc-300 hover:text-white"
                aria-label="Next day"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Day Progress Summary Strip */}
      <TodoDaySummary
        completedTasks={completedTasks}
        totalTasks={totalTasks}
        totalPlannedMinutes={schedule?.total_planned_minutes || 0}
        totalSpentMinutes={schedule?.total_spent_minutes || 0}
      />

      {/* 3. Quick Inline Add Bar */}
      <TodoQuickAdd
        onAdd={handleQuickAdd}
        isLoading={createTodoMutation.isPending}
      />

      {/* 4. Task Filters Tabs */}
      {todos.length > 0 && (
        <div className="flex items-center justify-between">
          <Tabs
            tabs={filterTabs}
            selectedKey={taskFilter}
            onSelectionChange={(k) => setTaskFilter(k as any)}
            size="sm"
          />
        </div>
      )}

      {/* 5. Tasks List */}
      {isLoadingDay && todos.length === 0 ? (
        <div className="space-y-2.5">
          <Skeleton className="h-20 w-full" variant="rounded" />
          <Skeleton className="h-20 w-full" variant="rounded" />
          <Skeleton className="h-20 w-full" variant="rounded" />
        </div>
      ) : todos.length === 0 ? (
        <Card className="p-8 sm:p-10 text-center bg-dark-900 border-dark-800 space-y-3 shadow-xl rounded-3xl">
          <div className="w-12 h-12 rounded-2xl bg-dark-800 border border-dark-700 flex items-center justify-center mx-auto text-zinc-400">
            <ListTodo className="w-6 h-6" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-zinc-200">
            {t('todo.noTasks', { date: formattedDate }) || `На ${formattedDate} нет запланированных задач.`}
          </h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            {t('todo.noTasksDesc') || 'Создайте задачу с помощью формы быстрого добавления выше.'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button
              variant="primary"
              onClick={() => {
                setEditingTodo(null);
                setIsCreateModalOpen(true);
              }}
              className="font-bold text-xs"
            >
              <Plus className="w-4 h-4 mr-1" />
              <span>{t('todo.add') || 'Создать задачу'}</span>
            </Button>
          </div>
        </Card>
      ) : filteredTodos.length === 0 ? (
        <Card className="p-8 text-center bg-dark-900 border-dark-800 rounded-3xl shadow-xl">
          <p className="text-xs text-zinc-400">
            {t('todo.noFilteredTasks', { filter: taskFilter }) || `Нет задач, соответствующих выбранному фильтру «${taskFilter}».`}
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filteredTodos.map((item) => (
            <TodoItemCard
              key={item.id}
              item={item}
              isToday={isSelectedToday}
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
                setIsCreateModalOpen(true);
              }}
              onDelete={(target) => setDeletingTodo(target)}
            />
          ))}
        </div>
      )}

      {/* 6. Collapsible Day Activity Log (Hidden by default to keep the screen distraction-free) */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => setIsActivityLogOpen((prev) => !prev)}
          className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-dark-900 border border-dark-800 hover:border-dark-700 text-xs text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer shadow-sm group"
        >
          <div className="flex items-center gap-2 font-bold text-zinc-300">
            <History className="w-4 h-4 text-brand-400 group-hover:scale-110 transition-transform" />
            <span>{t('todo.activityLogToggle') || 'Журнал активности'}</span>
            {activityLogs.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-brand-500/15 text-brand-400 border border-brand-500/30">
                {t('todo.activityLogEntries', { count: activityLogs.length }) || `${activityLogs.length} зап.`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-zinc-500 text-[11px] font-semibold">
            <span>{isActivityLogOpen ? (t('todo.hideActivityLog') || 'Скрыть') : (t('todo.showActivityLog') || 'Показать')}</span>
            {isActivityLogOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isActivityLogOpen && (
          <div className="mt-3 animate-fade-in">
            <TodoActivityLog
              logs={activityLogs}
              selectedDate={selectedDate}
              onDeleteLog={(id) => setDeletingLogId(id)}
            />
          </div>
        )}
      </div>

      {/* 7. Create / Edit Task Modal */}
      <CreateTodoModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingTodo(null);
        }}
        defaultDate={selectedDate}
        initialTodo={editingTodo}
        existingTodos={todos}
        onSubmit={(payload) => {
          if (editingTodo) {
            updateTodoMutation.mutate({ id: editingTodo.id, data: payload });
          } else {
            createTodoMutation.mutate(payload);
          }
        }}
      />

      {/* 8. Confirm Task Deletion Modal */}
      <ConfirmDeleteModal
        isOpen={!!deletingTodo}
        title={t('todo.confirmDeleteTitle') || 'Удалить задачу?'}
        description={
          deletingTodo
            ? t('todo.confirmDeleteDesc', { title: deletingTodo.title }) ||
              `Вы уверены, что хотите удалить «${deletingTodo.title}»?`
            : ''
        }
        isLoading={deleteTodoMutation.isPending}
        onConfirm={() => {
          if (deletingTodo) {
            deleteTodoMutation.mutate(deletingTodo.id);
          }
        }}
        onClose={() => setDeletingTodo(null)}
      />

      {/* 9. Confirm Activity Log Deletion Modal */}
      <ConfirmDeleteModal
        isOpen={!!deletingLogId}
        title={t('todo.confirmDeleteLogTitle') || 'Удалить запись фокуса?'}
        description={t('todo.confirmDeleteLogDesc') || 'Вы уверены, что хотите удалить эту запись журнала?'}
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
