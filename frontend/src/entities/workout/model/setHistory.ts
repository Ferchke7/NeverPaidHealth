import { SetType, WorkoutHistoryItem } from './types.ts';
import { calculateE1RM } from '../../../shared/lib/units.ts';
import { PreviousSetData } from '../ui/SetRow.tsx';

export interface HistoricalSetRecord {
  workoutId: string;
  workoutName: string;
  date: string; // ISO date string
  setNumber: number; // 1-based index (1, 2, 3...)
  setType: SetType;
  weightKg: number;
  reps: number;
  e1rmKg: number;
  volumeKg: number;
  durationSeconds?: number;
  isCurrentWorkout?: boolean;
}

/**
 * Normalizes an exercise name for loose matching (strips brackets, extra spaces, special chars)
 */
export function normalizeExerciseName(name?: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/[^a-z0-9а-яё]/gi, '')
    .trim();
}

/**
 * Extracts all historical completed sets for a given exercise from the workout history
 */
export function extractExerciseHistory(
  workouts: WorkoutHistoryItem[] | undefined,
  exerciseId?: string,
  exerciseName?: string,
  currentPreviousSets?: PreviousSetData[] | null
): HistoricalSetRecord[] {
  const records: HistoricalSetRecord[] = [];
  const normTargetName = normalizeExerciseName(exerciseName);

  if (Array.isArray(workouts) && workouts.length > 0) {
    for (const w of workouts) {
      if (!w.exercises || w.status === 'in_progress' || w.status === 'cancelled') continue;

      for (const ex of w.exercises) {
        const idMatches = exerciseId && ex.exercise_id && ex.exercise_id === exerciseId;
        const nameMatches = normTargetName && normalizeExerciseName(ex.exercise_name) === normTargetName;

        if (idMatches || nameMatches) {
          if (Array.isArray(ex.sets)) {
            for (const s of ex.sets) {
              // Only consider completed sets with non-zero performance
              if (!s.completed && s.completed !== undefined) continue;

              const weight = Number(s.weight_kg ?? 0);
              const reps = Number(s.reps ?? 0);
              if (weight <= 0 && reps <= 0) continue;

              const e1rm = calculateE1RM(weight, reps) ?? (weight > 0 ? weight : 0);
              const volume = weight * reps;

              records.push({
                workoutId: w.id,
                workoutName: w.name || 'Workout',
                date: w.started_at,
                setNumber: s.set_number || 1,
                setType: s.set_type || 'normal',
                weightKg: weight,
                reps: reps,
                e1rmKg: Math.round(e1rm * 10) / 10,
                volumeKg: Math.round(volume * 10) / 10,
              });
            }
          }
        }
      }
    }
  }

  // If no workouts found from history query, but we have currentPreviousSets from /workouts/previous:
  if (records.length === 0 && currentPreviousSets && currentPreviousSets.length > 0) {
    currentPreviousSets.forEach((ps, idx) => {
      const weight = Number(ps.weightKg ?? ps.weight_kg ?? 0);
      const reps = Number(ps.reps ?? 0);
      if (weight > 0 || reps > 0) {
        const e1rm = calculateE1RM(weight, reps) ?? weight;
        records.push({
          workoutId: 'previous-session',
          workoutName: 'Previous Workout',
          date: new Date().toISOString(),
          setNumber: idx + 1,
          setType: 'normal',
          weightKg: weight,
          reps: reps,
          e1rmKg: Math.round(e1rm * 10) / 10,
          volumeKg: Math.round(weight * reps * 10) / 10,
        });
      }
    });
  }

  return records;
}

/**
 * Returns the last 3 most recent performances for this set number (or exercise).
 * Sorted strictly by date descending (most recent session first).
 */
export function getLast3RecentForSet(
  allRecords: HistoricalSetRecord[],
  setNumber: number
): { recentRecords: HistoricalSetRecord[]; isFallback: boolean } {
  if (!allRecords || allRecords.length === 0) {
    return { recentRecords: [], isFallback: false };
  }

  const sortByDateDesc = (a: HistoricalSetRecord, b: HistoricalSetRecord) =>
    new Date(b.date).getTime() - new Date(a.date).getTime();

  // 1. Search for this exact set number in recent sessions
  const exactSet = allRecords.filter((r) => r.setNumber === setNumber).sort(sortByDateDesc);

  const uniqueExact: HistoricalSetRecord[] = [];
  const seenWorkouts = new Set<string>();
  for (const r of exactSet) {
    if (!seenWorkouts.has(r.workoutId)) {
      seenWorkouts.add(r.workoutId);
      uniqueExact.push(r);
      if (uniqueExact.length >= 3) break;
    }
  }

  if (uniqueExact.length > 0) {
    return { recentRecords: uniqueExact, isFallback: false };
  }

  // 2. Fallback: recent performances for this exercise across any set
  const allSorted = [...allRecords].sort(sortByDateDesc);
  const fallbackList: HistoricalSetRecord[] = [];
  const seenAll = new Set<string>();
  for (const r of allSorted) {
    if (!seenAll.has(r.workoutId)) {
      seenAll.add(r.workoutId);
      fallbackList.push(r);
      if (fallbackList.length >= 3) break;
    }
  }

  return { recentRecords: fallbackList, isFallback: fallbackList.length > 0 };
}

/**
 * Returns the top 3 best performances for a specific set number.
 * Sorts primarily by calculated 1RM (or weight if bodyweight), then reps, then recency.
 */
export function getTop3BestForSet(
  allRecords: HistoricalSetRecord[],
  setNumber: number
): { topRecords: HistoricalSetRecord[]; totalForSet: number; isFallback: boolean } {
  if (!allRecords || allRecords.length === 0) {
    return { topRecords: [], totalForSet: 0, isFallback: false };
  }

  // 1. Filter by exact set number
  const exactSetRecords = allRecords.filter((r) => r.setNumber === setNumber);
  const totalForSet = exactSetRecords.length;

  const scoreRecord = (r: HistoricalSetRecord) => {
    // If weighted, e1rm is primary score; if bodyweight (0kg), reps is primary score
    return r.weightKg > 0 ? r.e1rmKg * 1000 + r.reps : r.reps;
  };

  const sortFn = (a: HistoricalSetRecord, b: HistoricalSetRecord) => {
    const scoreDiff = scoreRecord(b) - scoreRecord(a);
    if (Math.abs(scoreDiff) > 0.01) return scoreDiff;
    if (b.weightKg !== a.weightKg) return b.weightKg - a.weightKg;
    if (b.reps !== a.reps) return b.reps - a.reps;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  };

  const sortedExact = [...exactSetRecords].sort(sortFn);

  // Deduplicate identical performances from the same workout
  const uniqueExact: HistoricalSetRecord[] = [];
  const seenWorkouts = new Set<string>();

  for (const r of sortedExact) {
    const key = `${r.workoutId}-${r.weightKg}-${r.reps}`;
    if (!seenWorkouts.has(key)) {
      seenWorkouts.add(key);
      uniqueExact.push(r);
      if (uniqueExact.length >= 3) break;
    }
  }

  if (uniqueExact.length > 0) {
    return { topRecords: uniqueExact, totalForSet, isFallback: false };
  }

  // Fallback: If no records exist for this exact set number (e.g. user added Set #5 for the first time),
  // return top sets for this exercise overall so the user still has valuable reference records
  const sortedAll = [...allRecords].sort(sortFn);
  const fallbackList: HistoricalSetRecord[] = [];
  const seenAll = new Set<string>();

  for (const r of sortedAll) {
    const key = `${r.workoutId}-${r.weightKg}-${r.reps}`;
    if (!seenAll.has(key)) {
      seenAll.add(key);
      fallbackList.push(r);
      if (fallbackList.length >= 3) break;
    }
  }

  return {
    topRecords: fallbackList,
    totalForSet: 0,
    isFallback: fallbackList.length > 0,
  };
}

/**
 * Returns all-time PR and summary statistics for an exercise
 */
export function getAllTimeExercisePR(records: HistoricalSetRecord[]): {
  best1RMKg: number;
  bestWeightKg: number;
  bestReps: number;
  totalSets: number;
  bestRecord: HistoricalSetRecord | null;
} {
  if (!records || records.length === 0) {
    return { best1RMKg: 0, bestWeightKg: 0, bestReps: 0, totalSets: 0, bestRecord: null };
  }

  let best1RMKg = 0;
  let bestWeightKg = 0;
  let bestReps = 0;
  let bestRecord: HistoricalSetRecord | null = null;

  for (const r of records) {
    if (r.e1rmKg > best1RMKg) {
      best1RMKg = r.e1rmKg;
      bestRecord = r;
    }
    if (r.weightKg > bestWeightKg) {
      bestWeightKg = r.weightKg;
    }
    if (r.reps > bestReps) {
      bestReps = r.reps;
    }
  }

  return {
    best1RMKg,
    bestWeightKg,
    bestReps,
    totalSets: records.length,
    bestRecord,
  };
}
