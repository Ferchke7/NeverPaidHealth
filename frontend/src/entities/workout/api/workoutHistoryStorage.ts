import { WorkoutHistoryItem } from '../model/types.ts';

const STORAGE_KEY = 'neverpaid_finished_workouts_v4';

export const workoutHistoryStorage = {
  getAll(): WorkoutHistoryItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      // Remove only the bundled demo records from earlier app versions.
      return parsed.filter((item): item is WorkoutHistoryItem =>
        item && typeof item.id === 'string' && !/^seed-w-\d+$/.test(item.id)
      );
    } catch {
      return [];
    }
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
