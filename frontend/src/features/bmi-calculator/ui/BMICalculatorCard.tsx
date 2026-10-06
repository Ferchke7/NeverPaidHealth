import React, { useState, useMemo } from 'react';
import {
  Zap,
  Flame,
  Scale,
  Save,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import {
  calculateBMI,
  getBMICategory,
  getIdealWeightRange,
  calculateBMR,
  calculateTDEE,
} from '../../../shared/lib/calculations.ts';
import { formatWeight, lbToKg, kgToLb } from '../../../shared/lib/units.ts';
import { Card } from '../../../shared/ui/card.tsx';
import { Button } from '../../../shared/ui/button.tsx';
import { Input } from '../../../shared/ui/input.tsx';

interface BMICalculatorCardProps {
  initialHeightCm?: number;
  initialWeightKg?: number;
  onSaveStats?: (stats: { heightCm: number; weightKg: number }) => void;
  className?: string;
}

const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Sedentary', multiplier: 1.2, desc: 'Little to no exercise / desk job' },
  { id: 'light', label: 'Light (1-3 days/wk)', multiplier: 1.375, desc: 'Light workouts 1-3 times a week' },
  { id: 'moderate', label: 'Moderate (3-5 days/wk)', multiplier: 1.55, desc: 'Moderate gym sessions 3-5 days' },
  { id: 'active', label: 'Active (6-7 days/wk)', multiplier: 1.725, desc: 'Hard training 6-7 days a week' },
  { id: 'athlete', label: 'Very Active / Athlete', multiplier: 1.9, desc: 'Twice a day training or physical work' },
];

export const BMICalculatorCard: React.FC<BMICalculatorCardProps> = ({
  initialHeightCm,
  initialWeightKg,
  onSaveStats,
  className = '',
}) => {
  const user = useAuthStore((s) => s.user);
  const unitPref = useAuthStore((s) => s.unitPreference);
  const updateUserStats = useAuthStore((s) => s.updateUserStats);

  // Local state
  const defaultHeight = initialHeightCm || user?.height_cm || 178;
  const defaultWeight = initialWeightKg || user?.weight_kg || 78;

  const [heightCm, setHeightCm] = useState<string>(defaultHeight ? defaultHeight.toString() : '178');
  const [weightInput, setWeightInput] = useState<string>(() => {
    if (!defaultWeight) return unitPref === 'lb' ? '172' : '78';
    return unitPref === 'lb' ? kgToLb(defaultWeight).toFixed(1) : defaultWeight.toFixed(1);
  });
  const [gender, setGender] = useState<'male' | 'female'>(user?.gender || 'male');
  const [age, setAge] = useState<string>('26');
  const [activity, setActivity] = useState<string>('moderate');
  const [goal, setGoal] = useState<'cut' | 'maintain' | 'bulk'>('maintain');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Parse numeric values
  const numericHeight = parseFloat(heightCm) || 0;
  const rawWeight = parseFloat(weightInput) || 0;
  const numericWeightKg = unitPref === 'lb' ? lbToKg(rawWeight) : rawWeight;
  const numericAge = parseInt(age) || 25;

  // Real-time calculations
  const bmi = useMemo(() => calculateBMI(numericWeightKg, numericHeight), [numericWeightKg, numericHeight]);
  const bmiCat = useMemo(() => getBMICategory(bmi), [bmi]);
  const idealRange = useMemo(() => getIdealWeightRange(numericHeight), [numericHeight]);

  const bmr = useMemo(
    () => calculateBMR(numericWeightKg, numericHeight, numericAge, gender),
    [numericWeightKg, numericHeight, numericAge, gender]
  );

  const selectedActivity = ACTIVITY_LEVELS.find((a) => a.id === activity) || ACTIVITY_LEVELS[2];
  const tdee = useMemo(() => calculateTDEE(bmr, selectedActivity.multiplier), [bmr, selectedActivity]);

  const targetCalories = useMemo(() => {
    if (goal === 'cut') return Math.max(1200, tdee - 400);
    if (goal === 'bulk') return tdee + 300;
    return tdee;
  }, [tdee, goal]);

  // Macronutrient breakdown
  const macros = useMemo(() => {
    if (numericWeightKg <= 0 || targetCalories <= 0) {
      return { proteinG: 0, fatG: 0, carbG: 0 };
    }
    const proteinG = Math.round(numericWeightKg * (goal === 'cut' ? 2.2 : 2.0));
    const fatG = Math.round(numericWeightKg * 0.9);
    const proteinCal = proteinG * 4;
    const fatCal = fatG * 9;
    const remainingCal = Math.max(0, targetCalories - (proteinCal + fatCal));
    const carbG = Math.round(remainingCal / 4);
    return { proteinG, fatG, carbG };
  }, [numericWeightKg, targetCalories, goal]);

  // Gauge needle position (15 to 40 BMI scale -> 0% to 100%)
  const gaugePercent = useMemo(() => {
    if (bmi <= 15) return 2;
    if (bmi >= 40) return 98;
    return Math.min(98, Math.max(2, ((bmi - 15) / (40 - 15)) * 100));
  }, [bmi]);

  const handleSave = () => {
    if (numericHeight > 0 && numericWeightKg > 0) {
      updateUserStats({
        height_cm: numericHeight,
        weight_kg: numericWeightKg,
        gender,
      });

      if (onSaveStats) {
        onSaveStats({ heightCm: numericHeight, weightKg: numericWeightKg });
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    }
  };

  return (
    <Card className={`p-5 bg-dark-800/90 border-dark-700/90 space-y-5 shadow-xl ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-dark-700/80 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-400 flex items-center justify-center shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <span>Body Metrics & BMI Calculator</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">
                Live Analysis
              </span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Enter your height and weight to calculate BMI, BMR, TDEE, and ideal physique benchmarks.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={!numericHeight || !numericWeightKg}
          className="text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto"
        >
          {saveSuccess ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Saved to Profile!</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5 text-brand-400" />
              <span>Save to Profile</span>
            </>
          )}
        </Button>
      </div>

      {/* Input Controls Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-dark-900/60 p-3.5 rounded-2xl border border-dark-700/60">
        {/* Height */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
            Height (cm) *
          </label>
          <Input
            type="number"
            min={100}
            max={250}
            placeholder="180"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            className="font-mono text-center font-bold"
          />
        </div>

        {/* Weight */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
            Weight ({unitPref.toUpperCase()}) *
          </label>
          <Input
            type="number"
            step="0.1"
            min={30}
            max={300}
            placeholder={unitPref === 'lb' ? '175' : '80'}
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            className="font-mono text-center font-bold"
          />
        </div>

        {/* Gender */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
            Biological Sex
          </label>
          <div className="grid grid-cols-2 gap-1 bg-dark-800 p-1 rounded-xl border border-dark-700">
            <button
              type="button"
              onClick={() => setGender('male')}
              className={`py-1 rounded-lg text-xs font-bold transition-all ${
                gender === 'male'
                  ? 'bg-brand-500 text-dark-950 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Male
            </button>
            <button
              type="button"
              onClick={() => setGender('female')}
              className={`py-1 rounded-lg text-xs font-bold transition-all ${
                gender === 'female'
                  ? 'bg-brand-500 text-dark-950 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Female
            </button>
          </div>
        </div>

        {/* Age */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
            Age (years)
          </label>
          <Input
            type="number"
            min={12}
            max={100}
            placeholder="25"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="font-mono text-center font-bold"
          />
        </div>
      </div>

      {/* Primary BMI Visual Gauge & Category Section */}
      <div className="p-4 rounded-2xl bg-dark-900 border border-dark-700/80 space-y-3.5 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Main BMI Number */}
          <div className="flex items-baseline gap-3">
            <div className="text-3xl font-black font-mono text-white tracking-tight">
              {bmi > 0 ? bmi.toFixed(1) : '—'}
            </div>
            <div>
              <div className="text-xs uppercase font-bold text-zinc-400">BMI Index</div>
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border mt-0.5 ${bmiCat.bgColor} ${bmiCat.textColor} ${bmiCat.borderColor}`}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: bmiCat.color }} />
                <span>{bmiCat.labelEn} ({bmiCat.labelRu})</span>
              </div>
            </div>
          </div>

          {/* Healthy Weight Target */}
          {idealRange.minKg > 0 && (
            <div className="bg-dark-800/80 border border-dark-700/70 px-3.5 py-2 rounded-xl text-right sm:text-right text-xs">
              <span className="text-[10px] text-zinc-400 uppercase font-semibold block">
                Healthy Weight Range
              </span>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                {formatWeight(idealRange.minKg, unitPref)} – {formatWeight(idealRange.maxKg, unitPref)}
              </span>
            </div>
          )}
        </div>

        {/* Colorful Multi-zone Spectrum Gauge */}
        <div className="space-y-1.5 pt-1">
          <div className="relative h-4 rounded-full overflow-hidden flex bg-dark-800 border border-dark-700">
            {/* Underweight */}
            <div className="h-full bg-sky-500/80" style={{ width: '14%' }} title="Underweight (< 18.5)" />
            {/* Normal */}
            <div className="h-full bg-emerald-500/90" style={{ width: '26%' }} title="Normal (18.5 - 24.9)" />
            {/* Overweight */}
            <div className="h-full bg-amber-500/90" style={{ width: '20%' }} title="Overweight (25 - 29.9)" />
            {/* Obese 1 */}
            <div className="h-full bg-orange-500/90" style={{ width: '20%' }} title="Obese I (30 - 34.9)" />
            {/* Obese 2 */}
            <div className="h-full bg-red-500/90" style={{ width: '20%' }} title="Obese II+ (35+)" />

            {/* Current Value Needle / Marker */}
            {bmi > 0 && (
              <div
                className="absolute top-0 bottom-0 w-1.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] rounded-full transition-all duration-500"
                style={{ left: `${gaugePercent}%`, transform: 'translateX(-50%)' }}
              />
            )}
          </div>

          {/* Gauge Legend */}
          <div className="flex justify-between text-[10px] text-zinc-500 font-mono pt-0.5">
            <span className="text-sky-400">18.5</span>
            <span className="text-emerald-400">25.0</span>
            <span className="text-amber-400">30.0</span>
            <span className="text-orange-400">35.0</span>
            <span className="text-red-400">40.0+</span>
          </div>
        </div>

        {/* Personalized Coach Tip */}
        <div className="flex items-start gap-2 text-xs text-zinc-300 bg-dark-800/60 p-2.5 rounded-xl border border-dark-700/50">
          <Info className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">{bmiCat.adviceRu}</p>
        </div>
      </div>

      {/* Metabolic Rate & Nutrition Targets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Left: Metabolism & TDEE */}
        <div className="bg-dark-900/80 border border-dark-700/70 p-4 rounded-2xl space-y-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
              Metabolism & Daily Burn
            </h3>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs py-1 border-b border-dark-800">
              <span className="text-zinc-400">BMR (Basal Metabolic Rate):</span>
              <span className="font-mono font-bold text-white">
                {bmr > 0 ? `${bmr.toLocaleString()} kcal` : '—'}
              </span>
            </div>

            <div className="space-y-1 pt-1">
              <label className="text-[11px] text-zinc-400 block font-medium">Activity Multiplier:</label>
              <select
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-brand-500 font-medium"
              >
                {ACTIVITY_LEVELS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} (×{a.multiplier})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between text-xs pt-2">
              <span className="text-zinc-300 font-semibold">TDEE (Daily Maintenance):</span>
              <span className="font-mono font-extrabold text-brand-400 text-sm">
                {tdee > 0 ? `${tdee.toLocaleString()} kcal/day` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Nutrition Targets & Macro Split */}
        <div className="bg-dark-900/80 border border-dark-700/70 p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-brand-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                Nutrition Target
              </h3>
            </div>

            {/* Goal Toggle */}
            <div className="flex gap-1 bg-dark-800 p-0.5 rounded-lg border border-dark-700 text-[10px]">
              <button
                type="button"
                onClick={() => setGoal('cut')}
                className={`px-2 py-0.5 rounded font-bold ${
                  goal === 'cut' ? 'bg-amber-500 text-dark-950' : 'text-zinc-400'
                }`}
              >
                Cut
              </button>
              <button
                type="button"
                onClick={() => setGoal('maintain')}
                className={`px-2 py-0.5 rounded font-bold ${
                  goal === 'maintain' ? 'bg-brand-500 text-dark-950' : 'text-zinc-400'
                }`}
              >
                Maintain
              </button>
              <button
                type="button"
                onClick={() => setGoal('bulk')}
                className={`px-2 py-0.5 rounded font-bold ${
                  goal === 'bulk' ? 'bg-emerald-500 text-dark-950' : 'text-zinc-400'
                }`}
              >
                Bulk
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs py-1 border-b border-dark-800">
              <span className="text-zinc-400">Target Calories:</span>
              <span className="font-mono font-bold text-white">
                {targetCalories > 0 ? `${targetCalories.toLocaleString()} kcal` : '—'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="bg-dark-800 p-2 rounded-xl border border-dark-700/80 text-center">
                <span className="text-[10px] text-zinc-400 uppercase block font-semibold">Protein</span>
                <span className="font-mono font-bold text-xs text-rose-400">
                  {macros.proteinG}g
                </span>
              </div>
              <div className="bg-dark-800 p-2 rounded-xl border border-dark-700/80 text-center">
                <span className="text-[10px] text-zinc-400 uppercase block font-semibold">Fats</span>
                <span className="font-mono font-bold text-xs text-amber-400">
                  {macros.fatG}g
                </span>
              </div>
              <div className="bg-dark-800 p-2 rounded-xl border border-dark-700/80 text-center">
                <span className="text-[10px] text-zinc-400 uppercase block font-semibold">Carbs</span>
                <span className="font-mono font-bold text-xs text-sky-400">
                  {macros.carbG}g
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
