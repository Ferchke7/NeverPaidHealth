import React, { useState, useMemo, useEffect } from 'react';
import {
  Zap,
  Flame,
  Scale,
  Save,
  CheckCircle2,
  Info,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { apiClient } from '../../../shared/api/client.ts';
import {
  calculateBMI,
  getBMICategory,
  getIdealWeightRange,
  calculateBMR,
  calculateTDEE,
  estimateBodyFatPercentage,
  calculateMacroSplit,
} from '../../../shared/lib/calculations.ts';
import { formatWeight, lbToKg, kgToLb, cmToFtIn, ftInToCm } from '../../../shared/lib/units.ts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../shared/ui/card.tsx';
import { Button } from '../../../shared/ui/button.tsx';
import { Input } from '../../../shared/ui/input.tsx';
import { Badge } from '../../../shared/ui/card.tsx';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

interface BMICalculatorCardProps {
  initialHeightCm?: number;
  initialWeightKg?: number;
  onSaveStats?: (stats: { heightCm: number; weightKg: number }) => void;
  className?: string;
}

export const BMICalculatorCard: React.FC<BMICalculatorCardProps> = ({
  initialHeightCm,
  initialWeightKg,
  onSaveStats,
  className = '',
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const unitPref = useAuthStore((s) => s.unitPreference);
  const updateUserStats = useAuthStore((s) => s.updateUserStats);

  const ACTIVITY_LEVELS = [
    { id: 'sedentary', label: t('bmi.actSedentary'), multiplier: 1.2, desc: t('bmi.actSedentaryDesc') },
    { id: 'light', label: t('bmi.actLight'), multiplier: 1.375, desc: t('bmi.actLightDesc') },
    { id: 'moderate', label: t('bmi.actModerate'), multiplier: 1.55, desc: t('bmi.actModerateDesc') },
    { id: 'active', label: t('bmi.actActive'), multiplier: 1.725, desc: t('bmi.actActiveDesc') },
    { id: 'athlete', label: t('bmi.actAthlete'), multiplier: 1.9, desc: t('bmi.actAthleteDesc') },
  ];

  // Fetch actual body trends and latest weigh-in logs from backend
  const { data: trend } = useQuery<{
    current_weight_kg: number;
    current_7day_sma_kg: number;
    delta_7day_kg?: number;
    delta_30day_kg?: number;
  }>({
    queryKey: ['body-trend'],
    queryFn: () => apiClient.get('/body/trend'),
  });

  const { data: logs = [] } = useQuery<Array<{ id: string; log_date: string; weight_kg: number; height_cm?: number }>>({
    queryKey: ['body-logs'],
    queryFn: () => apiClient.get('/body/logs'),
  });

  // Determine latest recorded weight from DB / store
  const latestRecordedWeightKg = useMemo(() => {
    if (initialWeightKg) return initialWeightKg;
    if (trend?.current_weight_kg && trend.current_weight_kg > 0) return trend.current_weight_kg;
    if (logs.length > 0) return logs[logs.length - 1].weight_kg;
    if (user?.weight_kg && user.weight_kg > 0) return user.weight_kg;
    const local = Number(localStorage.getItem('np_current_weight_kg'));
    if (local > 0) return local;
    return 78;
  }, [initialWeightKg, trend, logs, user]);

  // Determine latest recorded height from DB / store
  const latestRecordedHeightCm = useMemo(() => {
    if (initialHeightCm) return initialHeightCm;
    if (user?.height_cm && user.height_cm > 0) return user.height_cm;
    const local = Number(localStorage.getItem('np_saved_height_cm'));
    if (local > 0) return local;
    return 178;
  }, [initialHeightCm, user]);

  // Height Mode state (cm vs ft/in)
  const [heightMode, setHeightMode] = useState<'cm' | 'ft'>(unitPref === 'lb' ? 'ft' : 'cm');

  // Height inputs
  const [heightCmInput, setHeightCmInput] = useState<string>(latestRecordedHeightCm.toString());
  const [feetInput, setFeetInput] = useState<string>(() => {
    const { feet } = cmToFtIn(latestRecordedHeightCm);
    return feet.toString();
  });
  const [inchesInput, setInchesInput] = useState<string>(() => {
    const { inches } = cmToFtIn(latestRecordedHeightCm);
    return inches.toString();
  });

  // Weight input
  const [weightInput, setWeightInput] = useState<string>(() => {
    return unitPref === 'lb'
      ? kgToLb(latestRecordedWeightKg).toFixed(1)
      : latestRecordedWeightKg.toFixed(1);
  });

  const [hasUserEditedWeight, setHasUserEditedWeight] = useState(false);
  const [hasUserEditedHeight, setHasUserEditedHeight] = useState(false);

  // Demographics state
  const [gender, setGender] = useState<'male' | 'female'>(user?.gender || 'male');
  const [age, setAge] = useState<string>('26');
  const [activity, setActivity] = useState<string>('moderate');
  const [goal, setGoal] = useState<'cut' | 'maintain' | 'bulk'>(() => {
    return user?.diet_goal || (localStorage.getItem('np_diet_goal') as any) || 'maintain';
  });

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Synchronize weightInput when latestRecordedWeightKg changes (unless user manually modified it)
  useEffect(() => {
    if (!hasUserEditedWeight && latestRecordedWeightKg > 0) {
      setWeightInput(
        unitPref === 'lb'
          ? kgToLb(latestRecordedWeightKg).toFixed(1)
          : latestRecordedWeightKg.toFixed(1)
      );
    }
  }, [latestRecordedWeightKg, unitPref, hasUserEditedWeight]);

  // Synchronize heightInput when latestRecordedHeightCm changes
  useEffect(() => {
    if (!hasUserEditedHeight && latestRecordedHeightCm > 0) {
      setHeightCmInput(latestRecordedHeightCm.toString());
      const { feet, inches } = cmToFtIn(latestRecordedHeightCm);
      setFeetInput(feet.toString());
      setInchesInput(inches.toString());
    }
  }, [latestRecordedHeightCm, hasUserEditedHeight]);

  // Compute effective numeric height in cm
  const numericHeight = useMemo(() => {
    if (heightMode === 'ft') {
      const f = parseFloat(feetInput) || 0;
      const i = parseFloat(inchesInput) || 0;
      return ftInToCm(f, i);
    }
    return parseFloat(heightCmInput) || 0;
  }, [heightMode, heightCmInput, feetInput, inchesInput]);

  // Compute effective numeric weight in kg
  const numericWeightKg = useMemo(() => {
    const raw = parseFloat(weightInput) || 0;
    return unitPref === 'lb' ? lbToKg(raw) : raw;
  }, [weightInput, unitPref]);

  // Primary BMI & Health calculations
  const bmi = useMemo(() => {
    return calculateBMI(numericWeightKg, numericHeight);
  }, [numericWeightKg, numericHeight]);

  const bmiCat = useMemo(() => {
    return getBMICategory(bmi);
  }, [bmi]);

  const idealRange = useMemo(() => {
    return getIdealWeightRange(numericHeight);
  }, [numericHeight]);

  const numericAge = parseInt(age, 10) || 25;

  const bmr = useMemo(() => {
    return calculateBMR(numericWeightKg, numericHeight, numericAge, gender);
  }, [numericWeightKg, numericHeight, numericAge, gender]);

  const selectedActivityMultiplier = useMemo(() => {
    const found = ACTIVITY_LEVELS.find((a) => a.id === activity);
    return found ? found.multiplier : 1.55;
  }, [activity, ACTIVITY_LEVELS]);

  const tdee = useMemo(() => {
    return calculateTDEE(bmr, selectedActivityMultiplier);
  }, [bmr, selectedActivityMultiplier]);

  const estimatedBodyFat = useMemo(() => {
    return estimateBodyFatPercentage(bmi, numericAge, gender);
  }, [bmi, numericAge, gender]);

  const targetCalories = useMemo(() => {
    if (goal === 'cut') return Math.max(1200, Math.round(tdee - 400));
    if (goal === 'bulk') return Math.round(tdee + 350);
    return Math.round(tdee);
  }, [tdee, goal]);

  const macros = useMemo(() => {
    return calculateMacroSplit(targetCalories, numericWeightKg, goal);
  }, [targetCalories, numericWeightKg, goal]);

  // Gauge bar needle position calculation (0 to 100%)
  const gaugePercent = useMemo(() => {
    if (bmi <= 0) return 0;
    const minScale = 15;
    const maxScale = 40;
    const clamped = Math.min(Math.max(bmi, minScale), maxScale);
    return ((clamped - minScale) / (maxScale - minScale)) * 100;
  }, [bmi]);

  const handleResetToCurrentWeight = () => {
    setWeightInput(
      unitPref === 'lb'
        ? kgToLb(latestRecordedWeightKg).toFixed(1)
        : latestRecordedWeightKg.toFixed(1)
    );
    setHasUserEditedWeight(false);
  };

  const handleSave = async () => {
    if (!numericHeight || !numericWeightKg) return;

    setIsSaving(true);
    try {
      // 1. Update Auth Store & LocalStorage
      updateUserStats({
        height_cm: numericHeight,
        weight_kg: numericWeightKg,
        gender,
        diet_goal: goal,
      });
      localStorage.setItem('np_saved_height_cm', numericHeight.toString());
      localStorage.setItem('np_current_weight_kg', numericWeightKg.toString());
      localStorage.setItem('np_diet_goal', goal);

      // 2. Call parent callback if provided
      if (onSaveStats) {
        onSaveStats({ heightCm: numericHeight, weightKg: numericWeightKg });
      }

      // 3. Log to backend body measurements if needed
      const todayStr = new Date().toISOString().split('T')[0];
      await apiClient.post('/body/logs', {
        log_date: todayStr,
        weight_kg: numericWeightKg,
        height_cm: numericHeight,
      });

      queryClient.invalidateQueries({ queryKey: ['body-trend'] });
      queryClient.invalidateQueries({ queryKey: ['body-logs'] });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to save BMI stats to profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className={`space-y-5 ${className}`}>
      {/* Header */}
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-brand-500/15 border border-brand-500/30 text-brand-400 flex items-center justify-center shrink-0 shadow-sm">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>{t('bmi.title')}</CardTitle>
              <Badge variant="brand" size="sm">
                <Sparkles className="w-3 h-3 mr-1" />
                {t('bmi.liveAnalysis')}
              </Badge>
            </div>
            <CardDescription>
              {t('bmi.autoSync', { weight: formatWeight(latestRecordedWeightKg, unitPref) })}
            </CardDescription>
          </div>
        </div>

        <Button
          variant={saveSuccess ? 'success' : 'outline'}
          size="sm"
          onClick={handleSave}
          disabled={!numericHeight || !numericWeightKg || isSaving}
          isLoading={isSaving}
          className="shrink-0"
        >
          {saveSuccess ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{t('bmi.savedToProfile')}</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4 text-brand-400" />
              <span>{t('bmi.saveToProfile')}</span>
            </>
          )}
        </Button>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Input Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-dark-900/70 p-4 rounded-2xl border border-dark-700/70">
          {/* Height Control */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                {t('bmi.height')} *
              </label>
              <div className="flex items-center gap-1 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setHeightMode('cm')}
                  className={`px-1.5 py-0.5 rounded transition-colors ${
                    heightMode === 'cm' ? 'bg-brand-500 text-dark-950' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  CM
                </button>
                <button
                  type="button"
                  onClick={() => setHeightMode('ft')}
                  className={`px-1.5 py-0.5 rounded transition-colors ${
                    heightMode === 'ft' ? 'bg-brand-500 text-dark-950' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  FT/IN
                </button>
              </div>
            </div>

            {heightMode === 'cm' ? (
              <Input
                type="number"
                min={80}
                max={250}
                placeholder="178"
                value={heightCmInput}
                onChange={(e) => {
                  setHasUserEditedHeight(true);
                  setHeightCmInput(e.target.value);
                }}
                className="font-mono text-center font-bold"
                endContent={<span className="text-xs text-zinc-500 font-bold">cm</span>}
              />
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                <Input
                  type="number"
                  min={3}
                  max={8}
                  placeholder="5"
                  value={feetInput}
                  onChange={(e) => {
                    setHasUserEditedHeight(true);
                    setFeetInput(e.target.value);
                  }}
                  className="font-mono text-center font-bold"
                  endContent={<span className="text-xs text-zinc-500 font-bold">ft</span>}
                />
                <Input
                  type="number"
                  min={0}
                  max={11.9}
                  step="0.5"
                  placeholder="10"
                  value={inchesInput}
                  onChange={(e) => {
                    setHasUserEditedHeight(true);
                    setInchesInput(e.target.value);
                  }}
                  className="font-mono text-center font-bold"
                  endContent={<span className="text-xs text-zinc-500 font-bold">in</span>}
                />
              </div>
            )}
          </div>

          {/* Weight Control with Reset Option */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 block">
                {t('bmi.weight')} ({unitPref.toUpperCase()}) *
              </label>
              {hasUserEditedWeight && (
                <button
                  type="button"
                  onClick={handleResetToCurrentWeight}
                  className="text-[10px] text-brand-400 hover:text-brand-300 font-bold flex items-center gap-0.5"
                  title={t('bmi.resetToLatest')}
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>{t('bmi.current')}</span>
                </button>
              )}
            </div>

            <Input
              type="number"
              step="0.1"
              min={25}
              max={350}
              placeholder={unitPref === 'lb' ? '172.0' : '78.0'}
              value={weightInput}
              onChange={(e) => {
                setHasUserEditedWeight(true);
                setWeightInput(e.target.value);
              }}
              className="font-mono text-center font-bold"
              endContent={<span className="text-xs text-zinc-500 font-bold">{unitPref.toUpperCase()}</span>}
            />
          </div>

          {/* Gender */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 block">
              {t('bmi.biologicalSex')}
            </label>
            <div className="grid grid-cols-2 gap-1 bg-dark-800 p-1 rounded-xl border border-dark-700 h-10 items-center">
              <button
                type="button"
                onClick={() => setGender('male')}
                className={`h-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                  gender === 'male'
                    ? 'bg-brand-500 text-dark-950 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {t('bmi.male')}
              </button>
              <button
                type="button"
                onClick={() => setGender('female')}
                className={`h-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                  gender === 'female'
                    ? 'bg-brand-500 text-dark-950 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {t('bmi.female')}
              </button>
            </div>
          </div>

          {/* Age */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 block">
              {t('bmi.age')} ({t('bmi.years')})
            </label>
            <Input
              type="number"
              min={10}
              max={110}
              placeholder="26"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="font-mono text-center font-bold"
              endContent={<span className="text-xs text-zinc-500 font-bold">{t('bmi.years')}</span>}
            />
          </div>
        </div>

        {/* Primary BMI Gauge & Category Card */}
        <div className="p-4 rounded-2xl bg-dark-900 border border-dark-700/80 space-y-4 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Main BMI Number & Badge */}
            <div className="flex items-baseline gap-3">
              <div className="text-3xl font-black font-mono text-white tracking-tight">
                {bmi > 0 ? bmi.toFixed(1) : '—'}
              </div>
              <div>
                <div className="text-xs uppercase font-bold text-zinc-400">{t('body.bmi')}</div>
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border mt-0.5 ${bmiCat.bgColor} ${bmiCat.textColor} ${bmiCat.borderColor}`}
                >
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: bmiCat.color }} />
                  <span>{bmiCat.label}</span>
                </div>
              </div>
            </div>

            {/* Healthy Weight Target & Estimated BF% */}
            <div className="flex items-center gap-3">
              {estimatedBodyFat > 0 && (
                <div className="bg-dark-800/90 border border-dark-700/80 px-3 py-2 rounded-xl text-right text-xs">
                  <span className="text-[10px] text-zinc-400 uppercase font-semibold block">
                    {t('body.bodyFat')}
                  </span>
                  <span className="font-mono font-bold text-amber-400 text-sm">
                    ~{estimatedBodyFat.toFixed(1)}%
                  </span>
                </div>
              )}

              {idealRange.minKg > 0 && (
                <div className="bg-dark-800/90 border border-dark-700/80 px-3 py-2 rounded-xl text-right text-xs">
                  <span className="text-[10px] text-zinc-400 uppercase font-semibold block">
                    {t('bmi.idealWeightRange')}
                  </span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {formatWeight(idealRange.minKg, unitPref)} – {formatWeight(idealRange.maxKg, unitPref)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Multi-zone Color Gauge */}
          <div className="space-y-1.5 pt-1">
            <div className="relative h-4 rounded-full overflow-hidden flex bg-dark-800 border border-dark-700">
              <div className="h-full bg-sky-500/80" style={{ width: '14%' }} title={`${t('bmi.underweight')} (< 18.5)`} />
              <div className="h-full bg-emerald-500/90" style={{ width: '26%' }} title={`${t('bmi.normal')} (18.5 - 24.9)`} />
              <div className="h-full bg-amber-500/90" style={{ width: '20%' }} title={`${t('bmi.overweight')} (25 - 29.9)`} />
              <div className="h-full bg-orange-500/90" style={{ width: '20%' }} title={`${t('bmi.obese1')} (30 - 34.9)`} />
              <div className="h-full bg-red-500/90" style={{ width: '20%' }} title={`${t('bmi.obese2')} (35+)`} />

              {bmi > 0 && (
                <div
                  className="absolute top-0 bottom-0 w-2 bg-white shadow-[0_0_10px_rgba(255,255,255,0.95)] rounded-full transition-all duration-500"
                  style={{ left: `${gaugePercent}%`, transform: 'translateX(-50%)' }}
                />
              )}
            </div>

            <div className="flex justify-between text-[10px] text-zinc-500 font-mono pt-0.5">
              <span className="text-sky-400">18.5</span>
              <span className="text-emerald-400">25.0</span>
              <span className="text-amber-400">30.0</span>
              <span className="text-orange-400">35.0</span>
              <span className="text-red-400">40.0+</span>
            </div>
          </div>

          {/* Coach Advice */}
          <div className="flex items-start gap-2.5 text-xs text-zinc-300 bg-dark-800/70 p-3 rounded-xl border border-dark-700/60">
            <Info className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{bmiCat.advice}</p>
          </div>
        </div>

        {/* Metabolic Rate & Nutrition Targets Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Metabolism & TDEE */}
          <div className="bg-dark-900/80 border border-dark-700/70 p-4 rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                BMR & TDEE
              </h3>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs py-1 border-b border-dark-800">
                <span className="text-zinc-400">BMR:</span>
                <span className="font-mono font-bold text-white">
                  {bmr > 0 ? `${bmr.toLocaleString()} kcal` : '—'}
                </span>
              </div>

              <div className="space-y-1 pt-1">
                <label className="text-[11px] text-zinc-400 block font-medium">{t('bmi.activityLevel')}:</label>
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
                <span className="text-zinc-300 font-semibold">TDEE:</span>
                <span className="font-mono font-extrabold text-brand-400 text-sm">
                  {tdee > 0 ? `${tdee.toLocaleString()} kcal` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Nutrition Targets & Macro Split */}
          <div className="bg-dark-900/80 border border-dark-700/70 p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-brand-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                  {t('nutrition.target')}
                </h3>
              </div>

              {/* Goal Selector */}
              <div className="flex gap-1 bg-dark-800 p-0.5 rounded-lg border border-dark-700 text-[10px]">
                <button
                  type="button"
                  onClick={() => setGoal('cut')}
                  className={`px-2 py-0.5 rounded font-bold transition-colors ${
                    goal === 'cut' ? 'bg-amber-500 text-dark-950' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {t('body.cutting')}
                </button>
                <button
                  type="button"
                  onClick={() => setGoal('maintain')}
                  className={`px-2 py-0.5 rounded font-bold transition-colors ${
                    goal === 'maintain' ? 'bg-brand-500 text-dark-950' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {t('nutrition.target')}
                </button>
                <button
                  type="button"
                  onClick={() => setGoal('bulk')}
                  className={`px-2 py-0.5 rounded font-bold transition-colors ${
                    goal === 'bulk' ? 'bg-emerald-500 text-dark-950' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {t('body.bulking')}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs py-1 border-b border-dark-800">
                <span className="text-zinc-400">{t('nutrition.calories')}:</span>
                <span className="font-mono font-bold text-white">
                  {targetCalories > 0 ? `${targetCalories.toLocaleString()} kcal` : '—'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="bg-dark-800 p-2 rounded-xl border border-dark-700/80 text-center">
                  <span className="text-[10px] text-zinc-400 uppercase block font-semibold">{t('nutrition.protein')}</span>
                  <span className="font-mono font-bold text-xs text-rose-400">
                    {macros.proteinG}g
                  </span>
                </div>
                <div className="bg-dark-800 p-2 rounded-xl border border-dark-700/80 text-center">
                  <span className="text-[10px] text-zinc-400 uppercase block font-semibold">{t('nutrition.fat')}</span>
                  <span className="font-mono font-bold text-xs text-amber-400">
                    {macros.fatG}g
                  </span>
                </div>
                <div className="bg-dark-800 p-2 rounded-xl border border-dark-700/80 text-center">
                  <span className="text-[10px] text-zinc-400 uppercase block font-semibold">{t('nutrition.carbs')}</span>
                  <span className="font-mono font-bold text-xs text-sky-400">
                    {macros.carbG}g
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
