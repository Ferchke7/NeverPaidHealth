import { QueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { ActiveWorkout } from '../../workout/model/types.ts';
import { useActiveWorkoutStore } from '../../workout/model/activeWorkoutStore.ts';
import {
  ActiveProgramResponse,
  InstalledProgramItem,
  Program,
  ProgramDay,
  ProgramDayExercise,
} from './types.ts';

const PROGRAM_OVERRIDES_KEY = 'np_user_program_overrides_v1';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ensureValidUuid(rawId: string | undefined, fallbackSeed: string): string {
  if (rawId && UUID_REGEX.test(rawId.trim())) {
    return rawId.trim();
  }
  const seed = (rawId || fallbackSeed || 'exercise').toLowerCase().trim();
  let h1 = 0xdeadbeef ^ seed.length;
  let h2 = 0x41c6ce57 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${hex1}-${hex2.slice(0, 4)}-4${hex2.slice(5, 8)}-8${hex1.slice(1, 4)}-${hex1}${hex2.slice(0, 4)}`;
}

export function loadProgramOverrides(): Record<string, Program> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = localStorage.getItem(PROGRAM_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveProgramOverride(program: Program, aliasId?: string): void {
  if (typeof window === 'undefined' || !window.localStorage || !program?.id) return;
  try {
    const map = loadProgramOverrides();
    map[program.id] = program;
    if (aliasId && aliasId !== program.id) {
      map[aliasId] = program;
    }
    if (program.name) {
      map[`__name__:${program.name.toLowerCase().trim()}`] = program;
    }
    localStorage.setItem(PROGRAM_OVERRIDES_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

export function applyProgramOverride(
  program: Program | null | undefined,
  allowNameMatch = true
): Program | undefined {
  if (!program) return undefined;
  const overrides = loadProgramOverrides();
  const byId = overrides[program.id];
  if (byId && Array.isArray(byId.days) && byId.days.length > 0) {
    return {
      ...program,
      ...byId,
      days: byId.days,
    };
  }
  if (allowNameMatch && program.name) {
    const byName = overrides[`__name__:${program.name.toLowerCase().trim()}`];
    if (byName && Array.isArray(byName.days) && byName.days.length > 0) {
      return {
        ...program,
        days: byName.days,
      };
    }
  }
  return program;
}

export function mapWorkoutExercisesToProgramDay(
  workout: ActiveWorkout,
  existingDayExercises: ProgramDayExercise[] = []
): ProgramDayExercise[] {
  return workout.exercises.map((ex, idx) => {
    const prevMatch = existingDayExercises.find(
      (p) =>
        (p.exercise_id && p.exercise_id === ex.exerciseId) ||
        p.exercise_name?.toLowerCase().trim() === ex.exerciseName?.toLowerCase().trim()
    );
    const workingSets = ex.sets.filter((s) => s.setType !== 'warmup');
    const targetSets = Math.max(1, workingSets.length || ex.sets.length || prevMatch?.target_sets || 3);

    const repValues = (workingSets.length > 0 ? workingSets : ex.sets)
      .map((s) => Number(s.reps) || 0)
      .filter((r) => r > 0);

    const minReps =
      repValues.length > 0
        ? Math.min(...repValues)
        : ex.targetRepsMin || prevMatch?.target_reps_min || 8;
    const maxReps =
      repValues.length > 0
        ? Math.max(...repValues)
        : ex.targetRepsMax || prevMatch?.target_reps_max || Math.max(minReps, 12);

    return {
      exercise_id: ensureValidUuid(ex.exerciseId, ex.exerciseName),
      exercise_name: ex.exerciseName,
      order_index: idx,
      target_sets: targetSets,
      target_reps_min: minReps,
      target_reps_max: Math.max(minReps, maxReps),
    };
  });
}

function resolveDayToUpdate(program: Program, workout: ActiveWorkout): number {
  const days = program.days || [];
  if (days.length === 0) return -1;

  if (typeof workout.programDayNumber === 'number' && workout.programDayNumber > 0) {
    const byDayNum = days.findIndex((d) => d.day_number === workout.programDayNumber);
    if (byDayNum >= 0) return byDayNum;
    const byIndex = workout.programDayNumber - 1;
    if (byIndex >= 0 && byIndex < days.length) return byIndex;
  }

  // Fallback: match by workout title "${program.name} - ${day.name}"
  const workoutTitle = (workout.name || '').toLowerCase().trim();
  for (let i = 0; i < days.length; i++) {
    const dayName = (days[i].name || '').toLowerCase().trim();
    if (dayName && workoutTitle.endsWith(dayName)) {
      return i;
    }
  }

  return 0;
}

export async function syncProgramAndRoutineFromWorkout(
  workout: ActiveWorkout | null | undefined,
  queryClient: QueryClient
): Promise<void> {
  if (!workout || !Array.isArray(workout.exercises) || workout.exercises.length === 0) {
    return;
  }

  // 1. Sync Routine if this workout was started from a user routine
  if (workout.routineId) {
    try {
      await apiClient('/routines', {
        method: 'POST',
        body: JSON.stringify({
          id: workout.routineId,
          name: workout.name,
          exercises: workout.exercises.map((ex, idx) => {
            const workingSets = ex.sets.filter((s) => s.setType !== 'warmup');
            const targetSets = Math.max(1, workingSets.length || ex.sets.length || 3);
            const firstSet = workingSets[0] || ex.sets[0];
            return {
              exercise_id: ensureValidUuid(ex.exerciseId, ex.exerciseName),
              exercise_name: ex.exerciseName,
              order_index: idx,
              target_sets: targetSets,
              target_reps: firstSet?.reps || 10,
              target_weight_kg: firstSet?.weightKg || 0,
            };
          }),
        }),
      });
      void queryClient.invalidateQueries({ queryKey: ['routines'] });
    } catch {
      // Keep local state if routine update fails
    }
  }

  // 2. Find target Program (by workout.programId or matching activeProgram / installedPrograms)
  const activeData = queryClient.getQueryData<ActiveProgramResponse>(['programs', 'active']);
  const installedList = queryClient.getQueryData<InstalledProgramItem[]>(['programs', 'installed']) || [];
  const overrides = loadProgramOverrides();

  let targetProgram: Program | undefined;

  if (workout.programId) {
    if (activeData?.program && activeData.program.id === workout.programId) {
      targetProgram = applyProgramOverride(activeData.program);
    }
    if (!targetProgram) {
      const foundInstalled = installedList.find(
        (item) => item.program?.id === workout.programId || item.user_program?.program_id === workout.programId
      );
      if (foundInstalled?.program) {
        targetProgram = applyProgramOverride(foundInstalled.program);
      }
    }
    if (!targetProgram && overrides[workout.programId]) {
      targetProgram = overrides[workout.programId];
    }
    if (!targetProgram) {
      try {
        const fetched = await apiClient<Program>(`/programs/${workout.programId}`);
        if (fetched) targetProgram = applyProgramOverride(fetched);
      } catch {
        // ignore fetch error
      }
    }
  }

  // Fallback: if workout.programId wasn't set, check if workout name starts with activeProgram.name
  if (!targetProgram && activeData?.program) {
    const activeProg = applyProgramOverride(activeData.program);
    if (
      activeProg &&
      workout.name &&
      workout.name.toLowerCase().startsWith(activeProg.name.toLowerCase())
    ) {
      targetProgram = activeProg;
    }
  }

  if (!targetProgram || !Array.isArray(targetProgram.days) || targetProgram.days.length === 0) {
    return;
  }

  const dayIndex = resolveDayToUpdate(targetProgram, workout);
  if (dayIndex < 0 || dayIndex >= targetProgram.days.length) {
    return;
  }

  const targetDay = targetProgram.days[dayIndex];
  const updatedDayExercises = mapWorkoutExercisesToProgramDay(workout, targetDay.exercises || []);

  const updatedDays: ProgramDay[] = targetProgram.days.map((d, idx) =>
    idx === dayIndex
      ? {
          ...d,
          day_number: d.day_number || idx + 1,
          exercises: updatedDayExercises,
        }
      : {
          ...d,
          day_number: d.day_number || idx + 1,
        }
  );

  const updatedProgram: Program = {
    ...targetProgram,
    days: updatedDays,
  };

  // Immediately persist local override & update React Query caches for instant UI feedback
  const originalProgramId = targetProgram.id;
  saveProgramOverride(updatedProgram, originalProgramId);

  queryClient.setQueryData<ActiveProgramResponse | undefined>(['programs', 'active'], (old) => {
    if (!old?.program) return old;
    if (old.program.id === originalProgramId || old.program.name === updatedProgram.name) {
      return {
        ...old,
        program: {
          ...old.program,
          days: updatedDays,
        },
      };
    }
    return old;
  });

  queryClient.setQueryData<InstalledProgramItem[] | undefined>(['programs', 'installed'], (old) => {
    if (!Array.isArray(old)) return old;
    return old.map((item) => {
      if (item.program?.id === originalProgramId || item.program?.name === updatedProgram.name) {
        return {
          ...item,
          program: {
            ...item.program,
            days: updatedDays,
          },
        };
      }
      return item;
    });
  });

  // Persist to backend via PUT /programs/{id} (forks into personal program if needed)
  try {
    const payload = {
      name: updatedProgram.name,
      description: updatedProgram.description || '',
      split_type: updatedProgram.split_type || 'custom',
      days_per_week: updatedProgram.days_per_week || updatedDays.length,
      level: updatedProgram.level || 'intermediate',
      is_public: Boolean(updatedProgram.is_public),
      days: updatedDays.map((d, dIdx) => ({
        day_number: d.day_number || dIdx + 1,
        name: d.name || `Day ${dIdx + 1}`,
        notes: d.notes || '',
        exercises: (d.exercises || []).map((ex, eIdx) => ({
          exercise_id: ensureValidUuid(ex.exercise_id, ex.exercise_name),
          exercise_name: ex.exercise_name,
          order_index: eIdx,
          target_sets: Math.max(1, Number(ex.target_sets) || 3),
          target_reps_min: Number(ex.target_reps_min) || 8,
          target_reps_max: Number(ex.target_reps_max) || 12,
        })),
      })),
    };

    const saved = await apiClient<Program>(`/programs/${originalProgramId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    if (saved && saved.id) {
      saveProgramOverride(saved, originalProgramId);
      if (saved.id !== originalProgramId) {
        useActiveWorkoutStore.getState().setWorkoutProgramId(saved.id);
      }
      queryClient.setQueryData<ActiveProgramResponse | undefined>(['programs', 'active'], (old) => {
        if (!old?.program) return old;
        if (
          old.program.id === originalProgramId ||
          old.program.id === saved.id ||
          old.program.name === saved.name
        ) {
          return {
            ...old,
            program: saved,
            user_program: old.user_program
              ? { ...old.user_program, program_id: saved.id }
              : old.user_program,
          };
        }
        return old;
      });
    }

    void queryClient.invalidateQueries({ queryKey: ['programs', 'active'] });
    void queryClient.invalidateQueries({ queryKey: ['programs', 'installed'] });
    void queryClient.invalidateQueries({ queryKey: ['programs'] });
  } catch (err) {
    console.warn('Program workout customization kept in local override:', err);
  }
}
