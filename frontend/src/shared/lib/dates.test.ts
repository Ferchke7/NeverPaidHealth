import { describe, it, expect } from 'vitest';
import { toLocalDateKey } from './dates.ts';

describe('Date utilities', () => {
  it('toLocalDateKey formats date according to local timezone components', () => {
    // Construct local date directly
    const d = new Date(2026, 9, 15, 23, 30); // Oct 15, 2026, 23:30 local time
    expect(toLocalDateKey(d)).toBe('2026-10-15');

    const pastMidnight = new Date(2026, 9, 16, 0, 15); // Oct 16, 2026, 00:15 local time
    expect(toLocalDateKey(pastMidnight)).toBe('2026-10-16');
  });

  it('toLocalDateKey handles string timestamps correctly', () => {
    const key = toLocalDateKey('2026-10-15T12:00:00Z');
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
