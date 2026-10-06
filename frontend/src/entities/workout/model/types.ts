export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';

export interface ActiveSet {
  id: string;
  setNumber: number;
  setType: SetType;
  weightKg: number;
  reps: number;
  rpe?: number;
  durationSeconds?: number;
  completed: boolean;
}

export interface ActiveExercise {
  exerciseId: string;
  exerciseName: string;
  measurementType: string;
  sets: ActiveSet[];
}

export interface ActiveWorkout {
  id: string;
  name: string;
  routineId?: string;
  startedAt: string;
  exercises: ActiveExercise[];
}

export interface WorkoutHistoryItem {
  id: string;
  name: string;
  status: string;
  started_at: string;
  finished_at?: string;
  total_volume_kg?: number;
  completed_sets_count?: number;
  duration_seconds?: number;
  exercises: {
    exercise_id: string;
    exercise_name: string;
    sets: {
      id: string;
      set_number: number;
      set_type: SetType;
      weight_kg: number;
      reps: number;
      completed: boolean;
    }[];
  }[];
}
