export const KG_TO_LB = 2.20462262185;
export const LB_TO_KG = 0.45359237;

export function kgToLb(kg: number): number {
  return Math.round(kg * KG_TO_LB * 10) / 10;
}

export function lbToKg(lb: number): number {
  return Math.round(lb * LB_TO_KG * 10) / 10;
}

export function formatWeight(kg: number, unit: 'kg' | 'lb'): string {
  if (unit === 'lb') {
    return `${kgToLb(kg)} lb`;
  }
  return `${kg.toFixed(1)} kg`;
}

// Calculate E1RM via Epley formula
export function calculateE1RM(weightKg: number, reps: number): number | null {
  if (reps > 12) return null;
  if (reps === 1) return weightKg;
  const e1rm = weightKg * (1.0 + reps / 30.0);
  return Math.round(e1rm * 10) / 10;
}

// Calculate BMI
export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100.0;
  const bmi = weightKg / (heightM * heightM);
  return Math.round(bmi * 10) / 10;
}
