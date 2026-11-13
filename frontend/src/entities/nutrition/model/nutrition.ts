/** Preserve explicit zero and reject non-finite/negative nutritional values. */
export function readNutritionNumber(input: string, fallback = 0): number {
  const value = input.trim() === '' ? fallback : Number(input.replace(',', '.'));
  return Number.isFinite(value) && value >= 0 ? value : 0;
}
