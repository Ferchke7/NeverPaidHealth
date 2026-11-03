import {
  TodoItem,
  DailyScheduleResponse,
  ActivityLogItem,
  TodoCategory,
  TodoPriority,
} from '../model/types.ts';
import { generateUUID } from '../../../shared/lib/uuid.ts';
import { apiClient } from '../../../shared/api/client.ts';
import { toLocalDateKey } from '../../../shared/lib/dates.ts';

const TODOS_STORAGE_KEY = 'neverpaid_todos_v2';
const LOGS_STORAGE_KEY = 'neverpaid_activity_logs_v2';
const PROGRESS_STORAGE_KEY = 'neverpaid_todo_progress_v2';

interface DayProgressRecord {
  [todoIdAndDate: string]: {
    completed: boolean;
    completed_at?: string;
  };
}

const DEFAULT_TODOS: Array<Omit<TodoItem, 'id' | 'created_at' | 'updated_at'>> = [
  {
    user_id: 'local-user',
    title: 'Выпить 500 мл воды с электролитами',
    description: 'Утренний гидратационный ритуал для активации метаболизма и ЦНС',
    category: 'health',
    priority: 'high',
    event_type: 'habit',
    start_date: toLocalDateKey(new Date()),
    end_date: toLocalDateKey(new Date()),
    start_time: '07:30',
    target_duration_minutes: 5,
    total_spent_minutes: 0,
    status: 'pending',
  },
  {
    user_id: 'local-user',
    title: 'Силовая тренировка по программе',
    description: 'Выполнить все рабочие подходы с прогрессией нагрузки',
    category: 'workout',
    priority: 'high',
    event_type: 'routine',
    start_date: toLocalDateKey(new Date()),
    end_date: toLocalDateKey(new Date()),
    start_time: '18:00',
    target_duration_minutes: 60,
    total_spent_minutes: 0,
    status: 'pending',
  },
  {
    user_id: 'local-user',
    title: 'Белковый приём пищи (40г+ белка)',
    description: 'Оптимизация синтеза мышечного белка после тренировки',
    category: 'health',
    priority: 'medium',
    event_type: 'habit',
    start_date: toLocalDateKey(new Date()),
    end_date: toLocalDateKey(new Date()),
    start_time: '19:30',
    target_duration_minutes: 20,
    total_spent_minutes: 0,
    status: 'pending',
  },
  {
    user_id: 'local-user',
    title: 'Прогулка 8 000 – 10 000 шагов (NEAT)',
    description: 'Восстановление сердечно-сосудистой системы и сжигание калорий',
    category: 'health',
    priority: 'medium',
    event_type: 'routine',
    start_date: toLocalDateKey(new Date()),
    end_date: toLocalDateKey(new Date()),
    start_time: '20:30',
    target_duration_minutes: 45,
    total_spent_minutes: 0,
    status: 'pending',
  },
  {
    user_id: 'local-user',
    title: 'Сон 8 часов (глубокая фаза восстановления)',
    description: 'Отбой в прохладной тёмной комнате без экранов за 30 мин до сна',
    category: 'health',
    priority: 'urgent',
    event_type: 'habit',
    start_date: toLocalDateKey(new Date()),
    end_date: toLocalDateKey(new Date()),
    start_time: '23:00',
    target_duration_minutes: 480,
    total_spent_minutes: 0,
    status: 'pending',
  },
];

function loadStoredTodos(): TodoItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TODOS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }

  // Initialize with seed todos
  const nowIso = new Date().toISOString();
  const seeded: TodoItem[] = DEFAULT_TODOS.map((def) => ({
    ...def,
    id: generateUUID(),
    created_at: nowIso,
    updated_at: nowIso,
  }));
  saveStoredTodos(seeded);
  return seeded;
}

function saveStoredTodos(todos: TodoItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TODOS_STORAGE_KEY, JSON.stringify(todos));
  } catch {
    // ignore
  }
}

function loadStoredLogs(): ActivityLogItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // fallback
  }
  return [];
}

function saveStoredLogs(logs: ActivityLogItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs));
  } catch {
    // ignore
  }
}

function loadProgressMap(): DayProgressRecord {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // fallback
  }
  return {};
}

function saveProgressMap(map: DayProgressRecord) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export const todoStorage = {
  getDailySchedule(dateStr: string): DailyScheduleResponse {
    const allTodos = loadStoredTodos();
    const progressMap = loadProgressMap();
    const allLogs = loadStoredLogs();

    // Map each todo's completion status for this specific date
    const dayTodos = allTodos.map((t) => {
      const key = `${t.id}_${dateStr}`;
      const record = progressMap[key];
      const isDone = record ? record.completed : t.start_date === dateStr ? t.status === 'completed' : false;

      return {
        ...t,
        status: isDone ? ('completed' as const) : ('pending' as const),
        completed_at: record?.completed_at,
      };
    });

    const completedCount = dayTodos.filter((t) => t.status === 'completed').length;
    const totalPlannedMins = dayTodos.reduce((sum, t) => sum + (t.target_duration_minutes || 0), 0);
    const dayLogs = allLogs.filter((l) => l.log_date === dateStr || l.started_at?.startsWith(dateStr));
    const totalSpentMins = dayLogs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0);

    return {
      date: dateStr,
      total_tasks: dayTodos.length,
      completed_tasks: completedCount,
      total_planned_minutes: totalPlannedMins,
      total_spent_minutes: totalSpentMins,
      todos: dayTodos,
      recent_logs: dayLogs,
    };
  },

  createTodo(payload: {
    title: string;
    description?: string;
    category?: TodoCategory;
    priority?: TodoPriority;
    target_duration_minutes?: number;
    start_date?: string;
    end_date?: string;
    start_time?: string;
  }): TodoItem {
    const allTodos = loadStoredTodos();
    const nowIso = new Date().toISOString();
    const dateStr = payload.start_date || toLocalDateKey(new Date());

    const newTodo: TodoItem = {
      id: generateUUID(),
      user_id: 'local-user',
      title: payload.title.trim(),
      description: payload.description?.trim() || '',
      category: payload.category || 'workout',
      priority: payload.priority || 'medium',
      event_type: 'task',
      start_date: dateStr,
      end_date: payload.end_date || dateStr,
      start_time: payload.start_time,
      target_duration_minutes: Number(payload.target_duration_minutes) || 25,
      total_spent_minutes: 0,
      status: 'pending',
      created_at: nowIso,
      updated_at: nowIso,
    };

    allTodos.unshift(newTodo);
    saveStoredTodos(allTodos);

    // Background sync to backend if online
    apiClient.post('/todos', newTodo).catch(() => {});

    return newTodo;
  },

  toggleTodo(id: string, dateStr: string): { completed: boolean; todo: TodoItem | null } {
    const allTodos = loadStoredTodos();
    const target = allTodos.find((t) => t.id === id);
    if (!target) return { completed: false, todo: null };

    const progressMap = loadProgressMap();
    const key = `${id}_${dateStr}`;
    const wasCompleted = progressMap[key] ? progressMap[key].completed : target.status === 'completed';
    const nowCompleted = !wasCompleted;

    const nowIso = new Date().toISOString();
    progressMap[key] = {
      completed: nowCompleted,
      completed_at: nowCompleted ? nowIso : undefined,
    };
    saveProgressMap(progressMap);

    // If marked completed, append to activity log
    const logs = loadStoredLogs();
    if (nowCompleted) {
      logs.unshift({
        id: generateUUID(),
        user_id: 'local-user',
        todo_id: target.id,
        task_title: target.title,
        category: target.category,
        log_date: dateStr,
        started_at: nowIso,
        ended_at: nowIso,
        duration_minutes: target.target_duration_minutes || 15,
        session_type: 'task_completed',
        created_at: nowIso,
      });
    } else {
      // Remove the latest log for this task on this date
      const idx = logs.findIndex((l) => l.todo_id === id && (l.log_date === dateStr || l.started_at.startsWith(dateStr)));
      if (idx !== -1) logs.splice(idx, 1);
    }
    saveStoredLogs(logs);

    // Background sync to backend if online
    apiClient.post(`/todos/${id}/toggle?date=${dateStr}`).catch(() => {});

    return {
      completed: nowCompleted,
      todo: { ...target, status: nowCompleted ? 'completed' : 'pending' },
    };
  },

  updateTodo(
    id: string,
    data: Partial<Omit<TodoItem, 'id' | 'created_at' | 'updated_at'>>
  ): TodoItem | null {
    const allTodos = loadStoredTodos();
    const idx = allTodos.findIndex((t) => t.id === id);
    if (idx === -1) return null;

    const updated: TodoItem = {
      ...allTodos[idx],
      ...data,
      updated_at: new Date().toISOString(),
    };
    allTodos[idx] = updated;
    saveStoredTodos(allTodos);

    // Background sync
    apiClient.put(`/todos/${id}`, data).catch(() => {});

    return updated;
  },

  deleteTodo(id: string): boolean {
    const allTodos = loadStoredTodos();
    const filtered = allTodos.filter((t) => t.id !== id);
    if (filtered.length === allTodos.length) return false;

    saveStoredTodos(filtered);

    // Background sync
    apiClient.delete(`/todos/${id}`).catch(() => {});

    return true;
  },

  getActivityLogs(dateStr?: string): ActivityLogItem[] {
    const logs = loadStoredLogs();
    if (!dateStr) return logs;
    return logs.filter((l) => l.log_date === dateStr || l.started_at?.startsWith(dateStr));
  },

  deleteActivityLog(id: string): boolean {
    const logs = loadStoredLogs();
    const filtered = logs.filter((l) => l.id !== id);
    saveStoredLogs(filtered);

    // Background sync
    apiClient.delete(`/todos/activity-logs/${id}`).catch(() => {});

    return true;
  },
};
