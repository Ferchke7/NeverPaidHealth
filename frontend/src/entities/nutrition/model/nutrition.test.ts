import { describe, it, expect } from 'vitest';
import { readNutritionNumber } from './nutrition.ts';

describe('nutrition corrections', () => {
  it('preserves explicit zero instead of restoring the AI estimate', () => {
    expect(readNutritionNumber('0', 45)).toBe(0);
    expect(readNutritionNumber('12,5', 45)).toBe(12.5);
  });
  it('uses the estimate only when the field is empty', () => {
    expect(readNutritionNumber('', 45)).toBe(45);
    expect(readNutritionNumber('  ', 45)).toBe(45);
  });
  it('never saves invalid or negative macros', () => {
    expect(readNutritionNumber('-5', 45)).toBe(0);
    expect(readNutritionNumber('Infinity')).toBe(0);
    expect(readNutritionNumber('invalid')).toBe(0);
  });
});
