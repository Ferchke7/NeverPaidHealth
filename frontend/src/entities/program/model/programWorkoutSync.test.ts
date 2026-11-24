import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  syncProgramAndRoutineFromWorkout,
  resetSyncStateForTests,
  saveProgramOverride,
  applyProgramOverride,
} from './programWorkoutSync.ts';
import { useActiveWorkoutStore } from '../../workout/model/activeWorkoutStore.ts';
import { apiClient } from '../../../shared/api/client.ts';

vi.mock('../../../shared/api/client.ts', () => ({
  apiClient: vi.fn(),
}));

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

describe('programWorkoutSync', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    storageMock.clear();
    useActiveWorkoutStore.getState().discardWorkout();
    resetSyncStateForTests();
    vi.clearAllMocks();
    queryClient = new QueryClient();
  });

  it('uses PUT /routines/{id}, serializes forks once, and rebinds active workout routineId', async () => {
    const sysId = 'e1111111-1111-1111-1111-111111111101';
    const personalId = 'aaaaaaaa-1111-4111-8111-111111111111';

    queryClient.setQueryData(
      ['routines'],
      [
        {
          id: sysId,
          user_id: '00000000-0000-0000-0000-000000000000',
          name: 'Jeff Nippard PPL: Push 1 (Chest Focus)',
          notes: 'Preserved note',
          exercises: [],
        },
      ]
    );

    useActiveWorkoutStore.getState().startWorkout(
      'w-1',
      'Jeff Nippard PPL: Push 1 (Chest Focus)',
      sysId,
      [
        {
          instanceId: 'inst-1',
          exerciseId: '70000000-0000-0000-0000-000000000007',
          exerciseName: 'EZ Bar Tricep Extension',
          measurementType: 'weight_reps',
          sets: [{ id: 's-1', setNumber: 1, setType: 'normal', weightKg: 25, reps: 10, completed: true }],
        },
      ]
    );

    const calls: Array<{ url: string; method: string; body: any }> = [];
    vi.mocked(apiClient).mockImplementation(async (url: string, init?: RequestInit) => {
      const parsedBody = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method: init?.method || 'GET', body: parsedBody });
      return {
        id: personalId,
        user_id: 'user-1',
        name: parsedBody.name,
        notes: 'Preserved note',
        exercises: parsedBody.exercises,
      };
    });

    const initialWorkout = useActiveWorkoutStore.getState().workout!;
    // Simulate two concurrent syncs fired before the first response returns (both capture stale sysId)
    await Promise.all([
      syncProgramAndRoutineFromWorkout(initialWorkout, queryClient),
      syncProgramAndRoutineFromWorkout(
        {
          ...initialWorkout,
          exercises: [
            {
              ...initialWorkout.exercises[0],
              exerciseId: '70000000-0000-0000-0000-000000000008',
              exerciseName: 'Close-Grip Dumbbell Press',
            },
          ],
        },
        queryClient
      ),
    ]);

    expect(calls).toHaveLength(2);
    expect(calls[0].method).toBe('PUT');
    expect(calls[0].url).toBe(`/routines/${sysId}`);
    expect(calls[0].body.notes).toBeUndefined();
    expect(calls[1].method).toBe('PUT');
    expect(calls[1].url).toBe(`/routines/${personalId}`);
    expect(useActiveWorkoutStore.getState().workout?.routineId).toBe(personalId);

    const cached = queryClient.getQueryData<any[]>(['routines']) || [];
    const personalRoutines = cached.filter((r) => r.user_id !== '00000000-0000-0000-0000-000000000000');
    expect(personalRoutines).toHaveLength(1);
    expect(personalRoutines[0].id).toBe(personalId);
    expect(personalRoutines[0].exercises[0].exercise_name).toBe('Close-Grip Dumbbell Press');
  });

  it('prefers fresher server program over stale localStorage override', () => {
    const staleOverride: any = {
      id: 'prog-1',
      name: 'Jeff Nippard PPL',
      split_type: 'ppl',
      days_per_week: 6,
      level: 'advanced',
      is_public: false,
      likes_count: 0,
      installs_count: 0,
      days: [{ day_number: 1, name: 'Stale Day', exercises: [] }],
    };
    saveProgramOverride(staleOverride);

    // Simulate newer server response 10 seconds later
    const futureIso = new Date(Date.now() + 10_000).toISOString();
    const freshServerProgram: any = {
      ...staleOverride,
      updated_at: futureIso,
      days: [{ day_number: 1, name: 'Fresh Web Day', exercises: [] }],
    };

    const resolved = applyProgramOverride(freshServerProgram);
    expect(resolved?.days[0].name).toBe('Fresh Web Day');
  });
});
