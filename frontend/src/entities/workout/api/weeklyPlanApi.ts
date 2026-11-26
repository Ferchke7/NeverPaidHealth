import { apiClient } from '../../../shared/api/client.ts';
import { useAuthStore } from '../../user/model/authStore.ts';
import { generateUUID } from '../../../shared/lib/uuid.ts';
import { Program } from '../../program/model/types.ts';

export interface WeeklyPlanExercise {
  exercise_id: string;
  exercise_name: string;
  order_index: number;
  target_sets: number;
  target_reps_min?: number;
  target_reps_max?: number;
}

export interface WeeklyPlanItem {
  id: string;
  day_of_week: number; // 1 = Mon ... 7 = Sun
  order_index: number;
  item_type: 'routine' | 'program_day';
  routine_id?: string | null;
  program_id?: string | null;
  program_day_number?: number | null;
  title: string;
  subtitle?: string;
  notes?: string;
  exercises: WeeklyPlanExercise[];
  is_completed_this_week: boolean;
}

export interface WeeklyPlanUpsertItem {
  id?: string;
  day_of_week: number;
  order_index: number;
  item_type: 'routine' | 'program_day';
  routine_id?: string | null;
  program_id?: string | null;
  program_day_number?: number | null;
  title?: string;
  notes?: string;
}

export interface WeeklyPlanResponse {
  week_start: string;
  items: WeeklyPlanItem[];
}

const LOCAL_WEEKLY_PLAN_KEY = 'np_weekly_workout_plan_v1';

export function getCurrentIsoWeekday(date = new Date()): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

export function getCurrentWeekMondayKey(date = new Date()): string {
  const d = new Date(date);
  const weekday = getCurrentIsoWeekday(d);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (weekday - 1));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function normalizePlanOrder(items: WeeklyPlanItem[]): WeeklyPlanItem[] {
  const sorted = [...items].sort((a, b) => {
    if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
    return a.order_index - b.order_index;
  });
  const counters: Record<number, number> = {};
  return sorted.map((it) => {
    const idx = counters[it.day_of_week] ?? 0;
    counters[it.day_of_week] = idx + 1;
    return { ...it, order_index: idx };
  });
}

export function toUpsertPayload(items: WeeklyPlanItem[]): WeeklyPlanUpsertItem[] {
  return normalizePlanOrder(items).map((it) => ({
    id: it.id,
    day_of_week: it.day_of_week,
    order_index: it.order_index,
    item_type: it.item_type,
    routine_id: it.routine_id || undefined,
    program_id: it.program_id || undefined,
    program_day_number: it.program_day_number || undefined,
    title: it.title,
    notes: it.notes || undefined,
  }));
}

export function movePlanItemWithinDay(
  items: WeeklyPlanItem[],
  itemId: string,
  direction: 'up' | 'down'
): WeeklyPlanItem[] {
  const normalized = normalizePlanOrder(items);
  const target = normalized.find((i) => i.id === itemId);
  if (!target) return normalized;

  const dayItems = normalized.filter((i) => i.day_of_week === target.day_of_week);
  const pos = dayItems.findIndex((i) => i.id === itemId);
  const nextPos = direction === 'up' ? pos - 1 : pos + 1;
  if (pos < 0 || nextPos < 0 || nextPos >= dayItems.length) return normalized;

  const reorderedDay = [...dayItems];
  const [moved] = reorderedDay.splice(pos, 1);
  reorderedDay.splice(nextPos, 0, moved);

  const others = normalized.filter((i) => i.day_of_week !== target.day_of_week);
  return normalizePlanOrder([
    ...others,
    ...reorderedDay.map((it, idx) => ({ ...it, order_index: idx })),
  ]);
}

export function movePlanItemToWeekday(
  items: WeeklyPlanItem[],
  itemId: string,
  targetWeekday: number
): WeeklyPlanItem[] {
  if (targetWeekday < 1 || targetWeekday > 7) return items;
  const normalized = normalizePlanOrder(items);
  const target = normalized.find((i) => i.id === itemId);
  if (!target || target.day_of_week === targetWeekday) return normalized;

  const maxIdx = normalized
    .filter((i) => i.day_of_week === targetWeekday)
    .reduce((acc, i) => Math.max(acc, i.order_index), -1);

  return normalizePlanOrder(
    normalized.map((i) =>
      i.id === itemId
        ? { ...i, day_of_week: targetWeekday, order_index: maxIdx + 1 }
        : i
    )
  );
}

export function swapPlanWeekdays(
  items: WeeklyPlanItem[],
  dayA: number,
  dayB: number
): WeeklyPlanItem[] {
  if (dayA === dayB || dayA < 1 || dayA > 7 || dayB < 1 || dayB > 7) return items;
  return normalizePlanOrder(
    items.map((it) => {
      if (it.day_of_week === dayA) return { ...it, day_of_week: dayB };
      if (it.day_of_week === dayB) return { ...it, day_of_week: dayA };
      return it;
    })
  );
}

export function distributeProgramAcrossWeek(
  existingItems: WeeklyPlanItem[],
  program: Program,
  replaceSameProgram = true
): WeeklyPlanItem[] {
  const days = program.days || [];
  if (days.length === 0) return existingItems;

  const defaultSpreadByCount: Record<number, number[]> = {
    1: [1],
    2: [1, 4],
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 5, 6],
    6: [1, 2, 3, 4, 5, 6],
  };
  const spread = defaultSpreadByCount[days.length] || [1, 2, 3, 4, 5, 6, 7];

  const base = replaceSameProgram
    ? existingItems.filter((i) => i.program_id !== program.id)
    : [...existingItems];

  const additions: WeeklyPlanItem[] = days.map((d, idx) => {
    const dow = spread[idx % spread.length] || ((idx % 7) + 1);
    return {
      id: generateUUID(),
      day_of_week: dow,
      order_index: 999 + idx,
      item_type: 'program_day',
      program_id: program.id,
      program_day_number: d.day_number || idx + 1,
      title: d.name,
      subtitle: program.name,
      exercises: (d.exercises || []).map((ex, exIdx) => ({
        exercise_id: ex.exercise_id,
        exercise_name: ex.exercise_name,
        order_index: ex.order_index ?? exIdx,
        target_sets: ex.target_sets || 3,
        target_reps_min: ex.target_reps_min,
        target_reps_max: ex.target_reps_max,
      })),
      is_completed_this_week: false,
    };
  });

  return normalizePlanOrder([...base, ...additions]);
}

function readLocalPlan(): WeeklyPlanResponse {
  const weekStart = getCurrentWeekMondayKey();
  if (typeof window === 'undefined') {
    return { week_start: weekStart, items: [] };
  }
  try {
    const raw = localStorage.getItem(LOCAL_WEEKLY_PLAN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WeeklyPlanResponse;
      if (parsed && Array.isArray(parsed.items)) {
        return {
          week_start: weekStart,
          items: normalizePlanOrder(parsed.items),
        };
      }
    }
  } catch {
    // ignore corrupt cache
  }
  return { week_start: weekStart, items: [] };
}

function writeLocalPlan(resp: WeeklyPlanResponse): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_WEEKLY_PLAN_KEY, JSON.stringify(resp));
  } catch {
    // ignore quota errors
  }
}

export const weeklyPlanApi = {
  async getWeeklyPlan(): Promise<WeeklyPlanResponse> {
    if (!useAuthStore.getState().isAuthenticated) {
      return readLocalPlan();
    }
    try {
      const res = await apiClient<WeeklyPlanResponse>('/workouts/weekly-plan');
      if (res && Array.isArray(res.items)) {
        writeLocalPlan(res);
        return res;
      }
    } catch {
      // fallback to local cache when offline
    }
    return readLocalPlan();
  },

  async saveWeeklyPlan(items: WeeklyPlanItem[]): Promise<WeeklyPlanResponse> {
    const normalized = normalizePlanOrder(items);
    const localSnapshot: WeeklyPlanResponse = {
      week_start: getCurrentWeekMondayKey(),
      items: normalized,
    };
    writeLocalPlan(localSnapshot);

    if (!useAuthStore.getState().isAuthenticated) {
      return localSnapshot;
    }

    const res = await apiClient<WeeklyPlanResponse>('/workouts/weekly-plan', {
      method: 'PUT',
      body: JSON.stringify({ items: toUpsertPayload(normalized) }),
    });
    writeLocalPlan(res);
    return res;
  },

  async setRoutineWeekdays(
    routineId: string,
    daysOfWeek: number[],
    fallbackTitle = ''
  ): Promise<WeeklyPlanResponse> {
    const cleanDays = Array.from(new Set(daysOfWeek.filter((d) => d >= 1 && d <= 7))).sort(
      (a, b) => a - b
    );
    if (!useAuthStore.getState().isAuthenticated) {
      const current = readLocalPlan();
      const kept = current.items.filter(
        (it) => it.routine_id !== routineId || cleanDays.includes(it.day_of_week)
      );
      const existingDays = new Set(
        kept.filter((it) => it.routine_id === routineId).map((it) => it.day_of_week)
      );
      const added: WeeklyPlanItem[] = cleanDays
        .filter((d) => !existingDays.has(d))
        .map((d) => ({
          id: generateUUID(),
          day_of_week: d,
          order_index: 999,
          item_type: 'routine',
          routine_id: routineId,
          title: fallbackTitle,
          exercises: [],
          is_completed_this_week: false,
        }));
      const next: WeeklyPlanResponse = {
        week_start: current.week_start,
        items: normalizePlanOrder([...kept, ...added]),
      };
      writeLocalPlan(next);
      return next;
    }

    const res = await apiClient<WeeklyPlanResponse>('/workouts/weekly-plan/routine-days', {
      method: 'POST',
      body: JSON.stringify({
        routine_id: routineId,
        days_of_week: cleanDays,
      }),
    });
    writeLocalPlan(res);
    return res;
  },

  async toggleItemComplete(itemId: string, completed: boolean): Promise<WeeklyPlanResponse> {
    const current = readLocalPlan();
    const updatedLocal: WeeklyPlanResponse = {
      week_start: current.week_start,
      items: current.items.map((it) =>
        it.id === itemId ? { ...it, is_completed_this_week: completed } : it
      ),
    };
    writeLocalPlan(updatedLocal);

    if (!useAuthStore.getState().isAuthenticated) {
      return updatedLocal;
    }

    const res = await apiClient<WeeklyPlanResponse>(
      `/workouts/weekly-plan/${itemId}/toggle-complete`,
      {
        method: 'POST',
        body: JSON.stringify({ completed }),
      }
    );
    writeLocalPlan(res);
    return res;
  },
};
