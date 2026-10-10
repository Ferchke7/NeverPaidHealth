export const KG_TO_LB = 2.20462262185;
export const LB_TO_KG = 0.45359237;
export const INCH_TO_CM = 2.54;
export const CM_TO_INCH = 0.393700787;

export function kgToLb(kg: number): number {
  return Math.round(kg * KG_TO_LB * 10) / 10;
}

export function lbToKg(lb: number): number {
  return Math.round(lb * LB_TO_KG * 10) / 10;
}

export function cmToInches(cm: number): number {
  return Math.round(cm * CM_TO_INCH * 10) / 10;
}

export function inchesToCm(inches: number): number {
  return Math.round(inches * INCH_TO_CM * 10) / 10;
}

export function cmToFtIn(cm: number): { feet: number; inches: number } {
  if (cm <= 0) return { feet: 0, inches: 0 };
  const totalInches = cm * CM_TO_INCH;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round((totalInches % 12) * 10) / 10;
  return { feet, inches };
}

export function ftInToCm(feet: number, inches: number): number {
  const totalInches = (feet * 12) + (inches || 0);
  return Math.round(totalInches * INCH_TO_CM * 10) / 10;
}

export function formatWeight(kg: number, unit: 'kg' | 'lb' | 'metric' | 'imperial' = 'kg'): string {
  if (unit === 'lb' || unit === 'imperial') {
    const val = kgToLb(kg);
    return Number.isInteger(val) ? `${val} lb` : `${val.toFixed(1)} lb`;
  }
  const cleanKg = Math.round(kg * 10) / 10;
  return Number.isInteger(cleanKg) ? `${cleanKg} kg` : `${cleanKg.toFixed(1)} kg`;
}

export function formatHeight(cm: number, unit: 'kg' | 'lb' | 'metric' | 'imperial' = 'metric'): string {
  if (cm <= 0) return '—';
  if (unit === 'lb' || unit === 'imperial') {
    const { feet, inches } = cmToFtIn(cm);
    return `${feet}′ ${inches}″`;
  }
  return `${Math.round(cm)} cm`;
}

// Calculate E1RM via Epley formula
export function calculateE1RM(weightKg: number, reps: number): number | null {
  if (reps <= 0 || weightKg <= 0) return null;
  if (reps > 12) return null;
  if (reps === 1) return Math.round(weightKg * 10) / 10;
  const e1rm = weightKg * (1.0 + reps / 30.0);
  return Math.round(e1rm * 10) / 10;
}

// Calculate BMI
export function calculateBMI(weightKg: number, heightCm: number): number {
  if (weightKg <= 0 || heightCm <= 0) return 0;
  const heightM = heightCm / 100.0;
  const bmi = weightKg / (heightM * heightM);
  return Math.round(bmi * 10) / 10;
}
