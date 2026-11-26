import { describe, expect, it } from 'vitest';
import {
  WeeklyPlanItem,
  distributeProgramAcrossWeek,
  movePlanItemToWeekday,
  movePlanItemWithinDay,
  swapPlanWeekdays,
} from './weeklyPlanApi.ts';

const makeItem = (
  id: string,
  day: number,
  order: number,
  title: string
): WeeklyPlanItem => ({
  id,
  day_of_week: day,
  order_index: order,
  item_type: 'routine',
  routine_id: `rot-${id}`,
  title,
  exercises: [],
  is_completed_this_week: false,
});

describe('weeklyPlanApi pure scheduling helpers', () => {
  it('reorders multiple workouts within the same weekday', () => {
    const initial = [
      makeItem('a', 1, 0, 'Morning Cardio'),
      makeItem('b', 1, 1, 'Evening Push'),
      makeItem('c', 3, 0, 'Pull Day'),
    ];

    const moved = movePlanItemWithinDay(initial, 'b', 'up');
    const monday = moved.filter((i) => i.day_of_week === 1);
    expect(monday.map((i) => i.id)).toEqual(['b', 'a']);
    expect(monday.map((i) => i.order_index)).toEqual([0, 1]);
  });

  it('moves an item to another weekday and appends it in order', () => {
    const initial = [
      makeItem('a', 1, 0, 'Morning Cardio'),
      makeItem('b', 1, 1, 'Evening Push'),
      makeItem('c', 2, 0, 'Legs'),
    ];

    const moved = movePlanItemToWeekday(initial, 'a', 2);
    expect(moved.filter((i) => i.day_of_week === 1).map((i) => i.id)).toEqual(['b']);
    expect(moved.filter((i) => i.day_of_week === 2).map((i) => i.id)).toEqual(['c', 'a']);
  });

  it('swaps two weekdays cleanly while preserving intra-day order', () => {
    const initial = [
      makeItem('m1', 1, 0, 'Abs'),
      makeItem('m2', 1, 1, 'Push'),
      makeItem('f1', 5, 0, 'Full Body'),
    ];

    const swapped = swapPlanWeekdays(initial, 1, 5);
    expect(swapped.filter((i) => i.day_of_week === 5).map((i) => i.id)).toEqual(['m1', 'm2']);
    expect(swapped.filter((i) => i.day_of_week === 1).map((i) => i.id)).toEqual(['f1']);
  });

  it('distributes a 3-day program across Mon/Wed/Fri without erasing other programs', () => {
    const existing = [makeItem('core', 1, 0, 'Core Routine')];
    const distributed = distributeProgramAcrossWeek(existing, {
      id: 'prog-ppl',
      name: 'Jeff PPL',
      split_type: 'ppl',
      days_per_week: 3,
      level: 'intermediate',
      is_public: true,
      likes_count: 0,
      installs_count: 0,
      days: [
        { day_number: 1, name: 'Push', exercises: [] },
        { day_number: 2, name: 'Pull', exercises: [] },
        { day_number: 3, name: 'Legs', exercises: [] },
      ],
    });

    expect(distributed.filter((i) => i.day_of_week === 1)).toHaveLength(2);
    expect(distributed.find((i) => i.day_of_week === 3)?.title).toBe('Pull');
    expect(distributed.find((i) => i.day_of_week === 5)?.title).toBe('Legs');
  });
});
