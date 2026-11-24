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

export function serializeWorkoutExercisesForApi(
  exercises: ActiveWorkout['exercises']
) {
  return (exercises || []).map((ex) => ({
    exercise_id: ensureValidUuid(ex.exerciseId, ex.exerciseName),
    exercise_name: ex.exerciseName,
    measurement_type: ex.measurementType || 'weight_reps',
    notes: ex.notes || '',
    sets: (ex.sets || []).map((s, idx) => ({
      id: ensureValidUuid(s.id, `${ex.exerciseId}-${idx}`),
      set_number: s.setNumber || idx + 1,
      set_type: s.setType || 'normal',
      weight_kg: Number(s.weightKg) || 0,
      reps: Number(s.reps) || 0,
      rpe: s.rpe,
      duration_seconds: s.durationSeconds,
      completed: Boolean(s.completed),
    })),
  }));
}

export function saveProgramOverride(program: Program, aliasId?: string, fromServer = false): void {
  if (typeof window === 'undefined' || !window.localStorage || !program?.id) return;
  try {
    const map = loadProgramOverrides();
    const record: Program = {
      ...program,
      updated_at: fromServer
        ? program.updated_at || new Date().toISOString()
        : new Date().toISOString(),
    };
    map[program.id] = record;
    if (aliasId && aliasId !== program.id) {
      map[aliasId] = record;
    }
    if (program.name) {
      map[`__name__:${program.name.toLowerCase().trim()}`] = record;
    }
    localStorage.setItem(PROGRAM_OVERRIDES_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

function isOverrideStrictlyNewer(overrideProg: Program | undefined, serverProg: Program): boolean {
  if (!overrideProg || !Array.isArray(overrideProg.days) || overrideProg.days.length === 0) {
    return false;
  }
  const serverTs = serverProg.updated_at ? Date.parse(serverProg.updated_at) : 0;
  const overrideTs = overrideProg.updated_at ? Date.parse(overrideProg.updated_at) : 0;
  if (!Number.isFinite(overrideTs) || overrideTs <= 0) {
    return false;
  }
  if (!Number.isFinite(serverTs) || serverTs <= 0) {
    return true;
  }
  return overrideTs > serverTs + 1000;
}

export function applyProgramOverride(
  program: Program | null | undefined,
  allowNameMatch = true
): Program | undefined {
  if (!program) return undefined;
  const overrides = loadProgramOverrides();
  const byId = overrides[program.id];
  if (isOverrideStrictlyNewer(byId, program)) {
    return {
      ...program,
      ...byId,
      days: byId.days,
    };
  }
  if (allowNameMatch && program.name) {
    const byName = overrides[`__name__:${program.name.toLowerCase().trim()}`];
    if (isOverrideStrictlyNewer(byName, program)) {
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

interface RoutineLike {
  id: string;
  user_id?: string;
  name: string;
  notes?: string;
  exercises?: ProgramDayExercise[];
  created_at?: string;
  updated_at?: string;
}

const routineForkAliases = new Map<string, string>();
const programForkAliases = new Map<string, string>();
let syncQueue: Promise<void> = Promise.resolve();

export function resetSyncStateForTests(): void {
  routineForkAliases.clear();
  programForkAliases.clear();
  syncQueue = Promise.resolve();
}

function resolveAliasedId(aliases: Map<string, string>, rawId?: string): string | undefined {
  if (!rawId) return undefined;
  let current = rawId;
  const visited = new Set<string>();
  while (aliases.has(current) && !visited.has(current)) {
    visited.add(current);
    current = aliases.get(current)!;
  }
  return current;
}

export function syncProgramAndRoutineFromWorkout(
  workout: ActiveWorkout | null | undefined,
  queryClient: QueryClient
): Promise<void> {
  if (!workout || !Array.isArray(workout.exercises) || workout.exercises.length === 0) {
    return syncQueue;
  }

  const run = async () => {
    await executeSync(workout, queryClient);
  };

  syncQueue = syncQueue.then(run, run);
  return syncQueue;
}

async function executeSync(
  inputWorkout: ActiveWorkout,
  queryClient: QueryClient
): Promise<void> {
  const liveStoreWorkout = useActiveWorkoutStore.getState().workout;
  const workout: ActiveWorkout =
    liveStoreWorkout && liveStoreWorkout.id === inputWorkout.id
      ? {
          ...inputWorkout,
          routineId:
            resolveAliasedId(routineForkAliases, inputWorkout.routineId) ||
            liveStoreWorkout.routineId ||
            inputWorkout.routineId,
          programId:
            resolveAliasedId(programForkAliases, inputWorkout.programId) ||
            liveStoreWorkout.programId ||
            inputWorkout.programId,
        }
      : {
          ...inputWorkout,
          routineId: resolveAliasedId(routineForkAliases, inputWorkout.routineId),
          programId: resolveAliasedId(programForkAliases, inputWorkout.programId),
        };

  // 1. Sync Routine in-place via PUT /routines/{id} (forks at most once if starting from a system routine)
  if (workout.routineId) {
    const effectiveRoutineId = workout.routineId;
    try {
      const savedRoutine = await apiClient<RoutineLike>(`/routines/${effectiveRoutineId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: workout.name,
          exercises: mapWorkoutExercisesToProgramDay(workout),
        }),
      });

      if (savedRoutine && savedRoutine.id) {
        if (savedRoutine.id !== effectiveRoutineId) {
          routineForkAliases.set(effectiveRoutineId, savedRoutine.id);
          if (inputWorkout.routineId && inputWorkout.routineId !== savedRoutine.id) {
            routineForkAliases.set(inputWorkout.routineId, savedRoutine.id);
          }
          useActiveWorkoutStore.getState().setWorkoutRoutineId(savedRoutine.id);
        }

        queryClient.setQueryData<RoutineLike[] | undefined>(['routines'], (old) => {
          if (!Array.isArray(old)) return old;
          const idx = old.findIndex((r) => r.id === savedRoutine.id);
          if (idx >= 0) {
            return old.map((r, i) => (i === idx ? savedRoutine : r));
          }
          return [savedRoutine, ...old];
        });
      }

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
      saveProgramOverride(saved, originalProgramId, true);
      if (saved.id !== originalProgramId) {
        programForkAliases.set(originalProgramId, saved.id);
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
