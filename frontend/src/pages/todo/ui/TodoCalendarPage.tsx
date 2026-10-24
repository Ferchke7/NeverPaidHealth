import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Flame,
  ListTodo,
  History,
  ChevronLeft,
  ChevronRight,
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
import { useFocusTimerStore } from '../../../features/focus-timer/model/focusTimerStore.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { toLocalDateKey } from '../../../shared/lib/dates.ts';
import { CreateTodoModal } from './CreateTodoModal.tsx';
import { TodoDaySummary } from './TodoDaySummary.tsx';
import { TodoQuickAdd } from './TodoQuickAdd.tsx';
import { TodoItemCard } from './TodoItemCard.tsx';
import { TodoMonthCalendar } from './TodoMonthCalendar.tsx';
import { TodoActivityLog } from './TodoActivityLog.tsx';
import { ConfirmDeleteModal } from './ConfirmDeleteModal.tsx';

type ViewTab = 'schedule' | 'calendar' | 'history';

export const TodoCalendarPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState(() => toLocalDateKey(new Date()));
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [activeTab, setActiveTab] = useState<ViewTab>('schedule');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);
  const [deletingTodo, setDeletingTodo] = useState<TodoItem | null>(null);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState<'all' | 'active' | 'completed'>('all');

  const startForTodo = useFocusTimerStore((s) => s.startForTodo);
  const startQuickSession = useFocusTimerStore((s) => s.startQuickSession);

  // 1. Fetch Daily Schedule & Todos for selectedDate
  const { data: schedule, isLoading: isLoadingDay } = useQuery<DailyScheduleResponse>({
    queryKey: ['todos-daily', selectedDate],
    queryFn: () => apiClient<DailyScheduleResponse>(`/todos?date=${selectedDate}`),
  });

  // 2. Fetch Activity Logs
  const { data: rawActivityLogs, isLoading: isLoadingLogs } = useQuery<ActivityLogItem[]>({
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
      invalidateTodoQueries(queryClient);
      setIsCreateModalOpen(false);
    },
  });

  const updateTodoMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiClient.put(`/todos/${id}`, data),
    onSuccess: () => {
      invalidateTodoQueries(queryClient);
      setIsCreateModalOpen(false);
      setEditingTodo(null);
    },
  });

  const toggleTodoMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/todos/${id}/toggle?date=${selectedDate}`),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['todos-daily', selectedDate] });
      const previous = queryClient.getQueryData<DailyScheduleResponse>(['todos-daily', selectedDate]);
      if (previous && Array.isArray(previous.todos)) {
        const updatedTodos = previous.todos.map((item) => {
          if (item.id === id) {
            const isDone = item.status === 'completed';
            return {
              ...item,
              status: isDone ? ('pending' as const) : ('completed' as const),
            };
          }
          return item;
        });
        const compCount = updatedTodos.filter((it) => it.status === 'completed').length;
        queryClient.setQueryData<DailyScheduleResponse>(['todos-daily', selectedDate], {
          ...previous,
          todos: updatedTodos,
          completed_tasks: compCount,
        });
      }
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['todos-daily', selectedDate], context.previous);
      }
    },
    onSettled: () => {
      invalidateTodoQueries(queryClient);
    },
  });

  const deleteTodoMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/todos/${id}`),
    onSuccess: () => {
      invalidateTodoQueries(queryClient);
      setDeletingTodo(null);
    },
  });

  const deleteActivityLogMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/todos/activity-logs/${id}`),
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

  // 7-day week buttons strip around selectedDate
  const weekDays = useMemo(() => {
    const current = new Date(selectedDate);
    const dayOfWeek = current.getDay(); // 0 is Sun
    const startOfWeek = new Date(current);
    startOfWeek.setDate(current.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const todayStr = toLocalDateKey(new Date());

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const iso = toLocalDateKey(d);
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
        isToday: iso === todayStr,
        isSelected: iso === selectedDate,
      };
    });
  }, [selectedDate, t]);

  const todos = Array.isArray(schedule?.todos) ? schedule.todos : [];
  const completedTasks = schedule?.completed_tasks || 0;
  const totalTasks = schedule?.total_tasks || 0;

  const filteredTodos = useMemo(() => {
    if (taskFilter === 'active') return todos.filter((item) => item.status !== 'completed');
    if (taskFilter === 'completed') return todos.filter((item) => item.status === 'completed');
    return todos;
  }, [todos, taskFilter]);

  const isSelectedToday = toLocalDateKey(new Date()) === selectedDate;

  // View navigation tabs
  const navTabs = useMemo(
    () => [
      {
        id: 'schedule',
        label: t('todo.tasksForDay', { count: todos.length }) || 'Задачи',
        icon: <ListTodo className="w-3.5 h-3.5" />,
        badge: todos.length,
      },
      {
        id: 'calendar',
        label: t('todo.calendar') || 'Календарь',
        icon: <CalendarIcon className="w-3.5 h-3.5" />,
      },
      {
        id: 'history',
        label: t('todo.activityLog') || 'Журнал',
        icon: <History className="w-3.5 h-3.5" />,
        badge: activityLogs.length > 0 ? activityLogs.length : undefined,
      },
    ],
    [todos.length, activityLogs.length, t]
  );

  // Filter tabs for daily view
  const filterTabs = useMemo(
    () => [
      { id: 'all', label: 'Все', badge: todos.length },
      { id: 'active', label: 'Активные', badge: Math.max(0, todos.length - completedTasks) },
      { id: 'completed', label: 'Готовые', badge: completedTasks },
    ],
    [todos.length, completedTasks]
  );

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-12 animate-fade-in">
      {/* 1. Header & Navigation Card */}
      <Card className="bg-dark-900 border-dark-800 rounded-3xl shadow-xl">
        <CardContent className="p-3.5 sm:p-5 space-y-3.5">
          {/* Top Row: Title + Action Buttons */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold shrink-0">
                <ListTodo className="w-4 h-4" />
              </div>
              <h1 className="text-base sm:text-xl font-black text-white tracking-tight truncate">
                {t('todo.title') || 'План и расписание'}
              </h1>
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

          {/* View Mode Tabs (HeroUI Tabs) */}
          <div className="pt-2 border-t border-dark-800/80">
            <Tabs
              tabs={navTabs}
              selectedKey={activeTab}
              onSelectionChange={(key) => setActiveTab(key as ViewTab)}
              size="sm"
            />
          </div>

          {/* Date Selector & 7-Day Strip (Daily & History views) */}
          {activeTab !== 'calendar' && (
            <div className="pt-2.5 border-t border-dark-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="xs"
                  isIconOnly
                  onClick={() => handleShiftDate(-1)}
                  className="text-zinc-300"
                  aria-label="Previous day"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-brand-400" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-dark-800 border border-dark-700 rounded-xl px-2.5 py-1 text-xs text-zinc-100 font-semibold focus:outline-none focus:border-brand-500 cursor-pointer font-mono"
                  />
                </div>

                <Button
                  variant="ghost"
                  size="xs"
                  isIconOnly
                  onClick={() => handleShiftDate(1)}
                  className="text-zinc-300"
                  aria-label="Next day"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>

                <Button
                  variant="outline"
                  size="xs"
                  onClick={handleSetToday}
                  className="text-xs font-semibold"
                >
                  {t('todo.today') || 'Сегодня'}
                </Button>
              </div>

              {/* 7-Day Buttons Strip */}
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                {weekDays.map((wd) => (
                  <button
                    key={wd.iso}
                    onClick={() => setSelectedDate(wd.iso)}
                    className={`flex flex-col items-center py-1.5 px-1 sm:px-2 rounded-xl transition-all cursor-pointer ${
                      wd.isSelected
                        ? 'bg-brand-500 text-dark-950 font-black shadow-md'
                        : wd.isToday
                        ? 'bg-brand-500/15 border border-brand-500/40 text-brand-400 font-bold'
                        : 'bg-dark-800 hover:bg-dark-750 text-zinc-400 hover:text-white border border-dark-700/60'
                    }`}
                  >
                    <span className="text-[9px] uppercase tracking-wider">{wd.dayName}</span>
                    <span className="text-xs sm:text-sm font-bold font-mono">{wd.dayNumber}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. TAB 1: DAILY SCHEDULE VIEW */}
      {activeTab === 'schedule' && (
        <div className="space-y-3.5">
          {/* Day Progress Summary Strip */}
          <TodoDaySummary
            completedTasks={completedTasks}
            totalTasks={totalTasks}
            totalPlannedMinutes={schedule?.total_planned_minutes || 0}
            totalSpentMinutes={schedule?.total_spent_minutes || 0}
          />

          {/* Quick Inline Add Bar */}
          <TodoQuickAdd
            onAdd={handleQuickAdd}
            isLoading={createTodoMutation.isPending}
          />

          {/* Task Filters Tabs */}
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

          {/* Tasks List */}
          {isLoadingDay ? (
            <div className="space-y-2.5">
              <Skeleton className="h-20 w-full" variant="rounded" />
              <Skeleton className="h-20 w-full" variant="rounded" />
              <Skeleton className="h-20 w-full" variant="rounded" />
            </div>
          ) : todos.length === 0 ? (
            <Card className="p-10 text-center bg-dark-900 border-dark-800 space-y-3 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-dark-800 border border-dark-700 flex items-center justify-center mx-auto text-zinc-400">
                <ListTodo className="w-6 h-6" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-zinc-200">
                {t('todo.noTasks', { date: selectedDate }) || `На ${selectedDate} нет запланированных задач.`}
              </h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                {t('todo.noTasksDesc') || 'Создайте задачу или используйте быстрое добавление выше.'}
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
                <span>{t('todo.createFirst') || 'Создать первую задачу'}</span>
              </Button>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {filteredTodos.map((item) => (
                <TodoItemCard
                  key={item.id}
                  item={item}
                  isToday={isSelectedToday}
                  onToggle={(id) => toggleTodoMutation.mutate(id)}
                  onStartFocus={(it) =>
                    startForTodo({
                      todoId: it.id,
                      title: it.title,
                      category: it.category,
                      targetDurationMinutes: it.target_duration_minutes,
                      mode: 'pomodoro',
                    })
                  }
                  onMoveToTomorrow={handleMoveToTomorrow}
                  onEdit={(it) => {
                    setEditingTodo(it);
                    setIsCreateModalOpen(true);
                  }}
                  onDelete={(it) => setDeletingTodo(it)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. TAB 2: INTERACTIVE MONTHLY CALENDAR VIEW */}
      {activeTab === 'calendar' && (
        <TodoMonthCalendar
          calendarDate={calendarDate}
          onCalendarDateChange={setCalendarDate}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          monthTodos={monthSchedule?.todos || []}
          monthLogs={monthLogs}
          dayProgressList={monthSchedule?.day_progress}
          onToggleTodo={(id) => toggleTodoMutation.mutate(id)}
          onStartFocus={(it) =>
            startForTodo({
              todoId: it.id,
              title: it.title,
              category: it.category,
              targetDurationMinutes: it.target_duration_minutes,
              mode: 'pomodoro',
            })
          }
          onEditTodo={(it) => {
            setEditingTodo(it);
            setIsCreateModalOpen(true);
          }}
          onDeleteTodo={(it) => setDeletingTodo(it)}
          onOpenCreateModal={() => {
            setEditingTodo(null);
            setIsCreateModalOpen(true);
          }}
        />
      )}

      {/* 4. TAB 3: ACTIVITY HISTORY VIEW */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {isLoadingLogs ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" variant="rounded" />
              <Skeleton className="h-16 w-full" variant="rounded" />
            </div>
          ) : (
            <TodoActivityLog
              logs={activityLogs}
              selectedDate={selectedDate}
              onDeleteLog={(id) => setDeletingLogId(id)}
            />
          )}
        </div>
      )}

      {/* 5. Create / Edit Task Modal */}
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

      {/* 6. Delete Task Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deletingTodo}
        title="Удалить задачу?"
        description={deletingTodo ? `Вы уверены, что хотите удалить задачу «${deletingTodo.title}»?` : undefined}
        onClose={() => setDeletingTodo(null)}
        onConfirm={() => {
          if (deletingTodo) {
            deleteTodoMutation.mutate(deletingTodo.id);
          }
        }}
        isLoading={deleteTodoMutation.isPending}
      />

      {/* 7. Delete Activity Log Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deletingLogId}
        title="Удалить запись активности?"
        description="Время этой сессии будет списано с соответствующей задачи и дня."
        onClose={() => setDeletingLogId(null)}
        onConfirm={() => {
          if (deletingLogId) {
            deleteActivityLogMutation.mutate(deletingLogId);
          }
        }}
        isLoading={deleteActivityLogMutation.isPending}
      />
    </div>
  );
};

export default TodoCalendarPage;
