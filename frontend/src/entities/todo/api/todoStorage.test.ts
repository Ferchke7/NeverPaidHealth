import { describe, it, expect, beforeEach } from 'vitest';
import { todoStorage } from './todoStorage.ts';

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
});
