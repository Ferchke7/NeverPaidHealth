import { create } from 'zustand';
import { ActiveWorkout, ActiveExercise, ActiveSet, SetType } from './types.ts';
import { generateUUID } from '../../../shared/lib/uuid.ts';

const STORAGE_KEY = 'neverpaid_active_workout_v2';
const LEGACY_STORAGE_KEY = 'neverpaid_active_workout_v1';

export interface ReplaceExercisePayload {
  id: string;
  name: string;
  measurementType?: string;
  defaultReps?: number;
}

interface ActiveWorkoutState {
  workout: ActiveWorkout | null;
  isOpen: boolean;
  startWorkout: (id: string, name: string, routineId?: string, initialExercises?: ActiveExercise[]) => void;
  openSheet: () => void;
  closeSheet: () => void;
  addExercise: (exerciseId: string, exerciseName: string, measurementType: string) => void;
  replaceExercise: (
    identifier: string,
    newExerciseOrId: ReplaceExercisePayload | string,
    newExerciseName?: string,
    measurementType?: string
  ) => void;
  removeExercise: (identifier: string) => void;
  addSet: (identifier: string, setType?: SetType) => void;
  updateSet: (identifier: string, setId: string, updates: Partial<ActiveSet>) => void;
  removeSet: (identifier: string, setId: string) => void;
  updateExerciseNotes: (identifier: string, notes: string) => void;
  updateWorkoutNotes: (notes: string) => void;
  finishWorkoutLocal: () => void;
  discardWorkout: () => void;
  calculateLiveVolume: () => number;
}

export function hasProgress(workout: ActiveWorkout | null): boolean {
  if (!workout) return false;
  if (!workout.exercises || workout.exercises.length === 0) return false;
  for (const ex of workout.exercises) {
    for (const s of ex.sets) {
      if (s.completed || s.weightKg > 0 || (s.reps > 0 && s.reps !== 10) || (s.durationSeconds && s.durationSeconds > 0)) {
        return true;
      }
    }
  }
  return false;
}

export function loadInitialState(): ActiveWorkout | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  // 1. Check v2 storage
  try {
    const rawV2 = localStorage.getItem(STORAGE_KEY);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.exercises)) {
        // Ensure each exercise has an instanceId
        const migratedExercises: ActiveExercise[] = parsed.exercises.map((ex: any) => ({
          ...ex,
          instanceId: ex.instanceId || generateUUID(),
        }));
        return { ...parsed, exercises: migratedExercises };
      }
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }

  // 2. Check legacy v1 storage
  try {
    const rawV1 = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (rawV1) {
      const parsed = JSON.parse(rawV1);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.exercises)) {
        const migratedExercises: ActiveExercise[] = parsed.exercises.map((ex: any) => ({
          ...ex,
          instanceId: ex.instanceId || generateUUID(),
        }));
        const migratedWorkout: ActiveWorkout = { ...parsed, exercises: migratedExercises };
        // Save to v2
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedWorkout));
        return migratedWorkout;
      }
    }
  } catch {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }

  return null;
}

function persistState(workout: ActiveWorkout | null) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    if (workout) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workout));
    } else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota or permission errors
  }
}

export const useActiveWorkoutStore = create<ActiveWorkoutState>((set, get) => ({
  workout: loadInitialState(),
  isOpen: false,

  startWorkout: (id, name, routineId, initialExercises = []) => {
    const sanitizedExercises: ActiveExercise[] = initialExercises.map((ex) => ({
      ...ex,
      instanceId: ex.instanceId || generateUUID(),
    }));

    const newWorkout: ActiveWorkout = {
      id,
      name,
      routineId,
      startedAt: new Date().toISOString(),
      exercises: sanitizedExercises,
    };
    persistState(newWorkout);
    set({ workout: newWorkout, isOpen: true });
  },

  openSheet: () => set({ isOpen: true }),
  closeSheet: () => set({ isOpen: false }),

  addExercise: (exerciseId, exerciseName, measurementType) => {
    set((state) => {
      if (!state.workout) return state;

      const newEx: ActiveExercise = {
        instanceId: generateUUID(),
        exerciseId,
        exerciseName,
        measurementType: measurementType || 'weight_reps',
        sets: [
          {
            id: generateUUID(),
            setNumber: 1,
            setType: 'normal',
            weightKg: 0,
            reps: 10,
            completed: false,
          },
        ],
      };

      const updated = {
        ...state.workout,
        exercises: [...state.workout.exercises, newEx],
      };
      persistState(updated);
      return { workout: updated };
    });
  },

  replaceExercise: (identifier, newExerciseOrId, newExerciseName, measurementType) => {
    set((state) => {
      if (!state.workout) return state;

      let nextID: string;
      let nextName: string;
      let nextMeas: string;
      let defaultReps = 10;

      if (typeof newExerciseOrId === 'object') {
        nextID = newExerciseOrId.id;
        nextName = newExerciseOrId.name;
        nextMeas = newExerciseOrId.measurementType || 'weight_reps';
        if (newExerciseOrId.defaultReps && newExerciseOrId.defaultReps > 0) {
          defaultReps = newExerciseOrId.defaultReps;
        }
      } else {
        nextID = newExerciseOrId;
        nextName = newExerciseName || 'Exercise';
        nextMeas = measurementType || 'weight_reps';
      }

      const updatedExercises = state.workout.exercises.map((ex) => {
        const matches = ex.instanceId === identifier || ex.exerciseId === identifier;
        if (!matches) return ex;

        // Keep the shape (number of sets and set types), but reset values
        const resetSets: ActiveSet[] = ex.sets.map((st, i) => ({
          id: generateUUID(),
          setNumber: i + 1,
          setType: st.setType,
          weightKg: 0,
          reps: defaultReps,
          completed: false,
        }));

        const fallbackSets: ActiveSet[] = [
          {
            id: generateUUID(),
            setNumber: 1,
            setType: 'normal',
            weightKg: 0,
            reps: defaultReps,
            completed: false,
          },
        ];

        return {
          ...ex,
          exerciseId: nextID,
          exerciseName: nextName,
          measurementType: nextMeas,
          sets: resetSets.length > 0 ? resetSets : fallbackSets,
        };
      });

      const updated = { ...state.workout, exercises: updatedExercises };
      persistState(updated);
      return { workout: updated };
    });
  },

  removeExercise: (identifier) => {
    set((state) => {
      if (!state.workout) return state;
      const updated = {
        ...state.workout,
        exercises: state.workout.exercises.filter(
          (ex) => ex.instanceId !== identifier && ex.exerciseId !== identifier
        ),
      };
      persistState(updated);
      return { workout: updated };
    });
  },

  addSet: (identifier, setType = 'normal') => {
    set((state) => {
      if (!state.workout) return state;

      const updatedExercises = state.workout.exercises.map((ex) => {
        if (ex.instanceId !== identifier && ex.exerciseId !== identifier) return ex;

        const lastSet = ex.sets[ex.sets.length - 1];
        const newSet: ActiveSet = {
          id: generateUUID(),
          setNumber: ex.sets.length + 1,
          setType,
          weightKg: lastSet ? lastSet.weightKg : 0,
          reps: lastSet ? lastSet.reps : 10,
          completed: false,
        };

        return { ...ex, sets: [...ex.sets, newSet] };
      });

      const updated = { ...state.workout, exercises: updatedExercises };
      persistState(updated);
      return { workout: updated };
    });
  },

  updateSet: (identifier, setId, updates) => {
    set((state) => {
      if (!state.workout) return state;

      const updatedExercises = state.workout.exercises.map((ex) => {
        if (ex.instanceId !== identifier && ex.exerciseId !== identifier) return ex;

        const updatedSets = ex.sets.map((s) => (s.id === setId ? { ...s, ...updates } : s));
        return { ...ex, sets: updatedSets };
      });

      const updated = { ...state.workout, exercises: updatedExercises };
      persistState(updated);
      return { workout: updated };
    });
  },

  removeSet: (identifier, setId) => {
    set((state) => {
      if (!state.workout) return state;

      const updatedExercises = state.workout.exercises.map((ex) => {
        if (ex.instanceId !== identifier && ex.exerciseId !== identifier) return ex;
        const filtered = ex.sets.filter((s) => s.id !== setId);
        const renumbered = filtered.map((s, idx) => ({ ...s, setNumber: idx + 1 }));
        return { ...ex, sets: renumbered };
      });

      const updated = { ...state.workout, exercises: updatedExercises };
      persistState(updated);
      return { workout: updated };
    });
  },

  updateExerciseNotes: (identifier, notes) => {
    set((state) => {
      if (!state.workout) return state;

      const updatedExercises = state.workout.exercises.map((ex) => {
        if (ex.instanceId !== identifier && ex.exerciseId !== identifier) return ex;
        return { ...ex, notes };
      });

      const updated = { ...state.workout, exercises: updatedExercises };
      persistState(updated);
      return { workout: updated };
    });
  },

  updateWorkoutNotes: (notes) => {
    set((state) => {
      if (!state.workout) return state;
      const updated = { ...state.workout, workoutNotes: notes };
      persistState(updated);
      return { workout: updated };
    });
  },

  finishWorkoutLocal: () => {
    persistState(null);
    set({ workout: null, isOpen: false });
  },

  discardWorkout: () => {
    persistState(null);
    set({ workout: null, isOpen: false });
  },

  calculateLiveVolume: () => {
    const w = get().workout;
    if (!w) return 0;

    let total = 0;
    for (const ex of w.exercises) {
      for (const s of ex.sets) {
        if (s.completed && s.setType !== 'warmup') {
          total += s.weightKg * s.reps;
        }
      }
    }
    return Math.round(total * 10) / 10;
  },
}));

// Cross-tab synchronization
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY || e.key === LEGACY_STORAGE_KEY) {
      const nextWorkout = loadInitialState();
      useActiveWorkoutStore.setState({ workout: nextWorkout });
    }
  });
}
