import { describe, it, expect } from 'vitest';
import {
  extractExerciseHistory,
  getTop3BestForSet,
  getAllTimeExercisePR,
  normalizeExerciseName,
} from './setHistory.ts';
import { WorkoutHistoryItem } from './types.ts';

describe('setHistory logic', () => {
  it('normalizes exercise names correctly', () => {
    expect(normalizeExerciseName('Weighted Pull-Up (Lat Focus)')).toBe('weightedpullup');
    expect(normalizeExerciseName(' Жим лёжа (штанга) ')).toBe('жимлёжа');
  });

  const mockWorkouts: WorkoutHistoryItem[] = [
    {
      id: 'w-1',
      name: 'Pull Day 1',
      status: 'finished',
      started_at: '2026-10-10T10:00:00Z',
      exercises: [
        {
          exercise_id: 'ex-pullup',
          exercise_name: 'Weighted Pull-Up',
          sets: [
            { id: 's1', set_number: 1, set_type: 'normal', weight_kg: 35, reps: 6, completed: true },
            { id: 's2', set_number: 2, set_type: 'normal', weight_kg: 40, reps: 6, completed: true },
          ],
        },
      ],
    },
    {
      id: 'w-2',
      name: 'Pull Day 2',
      status: 'finished',
      started_at: '2026-10-17T10:00:00Z',
      exercises: [
        {
          exercise_id: 'ex-pullup',
          exercise_name: 'Weighted Pull-Up',
          sets: [
            { id: 's3', set_number: 1, set_type: 'normal', weight_kg: 45, reps: 6, completed: true },
            { id: 's4', set_number: 2, set_type: 'normal', weight_kg: 45, reps: 8, completed: true },
          ],
        },
      ],
    },
    {
      id: 'w-3',
      name: 'Pull Day 3',
      status: 'finished',
      started_at: '2026-10-24T10:00:00Z',
      exercises: [
        {
          exercise_id: 'ex-pullup',
          exercise_name: 'Weighted Pull-Up',
          sets: [
            { id: 's5', set_number: 1, set_type: 'normal', weight_kg: 50, reps: 8, completed: true },
            { id: 's6', set_number: 2, set_type: 'normal', weight_kg: 50, reps: 8, completed: true },
          ],
        },
      ],
    },
    {
      id: 'w-4',
      name: 'Pull Day 4',
      status: 'finished',
      started_at: '2026-10-31T10:00:00Z',
      exercises: [
        {
          exercise_id: 'ex-pullup',
          exercise_name: 'Weighted Pull-Up',
          sets: [
            { id: 's7', set_number: 1, set_type: 'normal', weight_kg: 52.5, reps: 5, completed: true },
            { id: 's8', set_number: 2, set_type: 'normal', weight_kg: 48, reps: 8, completed: true },
          ],
        },
      ],
    },
  ];

  it('extracts all completed sets for the target exercise', () => {
    const records = extractExerciseHistory(mockWorkouts, 'ex-pullup', 'Weighted Pull-Up');
    expect(records.length).toBe(8);
  });

  it('returns top 3 best records in specific set #1 ordered by highest e1RM / performance', () => {
    const records = extractExerciseHistory(mockWorkouts, 'ex-pullup', 'Weighted Pull-Up');
    const { topRecords, totalForSet, isFallback } = getTop3BestForSet(records, 1);

    expect(isFallback).toBe(false);
    expect(totalForSet).toBe(4);
    expect(topRecords.length).toBe(3);

    // Set 1 in w-3: 50 kg x 8 -> e1rm: ~63.3 kg
    // Set 1 in w-4: 52.5 kg x 5 -> e1rm: ~61.2 kg
    // Set 1 in w-2: 45 kg x 6 -> e1rm: ~54.0 kg
    // Set 1 in w-1: 35 kg x 6 -> e1rm: ~42.0 kg
    expect(topRecords[0].weightKg).toBe(50);
    expect(topRecords[0].reps).toBe(8);

    expect(topRecords[1].weightKg).toBe(52.5);
    expect(topRecords[1].reps).toBe(5);

    expect(topRecords[2].weightKg).toBe(45);
    expect(topRecords[2].reps).toBe(6);
  });

  it('handles fallback when set number does not exist yet', () => {
    const records = extractExerciseHistory(mockWorkouts, 'ex-pullup', 'Weighted Pull-Up');
    // Request Set #5, which was never performed
    const { topRecords, isFallback } = getTop3BestForSet(records, 5);

    expect(isFallback).toBe(true);
    expect(topRecords.length).toBe(3);
    // Highest across all sets is 50 kg x 8 (from w-3 set 1 or 2)
    expect(topRecords[0].weightKg).toBe(50);
    expect(topRecords[0].reps).toBe(8);
  });

  it('calculates all time exercise PRs correctly', () => {
    const records = extractExerciseHistory(mockWorkouts, 'ex-pullup', 'Weighted Pull-Up');
    const prs = getAllTimeExercisePR(records);

    expect(prs.bestWeightKg).toBe(52.5);
    expect(prs.bestReps).toBe(8);
    expect(prs.bestRecord).not.toBeNull();
    expect(prs.totalSets).toBe(8);
  });
});
