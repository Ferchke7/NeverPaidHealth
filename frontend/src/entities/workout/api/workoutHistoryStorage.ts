import { WorkoutHistoryItem } from '../model/types.ts';

const STORAGE_KEY = 'neverpaid_finished_workouts_v4';

function generatePastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

// Seed realistic workout history so every exercise has the last 3 recent numbers immediately available
const SEED_WORKOUTS: WorkoutHistoryItem[] = [
  {
    id: 'seed-w-1',
    user_id: 'local-user',
    name: 'Pull Day (Jeff Nippard PPL)',
    started_at: generatePastDate(3),
    ended_at: generatePastDate(3),
    status: 'completed',
    total_volume_kg: 3200,
    exercises: [
      {
        exercise_id: '20000000-0000-0000-0000-000000000011',
        exercise_name: 'Weighted Pull-Up',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 35, reps: 6, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 50, reps: 8, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 50, reps: 8, completed: true },
        ],
      },
      {
        exercise_id: '20000000-0000-0000-0000-000000000012',
        exercise_name: 'Cable Seated Row',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 50, reps: 12, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 50, reps: 12, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 50, reps: 12, completed: true },
        ],
      },
      {
        exercise_id: 'ex-lat-pulldown',
        exercise_name: 'Lat Pulldown',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 70, reps: 10, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 70, reps: 10, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 65, reps: 12, completed: true },
        ],
      },
      {
        exercise_id: 'ex-bicep-curl',
        exercise_name: 'Barbell Bicep Curl',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 35, reps: 10, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 35, reps: 8, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 30, reps: 10, completed: true },
        ],
      },
    ],
  },
  {
    id: 'seed-w-2',
    user_id: 'local-user',
    name: 'Pull Day (Jeff Nippard PPL)',
    started_at: generatePastDate(7),
    ended_at: generatePastDate(7),
    status: 'completed',
    total_volume_kg: 3050,
    exercises: [
      {
        exercise_id: '20000000-0000-0000-0000-000000000011',
        exercise_name: 'Weighted Pull-Up',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 32.5, reps: 6, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 47.5, reps: 8, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 47.5, reps: 8, completed: true },
        ],
      },
      {
        exercise_id: '20000000-0000-0000-0000-000000000012',
        exercise_name: 'Cable Seated Row',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 47.5, reps: 12, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 47.5, reps: 12, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 47.5, reps: 12, completed: true },
        ],
      },
      {
        exercise_id: 'ex-lat-pulldown',
        exercise_name: 'Lat Pulldown',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 65, reps: 12, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 65, reps: 10, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 60, reps: 12, completed: true },
        ],
      },
    ],
  },
  {
    id: 'seed-w-3',
    user_id: 'local-user',
    name: 'Pull Day (Jeff Nippard PPL)',
    started_at: generatePastDate(12),
    ended_at: generatePastDate(12),
    status: 'completed',
    total_volume_kg: 2900,
    exercises: [
      {
        exercise_id: '20000000-0000-0000-0000-000000000011',
        exercise_name: 'Weighted Pull-Up',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 30, reps: 6, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 45, reps: 8, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 45, reps: 8, completed: true },
        ],
      },
      {
        exercise_id: '20000000-0000-0000-0000-000000000012',
        exercise_name: 'Cable Seated Row',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 45, reps: 12, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 45, reps: 12, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 45, reps: 12, completed: true },
        ],
      },
    ],
  },
  {
    id: 'seed-w-push-1',
    user_id: 'local-user',
    name: 'Push Day 1',
    started_at: generatePastDate(2),
    ended_at: generatePastDate(2),
    status: 'completed',
    total_volume_kg: 4100,
    exercises: [
      {
        exercise_id: 'ex-bench',
        exercise_name: 'Bench Press',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 90, reps: 8, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 90, reps: 7, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 85, reps: 8, completed: true },
        ],
      },
      {
        exercise_id: 'ex-ohp',
        exercise_name: 'Overhead Press',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 55, reps: 8, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 55, reps: 7, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 50, reps: 8, completed: true },
        ],
      },
      {
        exercise_id: 'ex-incline-db',
        exercise_name: 'Incline Dumbbell Press',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 32, reps: 10, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 32, reps: 8, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 28, reps: 10, completed: true },
        ],
      },
      {
        exercise_id: 'ex-tricep-pushdown',
        exercise_name: 'Tricep Rope Pushdown',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 30, reps: 12, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 30, reps: 12, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 25, reps: 15, completed: true },
        ],
      },
    ],
  },
  {
    id: 'seed-w-push-2',
    user_id: 'local-user',
    name: 'Push Day 1',
    started_at: generatePastDate(6),
    ended_at: generatePastDate(6),
    status: 'completed',
    total_volume_kg: 3950,
    exercises: [
      {
        exercise_id: 'ex-bench',
        exercise_name: 'Bench Press',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 87.5, reps: 8, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 85, reps: 8, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 82.5, reps: 8, completed: true },
        ],
      },
      {
        exercise_id: 'ex-ohp',
        exercise_name: 'Overhead Press',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 52.5, reps: 8, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 50, reps: 8, completed: true },
        ],
      },
    ],
  },
  {
    id: 'seed-w-push-3',
    user_id: 'local-user',
    name: 'Push Day 1',
    started_at: generatePastDate(10),
    ended_at: generatePastDate(10),
    status: 'completed',
    total_volume_kg: 3800,
    exercises: [
      {
        exercise_id: 'ex-bench',
        exercise_name: 'Bench Press',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 85, reps: 8, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 82.5, reps: 8, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 80, reps: 10, completed: true },
        ],
      },
    ],
  },
  {
    id: 'seed-w-push2-1',
    user_id: 'local-user',
    name: 'Push 2 (Jeff Nippard PPL)',
    started_at: generatePastDate(3),
    ended_at: generatePastDate(3),
    status: 'completed',
    total_volume_kg: 3450,
    exercises: [
      {
        exercise_id: '10000000-0000-0000-0000-000000000013',
        exercise_name: 'Cable Upper Chest Crossover',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 25, reps: 12, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 25, reps: 12, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 20, reps: 12, completed: true },
        ],
      },
      {
        exercise_id: '70000000-0000-0000-0000-000000000003',
        exercise_name: 'Cable Rope Overhead Tricep Extension',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 50, reps: 12, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 50, reps: 12, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 50, reps: 12, completed: true },
        ],
      },
      {
        exercise_id: '50000000-0000-0000-0000-000000000008',
        exercise_name: 'Barbell Military Press',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 60, reps: 8, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 60, reps: 8, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 55, reps: 8, completed: true },
        ],
      },
      {
        exercise_id: '70000000-0000-0000-0000-000000000004',
        exercise_name: 'Barbell Bench Press (Close Grip)',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 75, reps: 10, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 75, reps: 10, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 70, reps: 10, completed: true },
        ],
      },
      {
        exercise_id: '50000000-0000-0000-0000-000000000010',
        exercise_name: 'Dumbbell Lateral Raise',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 14, reps: 15, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 14, reps: 15, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 12, reps: 15, completed: true },
        ],
      },
    ],
  },
  {
    id: 'seed-w-push2-2',
    user_id: 'local-user',
    name: 'Push 2 (Jeff Nippard PPL)',
    started_at: generatePastDate(7),
    ended_at: generatePastDate(7),
    status: 'completed',
    total_volume_kg: 3300,
    exercises: [
      {
        exercise_id: '10000000-0000-0000-0000-000000000013',
        exercise_name: 'Cable Upper Chest Crossover',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 25, reps: 10, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 22.5, reps: 12, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 20, reps: 10, completed: true },
        ],
      },
      {
        exercise_id: '70000000-0000-0000-0000-000000000003',
        exercise_name: 'Cable Rope Overhead Tricep Extension',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 47.5, reps: 12, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 47.5, reps: 12, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 45, reps: 12, completed: true },
        ],
      },
      {
        exercise_id: '50000000-0000-0000-0000-000000000008',
        exercise_name: 'Barbell Military Press',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 57.5, reps: 8, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 57.5, reps: 8, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 55, reps: 8, completed: true },
        ],
      },
    ],
  },
  {
    id: 'seed-w-push2-3',
    user_id: 'local-user',
    name: 'Push 2 (Jeff Nippard PPL)',
    started_at: generatePastDate(12),
    ended_at: generatePastDate(12),
    status: 'completed',
    total_volume_kg: 3100,
    exercises: [
      {
        exercise_id: '10000000-0000-0000-0000-000000000013',
        exercise_name: 'Cable Upper Chest Crossover',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 22.5, reps: 12, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 22.5, reps: 10, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 17.5, reps: 12, completed: true },
        ],
      },
      {
        exercise_id: '70000000-0000-0000-0000-000000000003',
        exercise_name: 'Cable Rope Overhead Tricep Extension',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 45, reps: 12, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 45, reps: 12, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 42.5, reps: 12, completed: true },
        ],
      },
    ],
  },
  {
    id: 'seed-w-legs-1',
    user_id: 'local-user',
    name: 'Leg Day',
    started_at: generatePastDate(4),
    ended_at: generatePastDate(4),
    status: 'completed',
    total_volume_kg: 5200,
    exercises: [
      {
        exercise_id: 'ex-squat',
        exercise_name: 'Barbell Back Squat',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 110, reps: 6, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 110, reps: 6, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 105, reps: 8, completed: true },
        ],
      },
      {
        exercise_id: 'ex-leg-press',
        exercise_name: 'Leg Press',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 200, reps: 10, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 200, reps: 10, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 180, reps: 12, completed: true },
        ],
      },
      {
        exercise_id: 'ex-romanian-deadlift',
        exercise_name: 'Romanian Deadlift',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 90, reps: 8, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 90, reps: 8, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 85, reps: 10, completed: true },
        ],
      },
    ],
  },
  {
    id: 'seed-w-legs-2',
    user_id: 'local-user',
    name: 'Leg Day',
    started_at: generatePastDate(8),
    ended_at: generatePastDate(8),
    status: 'completed',
    total_volume_kg: 4900,
    exercises: [
      {
        exercise_id: 'ex-squat',
        exercise_name: 'Barbell Back Squat',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 105, reps: 6, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 105, reps: 6, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 100, reps: 8, completed: true },
        ],
      },
      {
        exercise_id: 'ex-leg-press',
        exercise_name: 'Leg Press',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 190, reps: 10, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 180, reps: 12, completed: true },
        ],
      },
    ],
  },
  {
    id: 'seed-w-legs-3',
    user_id: 'local-user',
    name: 'Leg Day',
    started_at: generatePastDate(13),
    ended_at: generatePastDate(13),
    status: 'completed',
    total_volume_kg: 4600,
    exercises: [
      {
        exercise_id: 'ex-squat',
        exercise_name: 'Barbell Back Squat',
        sets: [
          { set_number: 1, set_type: 'normal', weight_kg: 100, reps: 8, completed: true },
          { set_number: 2, set_type: 'normal', weight_kg: 100, reps: 6, completed: true },
          { set_number: 3, set_type: 'normal', weight_kg: 95, reps: 8, completed: true },
        ],
      },
    ],
  },
];

export const workoutHistoryStorage = {
  getAll(): WorkoutHistoryItem[] {
    if (typeof window === 'undefined') return SEED_WORKOUTS;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const userIds = new Set(parsed.map((w: WorkoutHistoryItem) => w.id));
          const missingSeeds = SEED_WORKOUTS.filter((s) => !userIds.has(s.id));
          return [...parsed, ...missingSeeds];
        }
      }
    } catch {
      // fallback
    }

    // Initialize with seed workouts
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_WORKOUTS));
    } catch {
      // ignore
    }
    return SEED_WORKOUTS;
  },

  addWorkout(item: WorkoutHistoryItem) {
    if (typeof window === 'undefined') return;
    try {
      const current = this.getAll();
      const updated = [item, ...current.filter((w) => w.id !== item.id)];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  },
};
