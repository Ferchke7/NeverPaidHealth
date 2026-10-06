import { create } from 'zustand';
import { ActiveWorkout, ActiveExercise, ActiveSet, SetType } from './types.ts';
import { generateUUID } from '../../../shared/lib/uuid.ts';

const STORAGE_KEY = 'neverpaid_active_workout_v1';

interface ActiveWorkoutState {
  workout: ActiveWorkout | null;
  isOpen: boolean;
  startWorkout: (id: string, name: string, routineId?: string, initialExercises?: ActiveExercise[]) => void;
  openSheet: () => void;
  closeSheet: () => void;
  addExercise: (exerciseId: string, exerciseName: string, measurementType: string) => void;
  replaceExercise: (oldExerciseId: string, newExerciseId: string, newExerciseName: string, measurementType: string) => void;
  removeExercise: (exerciseId: string) => void;
  addSet: (exerciseId: string, setType?: SetType) => void;
  updateSet: (exerciseId: string, setId: string, updates: Partial<ActiveSet>) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  finishWorkoutLocal: () => void;
  discardWorkout: () => void;
  calculateLiveVolume: () => number;
}

function loadInitialState(): ActiveWorkout | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore parse error
  }
  return null;
}

function persistState(workout: ActiveWorkout | null) {
  try {
    if (workout) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workout));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota error
  }
}

export const useActiveWorkoutStore = create<ActiveWorkoutState>((set, get) => ({
  workout: loadInitialState(),
  isOpen: false,

  startWorkout: (id, name, routineId, initialExercises = []) => {
    const newWorkout: ActiveWorkout = {
      id,
      name,
      routineId,
      startedAt: new Date().toISOString(),
      exercises: initialExercises,
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
        exerciseId,
        exerciseName,
        measurementType,
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

  replaceExercise: (oldExerciseId, newExerciseId, newExerciseName, measurementType) => {
    set((state) => {
      if (!state.workout) return state;
      const updatedExercises = state.workout.exercises.map((ex) => {
        if (ex.exerciseId !== oldExerciseId) return ex;
        return {
          ...ex,
          exerciseId: newExerciseId,
          exerciseName: newExerciseName,
          measurementType: measurementType || ex.measurementType,
        };
      });
      const updated = { ...state.workout, exercises: updatedExercises };
      persistState(updated);
      return { workout: updated };
    });
  },

  removeExercise: (exerciseId) => {
    set((state) => {
      if (!state.workout) return state;
      const updated = {
        ...state.workout,
        exercises: state.workout.exercises.filter((ex) => ex.exerciseId !== exerciseId),
      };
      persistState(updated);
      return { workout: updated };
    });
  },

  addSet: (exerciseId, setType = 'normal') => {
    set((state) => {
      if (!state.workout) return state;

      const updatedExercises = state.workout.exercises.map((ex) => {
        if (ex.exerciseId !== exerciseId) return ex;

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

  updateSet: (exerciseId, setId, updates) => {
    set((state) => {
      if (!state.workout) return state;

      const updatedExercises = state.workout.exercises.map((ex) => {
        if (ex.exerciseId !== exerciseId) return ex;

        const updatedSets = ex.sets.map((s) => (s.id === setId ? { ...s, ...updates } : s));
        return { ...ex, sets: updatedSets };
      });

      const updated = { ...state.workout, exercises: updatedExercises };
      persistState(updated);
      return { workout: updated };
    });
  },

  removeSet: (exerciseId, setId) => {
    set((state) => {
      if (!state.workout) return state;

      const updatedExercises = state.workout.exercises.map((ex) => {
        if (ex.exerciseId !== exerciseId) return ex;
        const filtered = ex.sets.filter((s) => s.id !== setId);
        const renumbered = filtered.map((s, idx) => ({ ...s, setNumber: idx + 1 }));
        return { ...ex, sets: renumbered };
      });

      const updated = { ...state.workout, exercises: updatedExercises };
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
