/**
 * Pure calculation functions adhering strictly to NeverPaidHealth calculation contracts.
 * Matches backend training/internal/domain/calc and calculation-vectors.json exactly.
 */

/**
 * Calculates Estimated 1RM using the Epley formula:
 * E1RM = weight * (1 + reps / 30)
 *
 * Rules:
 * - reps === 1: returns weightKg
 * - reps > 12: returns null (unreliable)
 * - reps <= 0 or weight <= 0: returns null
 * - Rounded to 1 decimal place.
 */
export function calculateE1RM(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps <= 0) return null;
  if (reps === 1) return Math.round(weightKg * 10) / 10;
  if (reps > 12) return null;

  const raw = weightKg * (1 + reps / 30);
  return Math.round(raw * 10) / 10;
}

export interface SetForVolume {
  weight_kg: number;
  reps: number;
  type?: string;
  set_type?: string;
  completed: boolean;
}

/**
 * Calculates total volume for a collection of sets.
 * Rules:
 * - Only includes completed sets.
 * - Warmup sets ('warmup') are excluded from total volume.
 */
export function calculateVolume(sets: SetForVolume[]): number {
  let total = 0;
  for (const s of sets) {
    const setType = s.type || s.set_type || 'normal';
    if (s.completed && setType !== 'warmup') {
      total += s.weight_kg * s.reps;
    }
  }
  return Math.round(total * 10) / 10;
}

/**
 * Calculates Body Mass Index:
 * BMI = weightKg / (heightMeters ^ 2)
 * Rounded to 1 decimal place.
 */
export function calculateBMI(weightKg: number, heightCm: number): number {
  if (weightKg <= 0 || heightCm <= 0) return 0;
  const heightM = heightCm / 100;
  const raw = weightKg / (heightM * heightM);
  return Math.round(raw * 10) / 10;
}

/**
 * Calculates 7-day Simple Moving Average from an array of recent weights (up to 7).
 * Rounded to 1 decimal place.
 */
export function calculate7DaySMA(weightsKg: number[]): number {
  if (!weightsKg || weightsKg.length === 0) return 0;
  const slice = weightsKg.slice(0, 7);
  const sum = slice.reduce((acc, w) => acc + w, 0);
  const raw = sum / slice.length;
  return Math.round(raw * 10) / 10;
}

export interface BMICategory {
  category: 'underweight' | 'normal' | 'overweight' | 'obese_1' | 'obese_2';
  labelRu: string;
  labelEn: string;
  color: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  minBMI: number;
  maxBMI: number;
  adviceRu: string;
  adviceEn: string;
}

/**
 * Returns WHO classification category and metadata for a given BMI value.
 */
export function getBMICategory(bmi: number): BMICategory {
  if (bmi <= 0) {
    return {
      category: 'normal',
      labelRu: 'Не определен',
      labelEn: 'Unspecified',
      color: '#71717a',
      textColor: 'text-zinc-400',
      bgColor: 'bg-zinc-800',
      borderColor: 'border-zinc-700',
      minBMI: 0,
      maxBMI: 0,
      adviceRu: 'Укажите рост и вес для расчета индекса массы тела.',
      adviceEn: 'Enter your height and weight to calculate BMI.',
    };
  }
  if (bmi < 18.5) {
    return {
      category: 'underweight',
      labelRu: 'Дефицит массы',
      labelEn: 'Underweight',
      color: '#38bdf8',
      textColor: 'text-sky-400',
      bgColor: 'bg-sky-500/15',
      borderColor: 'border-sky-500/30',
      minBMI: 0,
      maxBMI: 18.4,
      adviceRu: 'Рекомендуется легкий профицит калорий (+300-500 ккал) и силовые тренировки для набора мышечной массы.',
      adviceEn: 'Slight caloric surplus (+300-500 kcal) and progressive strength training recommended for muscle gain.',
    };
  }
  if (bmi < 25.0) {
    return {
      category: 'normal',
      labelRu: 'Нормальный вес',
      labelEn: 'Normal / Healthy',
      color: '#10b981',
      textColor: 'text-emerald-400',
      bgColor: 'bg-emerald-500/15',
      borderColor: 'border-emerald-500/30',
      minBMI: 18.5,
      maxBMI: 24.9,
      adviceRu: 'Отличный диапазон! Поддерживайте сбалансированное питание и прогрессируйте в тренировках.',
      adviceEn: 'Optimal healthy range! Maintain balanced nutrition and continue progressive overload.',
    };
  }
  if (bmi < 30.0) {
    return {
      category: 'overweight',
      labelRu: 'Избыточный вес',
      labelEn: 'Overweight',
      color: '#f59e0b',
      textColor: 'text-amber-400',
      bgColor: 'bg-amber-500/15',
      borderColor: 'border-amber-500/30',
      minBMI: 25.0,
      maxBMI: 29.9,
      adviceRu: 'Для тренирующихся атлетов это частая норма за счет мышц. Для снижения жировой прослойки держите дефицит -300 ккал.',
      adviceEn: 'Common for muscular athletes. For lean cutting, maintain a moderate -300 to -400 kcal deficit.',
    };
  }
  if (bmi < 35.0) {
    return {
      category: 'obese_1',
      labelRu: 'Ожирение I ст.',
      labelEn: 'Obese Class I',
      color: '#f97316',
      textColor: 'text-orange-400',
      bgColor: 'bg-orange-500/15',
      borderColor: 'border-orange-500/30',
      minBMI: 30.0,
      maxBMI: 34.9,
      adviceRu: 'Рекомендуется умеренный дефицит калорий (-400-500 ккал), регулярный силовой тренинг и 8 000+ шагов в день.',
      adviceEn: 'Focus on a sustainable caloric deficit (-400-500 kcal), consistent lifting, and 8,000+ daily steps.',
    };
  }
  return {
    category: 'obese_2',
    labelRu: 'Ожирение II+ ст.',
    labelEn: 'Obese Class II+',
    color: '#ef4444',
    textColor: 'text-red-400',
    bgColor: 'bg-red-500/15',
    borderColor: 'border-red-500/30',
    minBMI: 35.0,
    maxBMI: 60.0,
    adviceRu: 'Сфокусируйтесь на чистом рационе, постепенном снижении веса и контроле восстановления.',
    adviceEn: 'Prioritize whole-food nutrition, gradual sustainable fat loss, and consistent daily movement.',
  };
}

/**
 * Calculates healthy/normal weight range (BMI 18.5 - 24.9) for a given height in cm.
 */
export function getIdealWeightRange(heightCm: number): { minKg: number; maxKg: number } {
  if (heightCm <= 0) return { minKg: 0, maxKg: 0 };
  const hM = heightCm / 100;
  const minKg = Math.round(18.5 * hM * hM * 10) / 10;
  const maxKg = Math.round(24.9 * hM * hM * 10) / 10;
  return { minKg, maxKg };
}

/**
 * Calculates Basal Metabolic Rate using Mifflin-St Jeor formula.
 */
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  ageYears: number = 25,
  gender: 'male' | 'female' = 'male'
): number {
  if (weightKg <= 0 || heightCm <= 0 || ageYears <= 0) return 0;
  if (gender === 'female') {
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * ageYears - 161);
  }
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5);
}

/**
 * Calculates Total Daily Energy Expenditure (TDEE) based on BMR and activity multiplier.
 */
export function calculateTDEE(bmr: number, activityMultiplier: number = 1.375): number {
  if (bmr <= 0) return 0;
  return Math.round(bmr * activityMultiplier);
}

/**
 * Estimates body fat percentage using Deurenberg formula based on BMI, age, and sex.
 * Adult BF% = (1.20 × BMI) + (0.23 × Age) − (10.8 × sex) − 5.4 (sex: male = 1, female = 0)
 */
export function estimateBodyFatPercentage(
  bmi: number,
  ageYears: number = 25,
  gender: 'male' | 'female' = 'male'
): number {
  if (bmi <= 0 || ageYears <= 0) return 0;
  const sexFactor = gender === 'male' ? 1 : 0;
  const raw = (1.20 * bmi) + (0.23 * ageYears) - (10.8 * sexFactor) - 5.4;
  return Math.max(3, Math.min(60, Math.round(raw * 10) / 10));
}

/**
 * US Navy Body Fat formula estimation for males and females (circumferences in cm).
 */
export function calculateNavyBodyFat(
  heightCm: number,
  neckCm: number,
  waistCm: number,
  hipsCm?: number,
  gender: 'male' | 'female' = 'male'
): number | null {
  if (heightCm <= 0 || neckCm <= 0 || waistCm <= 0) return null;

  if (gender === 'male') {
    const diff = waistCm - neckCm;
    if (diff <= 0) return null;
    // 495 / (1.0324 - 0.19077 * log10(waist - neck) + 0.15456 * log10(height)) - 450
    const val = 495 / (1.0324 - 0.19077 * Math.log10(diff) + 0.15456 * Math.log10(heightCm)) - 450;
    return Math.round(Math.max(2, Math.min(60, val)) * 10) / 10;
  } else {
    if (!hipsCm || hipsCm <= 0) return null;
    const diff = waistCm + hipsCm - neckCm;
    if (diff <= 0) return null;
    // 495 / (1.29579 - 0.35004 * log10(waist + hip - neck) + 0.22100 * log10(height)) - 450
    const val = 495 / (1.29579 - 0.35004 * Math.log10(diff) + 0.22100 * Math.log10(heightCm)) - 450;
    return Math.round(Math.max(5, Math.min(60, val)) * 10) / 10;
  }
}

/**
 * Calculates optimal bodybuilding macro split based on bodyweight, calories, and diet goal.
 */
export function calculateMacroSplit(
  weightKg: number,
  calories: number,
  goal: 'cut' | 'maintain' | 'bulk' = 'maintain'
): { proteinG: number; fatG: number; carbG: number } {
  if (weightKg <= 0 || calories <= 0) {
    return { proteinG: 0, fatG: 0, carbG: 0 };
  }

  // Protein target: Cut -> 2.2 g/kg, Maintain -> 2.0 g/kg, Bulk -> 2.0 g/kg
  const proteinMultiplier = goal === 'cut' ? 2.2 : 2.0;
  const proteinG = Math.round(weightKg * proteinMultiplier);

  // Fat target: ~0.9 g/kg (minimum 20% of calories)
  const fatG = Math.max(30, Math.round(weightKg * 0.9));

  // Carbs from remaining calories (4 kcal/g)
  const proteinCal = proteinG * 4;
  const fatCal = fatG * 9;
  const remainingCal = Math.max(0, calories - (proteinCal + fatCal));
  const carbG = Math.round(remainingCal / 4);

  return { proteinG, fatG, carbG };
}
