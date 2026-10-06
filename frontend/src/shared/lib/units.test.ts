import { describe, it, expect } from 'vitest';
import { calculateE1RM, calculateBMI, kgToLb, lbToKg } from './units.ts';

const calculationVectors = {
  e1rm: [
    { weight_kg: 100.0, reps: 1, expected_e1rm_kg: 100.0 },
    { weight_kg: 100.0, reps: 5, expected_e1rm_kg: 116.7 },
    { weight_kg: 80.0, reps: 10, expected_e1rm_kg: 106.7 },
    { weight_kg: 60.0, reps: 12, expected_e1rm_kg: 84.0 },
    { weight_kg: 100.0, reps: 13, expected_e1rm_kg: null },
  ],
  bmi: [
    { weight_kg: 80.0, height_cm: 180.0, expected_bmi: 24.7 },
    { weight_kg: 95.0, height_cm: 175.0, expected_bmi: 31.0 },
    { weight_kg: 65.0, height_cm: 170.0, expected_bmi: 22.5 },
  ],
};

describe('Frontend Calculation Parity with Golden Vectors', () => {
  it('E1RM vectors match exact formula outputs', () => {
    for (const vector of calculationVectors.e1rm) {
      const result = calculateE1RM(vector.weight_kg, vector.reps);
      expect(result).toBe(vector.expected_e1rm_kg);
    }
  });

  it('BMI vectors match exact formula outputs', () => {
    for (const vector of calculationVectors.bmi) {
      const result = calculateBMI(vector.weight_kg, vector.height_cm);
      expect(result).toBe(vector.expected_bmi);
    }
  });

  it('Weight conversions are reciprocal and accurate', () => {
    expect(kgToLb(100)).toBe(220.5);
    expect(lbToKg(220.46)).toBe(100.0);
  });
});
