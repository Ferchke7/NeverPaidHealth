import { describe, it, expect, beforeEach } from 'vitest';
import { useActiveWorkoutStore, hasProgress, loadInitialState } from './activeWorkoutStore.ts';
import { ActiveWorkout } from './types.ts';

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

// Attach to globalThis
(globalThis as any).window = (globalThis as any).window || {};
(globalThis as any).localStorage = storageMock;
(globalThis as any).window.localStorage = storageMock;

describe('ActiveWorkoutStore', () => {
  beforeEach(() => {
    storageMock.clear();
    useActiveWorkoutStore.getState().discardWorkout();
  });

  it('detects progress correctly with hasProgress', () => {
    expect(hasProgress(null)).toBe(false);

    const emptyWorkout: ActiveWorkout = {
      id: 'w-1',
      name: 'Test',
      startedAt: new Date().toISOString(),
      exercises: [],
    };
    expect(hasProgress(emptyWorkout)).toBe(false);

    const untouchedWorkout: ActiveWorkout = {
      id: 'w-1',
      name: 'Test',
      startedAt: new Date().toISOString(),
      exercises: [
        {
          instanceId: 'inst-1',
          exerciseId: 'ex-1',
          exerciseName: 'Bench Press',
          measurementType: 'weight_reps',
          sets: [
            {
              id: 's-1',
              setNumber: 1,
              setType: 'normal',
              weightKg: 0,
              reps: 10,
              completed: false,
            },
          ],
        },
      ],
    };
    expect(hasProgress(untouchedWorkout)).toBe(false);

    // With weight entered
    const withWeight: ActiveWorkout = {
      ...untouchedWorkout,
      exercises: [
        {
          ...untouchedWorkout.exercises[0],
          sets: [{ ...untouchedWorkout.exercises[0].sets[0], weightKg: 80 }],
        },
      ],
    };
    expect(hasProgress(withWeight)).toBe(true);

    // With completed set
    const withCompleted: ActiveWorkout = {
      ...untouchedWorkout,
      exercises: [
        {
          ...untouchedWorkout.exercises[0],
          sets: [{ ...untouchedWorkout.exercises[0].sets[0], completed: true }],
        },
      ],
    };
    expect(hasProgress(withCompleted)).toBe(true);
  });

  it('supports duplicate exercises with independent instanceIds without sharing sets', () => {
    const store = useActiveWorkoutStore.getState();
    store.startWorkout('w-1', 'Chest Day');

    store.addExercise('bench-1', 'Bench Press', 'weight_reps');
    store.addExercise('bench-1', 'Bench Press', 'weight_reps');

    const workout = useActiveWorkoutStore.getState().workout!;
    expect(workout.exercises.length).toBe(2);
    expect(workout.exercises[0].exerciseId).toBe('bench-1');
    expect(workout.exercises[1].exerciseId).toBe('bench-1');

    const inst0 = workout.exercises[0].instanceId;
    const inst1 = workout.exercises[1].instanceId;
    expect(inst0).toBeDefined();
    expect(inst1).toBeDefined();
    expect(inst0).not.toBe(inst1);

    // Updating a set on the first instance must NOT affect the second instance
    const set0Id = workout.exercises[0].sets[0].id;
    useActiveWorkoutStore.getState().updateSet(inst0, set0Id, { weightKg: 100, completed: true });

    const afterUpdate = useActiveWorkoutStore.getState().workout!;
    expect(afterUpdate.exercises[0].sets[0].weightKg).toBe(100);
    expect(afterUpdate.exercises[0].sets[0].completed).toBe(true);

    expect(afterUpdate.exercises[1].sets[0].weightKg).toBe(0);
    expect(afterUpdate.exercises[1].sets[0].completed).toBe(false);
  });

  it('replaceExercise keeps set count and types, but resets weights, reps, and completed status', () => {
    const store = useActiveWorkoutStore.getState();
    store.startWorkout('w-1', 'Chest Day');
    store.addExercise('bench-1', 'Barbell Bench Press', 'weight_reps');

    const workout = useActiveWorkoutStore.getState().workout!;
    const instId = workout.exercises[0].instanceId;

    // Add a warmup set and update weights
    store.addSet(instId, 'warmup');
    const set0 = useActiveWorkoutStore.getState().workout!.exercises[0].sets[0];
    const set1 = useActiveWorkoutStore.getState().workout!.exercises[0].sets[1];

    store.updateSet(instId, set0.id, { weightKg: 100, reps: 5, completed: true });
    store.updateSet(instId, set1.id, { weightKg: 60, reps: 10, completed: true });

    // Now replace with Dumbbell Press
    useActiveWorkoutStore.getState().replaceExercise(instId, {
      id: 'db-press',
      name: 'Dumbbell Bench Press',
      measurementType: 'weight_reps',
      defaultReps: 12,
    });

    const replaced = useActiveWorkoutStore.getState().workout!.exercises[0];
    expect(replaced.exerciseId).toBe('db-press');
    expect(replaced.exerciseName).toBe('Dumbbell Bench Press');
    expect(replaced.sets.length).toBe(2);

    // Shapes (types) preserved
    expect(replaced.sets[0].setType).toBe('normal');
    expect(replaced.sets[1].setType).toBe('warmup');

    // Values reset
    expect(replaced.sets[0].weightKg).toBe(0);
    expect(replaced.sets[0].reps).toBe(12);
    expect(replaced.sets[0].completed).toBe(false);

    expect(replaced.sets[1].weightKg).toBe(0);
    expect(replaced.sets[1].reps).toBe(12);
    expect(replaced.sets[1].completed).toBe(false);
  });

  it('migrates v1 localStorage format to v2 assigning instanceIds', () => {
    const legacyWorkout = {
      id: 'legacy-w-1',
      name: 'Old Workout',
      startedAt: new Date().toISOString(),
      exercises: [
        {
          exerciseId: 'ex-1',
          exerciseName: 'Squat',
          measurementType: 'weight_reps',
          sets: [
            {
              id: 's-1',
              setNumber: 1,
              setType: 'normal',
              weightKg: 140,
              reps: 5,
              completed: true,
            },
          ],
        },
      ],
    };

    localStorage.setItem('neverpaid_active_workout_v1', JSON.stringify(legacyWorkout));

    const migrated = loadInitialState();
    expect(migrated).not.toBeNull();
    expect(migrated!.id).toBe('legacy-w-1');
    expect(migrated!.exercises[0].instanceId).toBeDefined();
    expect(migrated!.exercises[0].exerciseId).toBe('ex-1');
    expect(migrated!.exercises[0].sets[0].weightKg).toBe(140);

    // Stored in v2
    const rawV2 = localStorage.getItem('neverpaid_active_workout_v2');
    expect(rawV2).not.toBeNull();
  });

  it('corrupted JSON in localStorage is safely discarded without crashing', () => {
    localStorage.setItem('neverpaid_active_workout_v2', '{invalid: json...!!!');
    const result = loadInitialState();
    expect(result).toBeNull();
    expect(localStorage.getItem('neverpaid_active_workout_v2')).toBeNull();
  });

  it('saves exercise notes for next workout as unread and marks them read upon reveal', async () => {
    const { useExerciseNotesStore } = await import('./exerciseNotesStore.ts');
    const store = useActiveWorkoutStore.getState();
    store.startWorkout('w-1', 'Push Day');
    store.addExercise('bench-1', 'Bench Press', 'weight_reps');

    const instId = useActiveWorkoutStore.getState().workout!.exercises[0].instanceId;
    store.updateExerciseNotes(instId, 'Узкий хват, локти 45 градусов, в следующий раз 85 кг');

    expect(useActiveWorkoutStore.getState().workout!.exercises[0].notes).toBe(
      'Узкий хват, локти 45 градусов, в следующий раз 85 кг'
    );

    const notesStore = useExerciseNotesStore.getState();
    notesStore.saveNoteForNextWorkout(
      ['bench-1', 'bench press'],
      'Узкий хват, локти 45 градусов, в следующий раз 85 кг',
      'w-1',
      'Push Day'
    );

    // Must be unread initially on the next workout
    expect(
      useExerciseNotesStore
        .getState()
        .isNoteUnread(['bench-1', 'bench press'], 'Узкий хват, локти 45 градусов, в следующий раз 85 кг')
    ).toBe(true);

    // Once user expands the note, markNoteAsRead clears unread glow
    useExerciseNotesStore
      .getState()
      .markNoteAsRead(['bench-1', 'bench press'], 'Узкий хват, локти 45 градусов, в следующий раз 85 кг');

    expect(
      useExerciseNotesStore
        .getState()
        .isNoteUnread(['bench-1', 'bench press'], 'Узкий хват, локти 45 градусов, в следующий раз 85 кг')
    ).toBe(false);
  });
});

