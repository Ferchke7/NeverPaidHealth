import { describe, it, expect } from 'vitest';
import {
  calculateE1RM,
  calculateVolume,
  calculateBMI,
  calculate7DaySMA,
  getBMICategory,
  getIdealWeightRange,
  calculateBMR,
  calculateTDEE,
  estimateBodyFatPercentage,
  calculateNavyBodyFat,
  calculateMacroSplit,
} from './calculations.ts';
import { cmToFtIn, ftInToCm, kgToLb, lbToKg } from './units.ts';

describe('Calculations Contract Parity', () => {
  describe('E1RM (Epley Formula)', () => {
    it('returns exact weight for 1 rep', () => {
      expect(calculateE1RM(100.0, 1)).toBe(100.0);
    });

    it('calculates 100kg x 5 reps -> 116.7kg', () => {
      expect(calculateE1RM(100.0, 5)).toBe(116.7);
    });

    it('calculates 80kg x 10 reps -> 106.7kg', () => {
      expect(calculateE1RM(80.0, 10)).toBe(106.7);
    });

    it('calculates 60kg x 12 reps -> 84.0kg', () => {
      expect(calculateE1RM(60.0, 12)).toBe(84.0);
    });

    it('returns null for reps > 12 (unreliable)', () => {
      expect(calculateE1RM(100.0, 13)).toBeNull();
    });

    it('returns null for non-positive inputs', () => {
      expect(calculateE1RM(0, 5)).toBeNull();
      expect(calculateE1RM(100, 0)).toBeNull();
    });
  });

  describe('Volume Calculation', () => {
    it('matches golden vector for mixed warmup, incomplete, and drop sets', () => {
      const sets = [
        { weight_kg: 100.0, reps: 5, type: 'normal', completed: true },
        { weight_kg: 60.0, reps: 10, type: 'warmup', completed: true },
        { weight_kg: 100.0, reps: 5, type: 'normal', completed: false },
        { weight_kg: 90.0, reps: 6, type: 'drop', completed: true },
      ];
      expect(calculateVolume(sets)).toBe(1040.0);
    });
  });

  describe('BMI Calculation', () => {
    it('calculates 80kg at 180cm -> 24.7', () => {
      expect(calculateBMI(80.0, 180.0)).toBe(24.7);
    });

    it('calculates 95kg at 175cm -> 31.0', () => {
      expect(calculateBMI(95.0, 175.0)).toBe(31.0);
    });

    it('calculates 65kg at 170cm -> 22.5', () => {
      expect(calculateBMI(65.0, 170.0)).toBe(22.5);
    });
  });

  describe('7-Day Simple Moving Average', () => {
    it('calculates 7-day average -> 80.1kg', () => {
      const weights = [80.0, 80.5, 80.2, 79.8, 80.1, 79.9, 80.3];
      expect(calculate7DaySMA(weights)).toBe(80.1);
    });

    it('calculates 3-day average -> 84.5kg', () => {
      const weights = [85.0, 84.5, 84.0];
      expect(calculate7DaySMA(weights)).toBe(84.5);
    });
  });

  describe('BMI Category & WHO Classification', () => {
    it('classifies underweight, normal, overweight, and obese', () => {
      expect(getBMICategory(17.5).category).toBe('underweight');
      expect(getBMICategory(22.5).category).toBe('normal');
      expect(getBMICategory(27.5).category).toBe('overweight');
      expect(getBMICategory(32.0).category).toBe('obese_1');
      expect(getBMICategory(37.0).category).toBe('obese_2');
    });
  });

  describe('Ideal Weight Range & Metabolism', () => {
    it('calculates ideal weight range for 180cm -> 59.9 to 80.7kg', () => {
      const range = getIdealWeightRange(180.0);
      expect(range.minKg).toBe(59.9);
      expect(range.maxKg).toBe(80.7);
    });

    it('calculates BMR for 80kg male 180cm 25yo -> 1805 kcal', () => {
      expect(calculateBMR(80, 180, 25, 'male')).toBe(1805);
    });

    it('calculates TDEE with moderate multiplier (1.55) -> 2798 kcal', () => {
      expect(calculateTDEE(1805, 1.55)).toBe(2798);
    });
  });

  describe('Body Fat Estimation & Macros', () => {
    it('estimates body fat percentage using Deurenberg formula', () => {
      const bf = estimateBodyFatPercentage(24.7, 25, 'male');
      expect(bf).toBeGreaterThan(15);
      expect(bf).toBeLessThan(25);
    });

    it('calculates US Navy body fat for male', () => {
      // 180cm height, 38cm neck, 84cm waist
      const navyBf = calculateNavyBodyFat(180, 38, 84, undefined, 'male');
      expect(navyBf).not.toBeNull();
      expect(navyBf).toBeGreaterThan(10);
      expect(navyBf).toBeLessThan(20);
    });

    it('calculates macro splits for 80kg at 2500 kcal', () => {
      const macros = calculateMacroSplit(80, 2500, 'maintain');
      expect(macros.proteinG).toBe(160); // 80 * 2.0
      expect(macros.fatG).toBe(72);     // 80 * 0.9
      expect(macros.carbG).toBeGreaterThan(200);
    });
  });

  describe('Unit Conversions', () => {
    it('converts cm to ft/in and back accurately', () => {
      const { feet, inches } = cmToFtIn(180);
      expect(feet).toBe(5);
      expect(Math.round(inches)).toBe(11);

      const cmBack = ftInToCm(5, 11);
      expect(Math.abs(cmBack - 180.3)).toBeLessThan(1);
    });

    it('converts kg and lb symmetrically', () => {
      const lb = kgToLb(80);
      expect(lb).toBe(176.4);
      expect(lbToKg(lb)).toBe(80);
    });
  });
});
