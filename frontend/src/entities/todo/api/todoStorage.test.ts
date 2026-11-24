import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { todoStorage } from './todoStorage.ts';
import { apiClient } from '../../../shared/api/client.ts';
import { useAuthStore } from '../../user/model/authStore.ts';

// In-memory mock for localStorage in node environment
const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

(globalThis as any).window = (globalThis as any).window || {};
(globalThis as any).localStorage = storageMock;
(globalThis as any).window.localStorage = storageMock;

describe('todoStorage offline-first persistence', () => {
  beforeEach(() => {
    storageMock.clear();
    useAuthStore.setState({ isAuthenticated: false, user: null, accessToken: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({ isAuthenticated: false, user: null, accessToken: null });
  });

  it('initializes with seed tasks when empty', () => {
    const schedule = todoStorage.getDailySchedule('2026-11-06');
    expect(schedule.total_tasks).toBeGreaterThan(0);
    expect(schedule.todos.length).toBeGreaterThan(0);
  });

  it('creates a new task and persists it', () => {
    const item = todoStorage.createTodo({
      title: 'Buy Creatine Monohydrate',
      category: 'health',
      priority: 'high',
      start_date: '2026-11-06',
      target_duration_minutes: 10,
    });

    expect(item.id).toBeDefined();
    expect(item.title).toBe('Buy Creatine Monohydrate');

    const schedule = todoStorage.getDailySchedule('2026-11-06');
    const found = schedule.todos.find((t) => t.id === item.id);
    expect(found).toBeDefined();
    expect(found?.title).toBe('Buy Creatine Monohydrate');
  });

  it('throws an error if creating with an empty title', () => {
    expect(() => {
      todoStorage.createTodo({
        title: '   ',
      });
    }).toThrow('Title cannot be empty');
  });

  it('toggles task completion and creates activity log', () => {
    const item = todoStorage.createTodo({
      title: 'Post-workout stretching',
      start_date: '2026-11-06',
    });

    const toggleRes = todoStorage.toggleTodo(item.id, '2026-11-06');
    expect(toggleRes.completed).toBe(true);

    const logs = todoStorage.getActivityLogs('2026-11-06');
    const log = logs.find((l) => l.todo_id === item.id);
    expect(log).toBeDefined();
    expect(log?.session_type).toBe('task_completed');

    // Toggle back
    const untoggleRes = todoStorage.toggleTodo(item.id, '2026-11-06');
    expect(untoggleRes.completed).toBe(false);
  });

  it('deletes a task successfully', () => {
    const item = todoStorage.createTodo({
      title: 'Task to delete',
      start_date: '2026-11-06',
    });

    const deleted = todoStorage.deleteTodo(item.id);
    expect(deleted).toBe(true);

    const schedule = todoStorage.getDailySchedule('2026-11-06');
    const found = schedule.todos.find((t) => t.id === item.id);
    expect(found).toBeUndefined();
  });

  it('uses authoritative server ID on createTodoAndSync and calls backend for server-only tasks', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'user-111', email: 'athlete@duda.uz', name: 'Athlete' } as any,
      accessToken: 'jwt-token',
    });

    const serverTodo = {
      id: '99999999-9999-4999-8999-999999999999',
      user_id: 'user-111',
      title: 'Synced Task',
      description: '',
      category: 'work' as const,
      priority: 'medium' as const,
      event_type: 'task' as const,
      start_date: '2026-11-24',
      end_date: '2026-11-24',
      target_duration_minutes: 25,
      total_spent_minutes: 0,
      status: 'pending' as const,
      created_at: '2026-11-24T10:00:00Z',
      updated_at: '2026-11-24T10:00:00Z',
    };

    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(serverTodo);
    const created = await todoStorage.createTodoAndSync({
      title: 'Synced Task',
      category: 'work',
      start_date: '2026-11-24',
    });
    expect(created.id).toBe(serverTodo.id);
    expect(postSpy).toHaveBeenCalledWith('/todos', expect.objectContaining({ title: 'Synced Task' }));

    const remoteOnlyId = '88888888-8888-4888-8888-888888888888';
    const delSpy = vi.spyOn(apiClient, 'delete').mockResolvedValueOnce(null);
    const deleted = await todoStorage.deleteTodoAndSync(remoteOnlyId);
    expect(deleted).toBe(true);
    expect(delSpy).toHaveBeenCalledWith(`/todos/${remoteOnlyId}`);
  });
});
