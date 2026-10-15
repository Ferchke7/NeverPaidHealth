import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { useActiveWorkoutStore, hasProgress } from '../../../entities/workout/model/activeWorkoutStore.ts';
import { ActiveExercise, ActiveSet } from '../../../entities/workout/model/types.ts';
import { generateUUID } from '../../../shared/lib/uuid.ts';
import { apiClient } from '../../../shared/api/client.ts';

export interface ExerciseDraft {
  exercise_id?: string;
  exerciseId?: string;
  id?: string;
  exercise_name?: string;
  exerciseName?: string;
  name?: string;
  measurement_type?: string;
  measurementType?: string;
  target_sets?: number;
  targetSets?: number;
  target_reps_min?: number;
  targetRepsMin?: number;
  sets?: ActiveSet[];
}

export interface WorkoutDraft {
  name: string;
  routineId?: string;
  exercises?: ExerciseDraft[];
}

export function useStartWorkout() {
  const { t } = useTranslation();
  const activeWorkout = useActiveWorkoutStore((s) => s.workout);
  const startWorkout = useActiveWorkoutStore((s) => s.startWorkout);
  const openSheet = useActiveWorkoutStore((s) => s.openSheet);

  return async (draft: WorkoutDraft) => {
    if (activeWorkout && hasProgress(activeWorkout)) {
      const confirmed = window.confirm(
        t('workouts.discardActiveConfirm', {
          name: activeWorkout.name,
          routine: draft.name,
        })
      );
      if (!confirmed) {
        openSheet();
        return;
      }
    }

    const initialExercises: ActiveExercise[] = (draft.exercises || []).map((ex, idx) => {
      const exerciseId =
        ex.exercise_id && ex.exercise_id !== '00000000-0000-0000-0000-000000000000'
          ? ex.exercise_id
          : ex.exerciseId || ex.id || generateUUID();
      const setsCount = Math.max(1, ex.target_sets || ex.targetSets || (ex.sets ? ex.sets.length : 3));
      const defaultReps = ex.target_reps_min || ex.targetRepsMin || 10;

      const sets: ActiveSet[] = ex.sets && ex.sets.length > 0
        ? ex.sets.map((s, i) => ({
            ...s,
            id: generateUUID(),
            setNumber: i + 1,
            completed: false, // New session starts with sets uncompleted
          }))
        : Array.from({ length: setsCount }, (_, i) => ({
            id: generateUUID(),
            setNumber: i + 1,
            setType: 'normal',
            weightKg: 0,
            reps: defaultReps,
            completed: false,
          }));

      return {
        instanceId: generateUUID(),
        exerciseId,
        exerciseName: ex.exercise_name || ex.exerciseName || ex.name || `Exercise ${idx + 1}`,
        measurementType: ex.measurement_type || ex.measurementType || 'weight_reps',
        sets,
      };
    });

    const workoutId = generateUUID();
    startWorkout(workoutId, draft.name, draft.routineId, initialExercises);
    openSheet();

    try {
      await apiClient<{ id: string; name: string }>('/workouts', {
        method: 'POST',
        body: JSON.stringify({
          id: workoutId,
          routine_id: draft.routineId,
          name: draft.name,
          replace_active: true,
        }),
      });
    } catch (err) {
      console.warn('Backend start workout sync error (workout kept locally):', err);
    }
  };
}
