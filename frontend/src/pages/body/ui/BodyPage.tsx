import { toLocalDateKey } from '@/shared/lib/dates.ts';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Scale,
  Trash2,
  Calculator,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Card, CardHeader, CardTitle, CardContent } from '../../../shared/ui/card.tsx';
import { Button } from '../../../shared/ui/button.tsx';
import { Input } from '../../../shared/ui/input.tsx';
import { formatWeight, lbToKg, kgToLb } from '../../../shared/lib/units.ts';
import {
  calculateBMI,
  getBMICategory,
  getIdealWeightRange,
  calculateBMR,
  calculateTDEE,
  estimateBodyFatPercentage,
  calculateMacroSplit,
} from '../../../shared/lib/calculations.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import {
  BodyWeightTrendChart,
  BodyChartMode,
} from '../../../features/progress-charts/ui/BodyWeightTrendChart.tsx';

interface BodyLog {
  id: string;
  log_date: string;
  weight_kg: number;
  body_fat_percentage?: number | null;
  waist_cm?: number | null;
  chest_cm?: number | null;
  arms_cm?: number | null;
  thighs_cm?: number | null;
  calves_cm?: number | null;
  neck_cm?: number | null;
  calculated_bmi?: number | null;
}

interface BodyTrendPoint {
  date: string;
  weight_kg: number;
  sma_7day_kg: number;
}

interface BodyTrendResponse {
  current_weight_kg: number;
  current_7day_sma_kg: number;
  delta_7day_kg?: number | null;
  delta_30day_kg?: number | null;
  delta_90day_kg?: number | null;
  trend_points: BodyTrendPoint[];
}

export const BodyPage: React.FC = () => {
  const { t, language } = useTranslation();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const unitPref = useAuthStore((s) => s.unitPreference);
  const setUnitPreference = useAuthStore((s) => s.setUnitPreference);
  const updateUserStats = useAuthStore((s) => s.updateUserStats);

  // Chart tab
  const [chartMode, setChartMode] = useState<BodyChartMode>('weight');

  // Add Log form state
  const todayStr = toLocalDateKey(new Date());
  const [logDate, setLogDate] = useState(todayStr);
  const [weightInput, setWeightInput] = useState('');
  const [heightCm, setHeightCm] = useState<string>(() => {
    return user?.height_cm
      ? user.height_cm.toString()
      : localStorage.getItem('np_saved_height_cm') || '180';
  });
  const [bodyFat, setBodyFat] = useState('');
  const [waistCm, setWaistCm] = useState('');
  const [chestCm, setChestCm] = useState('');
  const [thighsCm, setThighsCm] = useState('');
  const [armsCm, setArmsCm] = useState('');
  const [neckCm, setNeckCm] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Queries
  const { data: trend } = useQuery<BodyTrendResponse>({
    queryKey: ['body-trend'],
    queryFn: () => apiClient<BodyTrendResponse>('/body/trend'),
  });

  const { data: rawLogs, isLoading: isLoadingLogs } = useQuery<BodyLog[]>({
    queryKey: ['body-logs'],
    queryFn: () => apiClient<BodyLog[]>('/body/logs'),
  });
  const logs = Array.isArray(rawLogs) ? rawLogs : [];

  useEffect(() => {
    if (user?.height_cm && !heightCm) {
      setHeightCm(user.height_cm.toString());
    }
  }, [user?.height_cm, heightCm]);

  const currentWeightKg =
    trend?.current_weight_kg ||
    user?.weight_kg ||
    Number(localStorage.getItem('np_current_weight_kg') || 0);

  // Calculator state
  const [calcHeight, setCalcHeight] = useState<string>(() => {
    return String(user?.height_cm || localStorage.getItem('np_saved_height_cm') || '180');
  });
  const [calcWeight, setCalcWeight] = useState<string>(() => {
    const baseKg = Number(localStorage.getItem('np_current_weight_kg') || user?.weight_kg || 78);
    const val = unitPref === 'lb' ? kgToLb(baseKg) : baseKg;
    return val > 0 ? val.toFixed(1) : '78';
  });
  const [hasEditedCalcWeight, setHasEditedCalcWeight] = useState(false);
  const [calcAge, setCalcAge] = useState<string>(() => {
    if (user?.birth_year) {
      return String(Math.max(12, new Date().getFullYear() - user.birth_year));
    }
    return '26';
  });
  const [calcGender, setCalcGender] = useState<'male' | 'female'>(
    user?.gender === 'female' ? 'female' : 'male'
  );
  const [activityMult, setActivityMult] = useState<number>(1.55);

  useEffect(() => {
    if (currentWeightKg > 0 && !hasEditedCalcWeight) {
      const displayVal = unitPref === 'lb' ? kgToLb(currentWeightKg) : currentWeightKg;
      setCalcWeight(displayVal.toFixed(1));
    }
  }, [currentWeightKg, unitPref, hasEditedCalcWeight]);

  // Goals & Macros state
  const [dietGoal, setDietGoal] = useState<'cut' | 'maintain' | 'bulk'>(() => {
    const saved = user?.diet_goal || localStorage.getItem('np_diet_goal');
    if (saved === 'cut' || saved === 'maintain' || saved === 'bulk') return saved;
    return 'maintain';
  });
  const [targetWeightInput, setTargetWeightInput] = useState<string>(() => {
    const targetKg = user?.target_weight_kg || Number(localStorage.getItem('np_target_weight_kg') || 75);
    const displayVal = unitPref === 'lb' ? kgToLb(targetKg) : targetKg;
    return displayVal > 0 ? displayVal.toFixed(1) : '75';
  });
  const [goalsSaved, setGoalsSaved] = useState(false);

  // Macro inputs (seeded from stored profile or computed formula)
  const [macroProteinInput, setMacroProteinInput] = useState<string>(() => {
    return String(
      user?.target_protein_g || localStorage.getItem('np_nutrition_target_protein_g') || '160'
    );
  });
  const [macroFatInput, setMacroFatInput] = useState<string>(() => {
    return String(
      user?.target_fat_g || localStorage.getItem('np_nutrition_target_fat_g') || '70'
    );
  });
  const [macroCarbInput, setMacroCarbInput] = useState<string>(() => {
    return String(
      user?.target_carbs_g || localStorage.getItem('np_nutrition_target_carbs_g') || '250'
    );
  });
  const [macrosSaved, setMacrosSaved] = useState(false);

  // Calculations
  const calcHeightNum = parseFloat(calcHeight) || 0;
  const calcWeightRaw = parseFloat(calcWeight) || 0;
  const calcWeightKg = unitPref === 'lb' ? lbToKg(calcWeightRaw) : calcWeightRaw;
  const calcAgeNum = parseInt(calcAge, 10) || 26;

  const calcBMI = useMemo(
    () => calculateBMI(calcWeightKg, calcHeightNum),
    [calcWeightKg, calcHeightNum]
  );
  const calcBMICat = useMemo(() => getBMICategory(calcBMI), [calcBMI]);
  const idealRange = useMemo(() => getIdealWeightRange(calcHeightNum), [calcHeightNum]);
  const calcBMR = useMemo(
    () => calculateBMR(calcWeightKg, calcHeightNum, calcAgeNum, calcGender),
    [calcWeightKg, calcHeightNum, calcAgeNum, calcGender]
  );
  const calcTDEE = useMemo(
    () => calculateTDEE(calcBMR, activityMult),
    [calcBMR, activityMult]
  );
  const estBodyFat = useMemo(
    () => estimateBodyFatPercentage(calcBMI, calcAgeNum, calcGender),
    [calcBMI, calcAgeNum, calcGender]
  );

  const recommendedCalories = useMemo(() => {
    if (calcTDEE <= 0) return 0;
    if (dietGoal === 'cut') return Math.max(1200, calcTDEE - 400);
    if (dietGoal === 'bulk') return calcTDEE + 350;
    return calcTDEE;
  }, [calcTDEE, dietGoal]);

  // Live BMI for Add Log preview & KPIs
  const formWeightRaw = parseFloat(weightInput) || 0;
  const formWeightKg = unitPref === 'lb' ? lbToKg(formWeightRaw) : formWeightRaw;
  const formHeightNum = parseFloat(heightCm) || 0;
  const formBMI =
    formWeightKg > 0 && formHeightNum > 0 ? calculateBMI(formWeightKg, formHeightNum) : 0;
  const formBMICat = getBMICategory(formBMI);

  const currentBMI =
    currentWeightKg > 0 && formHeightNum > 0 ? calculateBMI(currentWeightKg, formHeightNum) : 0;

  const parsedTargetWeightRaw = parseFloat(targetWeightInput) || 0;
  const targetWeightKg =
    unitPref === 'lb' ? lbToKg(parsedTargetWeightRaw) : parsedTargetWeightRaw;
  const remainingKg =
    currentWeightKg > 0 && targetWeightKg > 0 ? currentWeightKg - targetWeightKg : null;

  // Mutations
  const logMutation = useMutation({
    mutationFn: async () => {
      const parsedWeight = parseFloat(weightInput);
      if (isNaN(parsedWeight) || parsedWeight <= 0) {
        throw new Error(t('body.logWeightBtn'));
      }

      const weightKg = unitPref === 'lb' ? lbToKg(parsedWeight) : parsedWeight;
      const heightNum = heightCm ? parseFloat(heightCm) : undefined;

      localStorage.setItem('np_current_weight_kg', weightKg.toString());
      if (heightNum) {
        localStorage.setItem('np_saved_height_cm', heightNum.toString());
        updateUserStats({ height_cm: heightNum, weight_kg: weightKg });
      } else {
        updateUserStats({ weight_kg: weightKg });
      }

      return apiClient('/body/logs', {
        method: 'POST',
        body: JSON.stringify({
          log_date: logDate,
          weight_kg: weightKg,
          height_cm: heightNum,
          body_fat_percentage: bodyFat ? parseFloat(bodyFat) : undefined,
          waist_cm: waistCm ? parseFloat(waistCm) : undefined,
          chest_cm: chestCm ? parseFloat(chestCm) : undefined,
          thighs_cm: thighsCm ? parseFloat(thighsCm) : undefined,
          arms_cm: armsCm ? parseFloat(armsCm) : undefined,
          neck_cm: neckCm ? parseFloat(neckCm) : undefined,
        }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['body-trend'] });
      void queryClient.invalidateQueries({ queryKey: ['body-logs'] });
      void queryClient.invalidateQueries({ queryKey: ['coach-insights'] });
      setWeightInput('');
      setBodyFat('');
      setWaistCm('');
      setChestCm('');
      setThighsCm('');
      setArmsCm('');
      setNeckCm('');
      setError(null);
    },
    onError: (err: any) => {
      setError(err.message || 'Error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (date: string) =>
      apiClient(`/body/logs/${date}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['body-trend'] });
      void queryClient.invalidateQueries({ queryKey: ['body-logs'] });
      void queryClient.invalidateQueries({ queryKey: ['coach-insights'] });
    },
  });

  const updateUnitMutation = useMutation({
    mutationFn: (unit: 'kg' | 'lb') =>
      apiClient.put('/profile/unit-preference', { unit_preference: unit }),
    onSuccess: (_, unit) => {
      setUnitPreference(unit);
      void queryClient.invalidateQueries();
    },
  });

  const handleCalculateApply = () => {
    const refKg = calcWeightKg > 0 ? calcWeightKg : currentWeightKg || 78;
    const cal = recommendedCalories || 2200;
    const split = calculateMacroSplit(refKg, cal, dietGoal);
    setMacroProteinInput(String(split.proteinG));
    setMacroFatInput(String(split.fatG));
    setMacroCarbInput(String(split.carbG));
  };

  const handleSaveGoals = (e: React.FormEvent) => {
    e.preventDefault();
    if (targetWeightKg > 0) {
      localStorage.setItem('np_target_weight_kg', targetWeightKg.toString());
    }
    localStorage.setItem('np_diet_goal', dietGoal);
    if (calcHeightNum > 0) {
      localStorage.setItem('np_saved_height_cm', calcHeightNum.toString());
      setHeightCm(calcHeightNum.toString());
    }

    updateUserStats({
      target_weight_kg: targetWeightKg > 0 ? targetWeightKg : user?.target_weight_kg,
      height_cm: calcHeightNum > 0 ? calcHeightNum : user?.height_cm,
      diet_goal: dietGoal,
    });

    void queryClient.invalidateQueries({ queryKey: ['body-trend'] });
    void queryClient.invalidateQueries({ queryKey: ['coach-insights'] });

    setGoalsSaved(true);
    setTimeout(() => setGoalsSaved(false), 2500);
  };

  const handleSaveMacros = () => {
    const p = Math.max(0, Math.round(parseFloat(macroProteinInput) || 0));
    const f = Math.max(0, Math.round(parseFloat(macroFatInput) || 0));
    const c = Math.max(0, Math.round(parseFloat(macroCarbInput) || 0));
    const totalKcal = p * 4 + c * 4 + f * 9 || recommendedCalories || 2200;

    localStorage.setItem('np_nutrition_target_calories', String(totalKcal));
    localStorage.setItem('np_nutrition_target_protein_g', String(p));
    localStorage.setItem('np_nutrition_target_fat_g', String(f));
    localStorage.setItem('np_nutrition_target_carbs_g', String(c));

    updateUserStats({
      target_calories: totalKcal,
      target_protein_g: p,
      target_fat_g: f,
      target_carbs_g: c,
    });

    void queryClient.invalidateQueries({ queryKey: ['nutrition', 'today'] });
    void queryClient.invalidateQueries({ queryKey: ['coach-insights'] });

    setMacrosSaved(true);
    setTimeout(() => setMacrosSaved(false), 2500);
  };

  const handleResetLogForm = () => {
    setWeightInput('');
    setBodyFat('');
    setWaistCm('');
    setChestCm('');
    setThighsCm('');
    setArmsCm('');
    setNeckCm('');
    setError(null);
  };

  const dateLbl = language === 'uz' ? 'Sana' : language === 'en' ? 'Date' : 'Дата';
  const emptyLogsLbl =
    language === 'uz'
      ? 'Hali vazn qayd etilmagan'
      : language === 'en'
      ? 'No body logs recorded yet'
      : 'Замеров пока нет — добавьте первое взвешивание';
  const smaLabel =
    language === 'uz' ? 'O‘rtacha · SMA 7' : language === 'en' ? 'Average · SMA 7' : 'Среднее · SMA 7';

  const activityOptions = [
    { value: 1.2, label: t('bmi.actSedentary') },
    { value: 1.375, label: t('bmi.actLight') },
    { value: 1.55, label: t('bmi.actModerate') },
    { value: 1.725, label: t('bmi.actActive') },
    { value: 1.9, label: t('bmi.actAthlete') },
  ];

  const liveMacroKcal =
    (parseFloat(macroProteinInput) || 0) * 4 +
    (parseFloat(macroCarbInput) || 0) * 4 +
    (parseFloat(macroFatInput) || 0) * 9;

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#fafafa] tracking-tight">
            {t('body.title')}
          </h1>
          <p className="text-sm text-[#a3a3a3] mt-1">{t('body.subtitle')}</p>
        </div>

        {currentBMI > 0 && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#171717] border border-[#404040] text-xs font-mono tabular-nums text-[#fafafa] self-start sm:self-auto">
            <span className="text-[#a3a3a3]">{t('body.bmi')}</span>
            <span className="text-[#34d399] font-semibold">{currentBMI.toFixed(1)}</span>
            <span className="text-[#737373]">·</span>
            <span className="font-sans text-[#a3a3a3]">{getBMICategory(currentBMI).label}</span>
          </div>
        )}
      </div>

      {/* 2. Top 3 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 sm:p-5 bg-[#171717] border-[#404040] space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#a3a3a3]">
            <span>{t('body.currentWeight')}</span>
            <Scale className="w-4 h-4 text-[#34d399]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-[#fafafa]">
            {currentWeightKg > 0 ? formatWeight(currentWeightKg, unitPref) : '—'}
          </div>
          {trend?.delta_30day_kg !== undefined && trend.delta_30day_kg !== null ? (
            <div
              className={`text-xs font-mono tabular-nums inline-flex items-center gap-1 ${
                trend.delta_30day_kg < 0
                  ? 'text-[#34d399]'
                  : trend.delta_30day_kg > 0
                  ? 'text-amber-400'
                  : 'text-[#737373]'
              }`}
            >
              {trend.delta_30day_kg > 0 ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : trend.delta_30day_kg < 0 ? (
                <TrendingDown className="w-3.5 h-3.5" />
              ) : null}
              <span>
                30d: {trend.delta_30day_kg > 0 ? '+' : ''}
                {formatWeight(trend.delta_30day_kg, unitPref)}
              </span>
            </div>
          ) : (
            <p className="text-xs text-[#737373]">{t('body.current')}</p>
          )}
        </Card>

        <Card className="p-4 sm:p-5 bg-[#171717] border-[#404040] space-y-1.5">
          <div className="text-xs text-[#a3a3a3]">{t('body.targetWeight')}</div>
          <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-[#34d399]">
            {targetWeightKg > 0 ? formatWeight(targetWeightKg, unitPref) : '—'}
          </div>
          <p className="text-xs font-mono tabular-nums text-[#a3a3a3]">
            {remainingKg !== null
              ? Math.abs(remainingKg) < 0.1
                ? t('body.goalAchieved')
                : `${t('body.remainingToGoal')}: ${remainingKg > 0 ? '+' : ''}${formatWeight(
                    remainingKg,
                    unitPref
                  )}`
              : '—'}
          </p>
        </Card>

        <Card className="p-4 sm:p-5 bg-[#171717] border-[#404040] space-y-1.5">
          <div className="text-xs text-[#a3a3a3]">{smaLabel}</div>
          <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-[#fafafa]">
            {trend?.current_7day_sma_kg ? formatWeight(trend.current_7day_sma_kg, unitPref) : '—'}
          </div>
          <p className="text-xs font-mono tabular-nums text-[#a3a3a3]">
            {t('body.bmi')}: {currentBMI > 0 ? currentBMI.toFixed(1) : '—'}
          </p>
        </Card>
      </div>

      {/* 3. Multi-mode Dynamics Chart */}
      <BodyWeightTrendChart
        trendPoints={trend?.trend_points || []}
        logs={logs}
        targetWeightKg={targetWeightKg > 0 ? targetWeightKg : undefined}
        unitPref={unitPref}
        mode={chartMode}
        onModeChange={setChartMode}
      />

      {/* 4. Middle Grid: Recent Measurements & Add Measurement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Left: Recent Logs */}
        <Card className="p-4 sm:p-5 bg-[#171717] border-[#404040]">
          <CardHeader className="pb-3 border-b border-[#262626] mb-3 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">{t('body.recentLogs')}</CardTitle>
            <span className="px-2 py-0.5 rounded-[6px] bg-[#0a0a0a] border border-[#262626] text-xs font-mono tabular-nums text-[#a3a3a3]">
              {logs.length}
            </span>
          </CardHeader>

          <CardContent>
            {isLoadingLogs ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 rounded-[10px] bg-[#0a0a0a] border border-[#262626] animate-pulse"
                  />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="p-6 rounded-[10px] bg-[#0a0a0a] border border-[#262626] text-center text-xs text-[#a3a3a3]">
                {emptyLogsLbl}
              </div>
            ) : (
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {logs.map((log) => (
                  <div
                    key={log.id || log.log_date}
                    className="p-3 rounded-[10px] bg-[#0a0a0a] border border-[#262626] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono tabular-nums text-[#a3a3a3]">
                          {log.log_date}
                        </span>
                        <span className="text-sm font-mono tabular-nums font-semibold text-[#fafafa]">
                          {formatWeight(log.weight_kg, unitPref)}
                        </span>
                        {log.calculated_bmi != null && log.calculated_bmi > 0 && (
                          <span className="px-2 py-0.5 rounded-[6px] bg-[#171717] border border-[#262626] text-[11px] font-mono tabular-nums text-[#34d399]">
                            BMI {log.calculated_bmi.toFixed(1)}
                          </span>
                        )}
                      </div>

                      {(log.body_fat_percentage ||
                        log.waist_cm ||
                        log.chest_cm ||
                        log.arms_cm ||
                        log.thighs_cm ||
                        log.neck_cm) && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-mono tabular-nums text-[#737373]">
                          {log.body_fat_percentage != null && log.body_fat_percentage > 0 && (
                            <span>BF {log.body_fat_percentage}%</span>
                          )}
                          {log.waist_cm != null && log.waist_cm > 0 && (
                            <span>
                              {t('body.waistCm').split(',')[0]} {log.waist_cm}
                            </span>
                          )}
                          {log.chest_cm != null && log.chest_cm > 0 && (
                            <span>
                              {t('body.chestCm').split(',')[0]} {log.chest_cm}
                            </span>
                          )}
                          {log.arms_cm != null && log.arms_cm > 0 && (
                            <span>
                              {t('body.armsCm').split(',')[0]} {log.arms_cm}
                            </span>
                          )}
                          {log.thighs_cm != null && log.thighs_cm > 0 && (
                            <span>
                              {t('body.hipsCm').split(',')[0]} {log.thighs_cm}
                            </span>
                          )}
                          {log.neck_cm != null && log.neck_cm > 0 && (
                            <span>
                              {t('body.neckCm').split(',')[0]} {log.neck_cm}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(log.log_date)}
                      disabled={deleteMutation.isPending}
                      className="min-w-[44px] min-h-[44px] rounded-[10px] bg-[#171717] border border-[#404040] hover:border-red-900 hover:bg-red-950/30 text-[#a3a3a3] hover:text-red-400 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                      aria-label={t('common.delete')}
                      title={t('common.delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Add Measurement Form */}
        <Card className="p-4 sm:p-5 bg-[#171717] border-[#404040]">
          <CardHeader className="pb-3 border-b border-[#262626] mb-3">
            <CardTitle className="text-base">{t('body.addLogTitle')}</CardTitle>
          </CardHeader>

          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                logMutation.mutate();
              }}
              className="space-y-4"
            >
              {error && (
                <div className="p-3 rounded-[10px] bg-red-950/40 border border-red-900 text-xs text-red-400">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  type="date"
                  label={dateLbl}
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  required
                />
                <Input
                  type="number"
                  step="0.1"
                  label={`${t('bmi.weight')} (${unitPref})`}
                  placeholder={unitPref === 'lb' ? '172.0' : '78.0'}
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  required
                />
                <Input
                  type="number"
                  step="1"
                  label={t('profile.heightCm')}
                  placeholder="180"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                />
              </div>

              {formBMI > 0 && (
                <div className="px-3 py-2 rounded-[10px] bg-[#0a0a0a] border border-[#262626] flex items-center justify-between text-xs font-mono tabular-nums">
                  <span className="text-[#a3a3a3]">{t('body.bmi')}</span>
                  <span className="text-[#34d399] font-semibold">
                    {formBMI.toFixed(1)} · {formBMICat.label}
                  </span>
                </div>
              )}

              <div className="space-y-2.5 pt-1 border-t border-[#262626]">
                <p className="text-xs font-medium text-[#a3a3a3]">{t('body.optionalGirths')}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <Input
                    type="number"
                    step="0.1"
                    label={t('body.neckCm')}
                    placeholder="39.0"
                    value={neckCm}
                    onChange={(e) => setNeckCm(e.target.value)}
                  />
                  <Input
                    type="number"
                    step="0.1"
                    label={t('body.chestCm')}
                    placeholder="104.0"
                    value={chestCm}
                    onChange={(e) => setChestCm(e.target.value)}
                  />
                  <Input
                    type="number"
                    step="0.1"
                    label={t('body.waistCm')}
                    placeholder="81.0"
                    value={waistCm}
                    onChange={(e) => setWaistCm(e.target.value)}
                  />
                  <Input
                    type="number"
                    step="0.1"
                    label={t('body.hipsCm')}
                    placeholder="58.0"
                    value={thighsCm}
                    onChange={(e) => setThighsCm(e.target.value)}
                  />
                  <Input
                    type="number"
                    step="0.1"
                    label={t('body.armsCm')}
                    placeholder="37.5"
                    value={armsCm}
                    onChange={(e) => setArmsCm(e.target.value)}
                  />
                  <Input
                    type="number"
                    step="0.1"
                    label={t('body.bodyFat')}
                    placeholder="14.5"
                    value={bodyFat}
                    onChange={(e) => setBodyFat(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1"
                  isLoading={logMutation.isPending}
                >
                  {t('body.saveLog')}
                </Button>
                <Button type="button" variant="outline" onClick={handleResetLogForm}>
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* 5. Bottom Grid: Calculator (BMI / BMR / TDEE) & Goals / Macro Targets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Left: Calculator */}
        <Card className="p-4 sm:p-5 bg-[#171717] border-[#404040] space-y-4">
          <CardHeader className="pb-3 border-b border-[#262626] mb-0 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#34d399]" />
              {t('body.calculatorTitle')}
            </CardTitle>
            {estBodyFat > 0 && (
              <span className="text-xs font-mono tabular-nums text-[#a3a3a3]">
                ~{estBodyFat.toFixed(1)}% BF
              </span>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                step="1"
                label={t('profile.heightCm')}
                value={calcHeight}
                onChange={(e) => setCalcHeight(e.target.value)}
              />
              <Input
                type="number"
                step="0.1"
                label={`${t('bmi.weight')} (${unitPref})`}
                value={calcWeight}
                onChange={(e) => {
                  setHasEditedCalcWeight(true);
                  setCalcWeight(e.target.value);
                }}
              />
              <Input
                type="number"
                step="1"
                min={10}
                max={110}
                label={t('profile.ageYears')}
                value={calcAge}
                onChange={(e) => setCalcAge(e.target.value)}
              />

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#a3a3a3] block">
                  {t('bmi.biologicalSex')}
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['male', 'female'] as const).map((sex) => (
                    <button
                      key={sex}
                      type="button"
                      onClick={() => setCalcGender(sex)}
                      className={`min-h-[44px] rounded-[10px] border text-xs font-medium transition-colors cursor-pointer ${
                        calcGender === sex
                          ? 'bg-[#022c22] border-[#064e3b] text-[#34d399]'
                          : 'bg-[#0a0a0a] border-[#404040] text-[#a3a3a3] hover:text-[#fafafa]'
                      }`}
                    >
                      {sex === 'male' ? t('bmi.male') : t('bmi.female')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#a3a3a3] block">
                {t('body.activityFactor')}
              </label>
              <select
                value={activityMult}
                onChange={(e) => setActivityMult(parseFloat(e.target.value))}
                className="w-full min-h-[44px] rounded-[10px] border border-[#404040] bg-[#0a0a0a] px-3 py-2 text-sm text-[#fafafa] focus:outline-none focus:border-[#34d399]"
              >
                {activityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} (×{opt.value})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 rounded-[10px] bg-[#0a0a0a] border border-[#262626]">
                <div className="text-[11px] text-[#a3a3a3]">{t('body.bmi')}</div>
                <div className="text-lg font-bold font-mono tabular-nums text-[#fafafa] mt-0.5">
                  {calcBMI > 0 ? calcBMI.toFixed(1) : '—'}
                </div>
              </div>
              <div className="p-3 rounded-[10px] bg-[#0a0a0a] border border-[#262626]">
                <div className="text-[11px] text-[#a3a3a3]">BMR</div>
                <div className="text-lg font-bold font-mono tabular-nums text-[#fafafa] mt-0.5">
                  {calcBMR > 0 ? calcBMR.toLocaleString() : '—'}
                </div>
              </div>
              <div className="p-3 rounded-[10px] bg-[#0a0a0a] border border-[#262626]">
                <div className="text-[11px] text-[#a3a3a3]">TDEE</div>
                <div className="text-lg font-bold font-mono tabular-nums text-[#34d399] mt-0.5">
                  {calcTDEE > 0 ? calcTDEE.toLocaleString() : '—'}
                </div>
              </div>
            </div>

            {idealRange.minKg > 0 && (
              <div className="p-3 rounded-[10px] bg-[#0a0a0a] border border-[#262626] space-y-1 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#a3a3a3]">{t('bmi.idealWeightRange')}</span>
                  <span className="font-mono tabular-nums font-semibold text-[#34d399]">
                    {formatWeight(idealRange.minKg, unitPref)} – {formatWeight(idealRange.maxKg, unitPref)}
                  </span>
                </div>
                <p className="text-[#a3a3a3] leading-relaxed">{calcBMICat.advice}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-[#737373]">{t('body.calcHint')}</span>
              <Button type="button" variant="outline" onClick={handleCalculateApply}>
                {t('body.calculateBtn')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Right: Goals & Macro Targets */}
        <Card className="p-4 sm:p-5 bg-[#171717] border-[#404040] space-y-4">
          <CardHeader className="pb-3 border-b border-[#262626] mb-0">
            <CardTitle className="text-base">{t('body.goalsTitle')}</CardTitle>
          </CardHeader>

          <CardContent className="space-y-5">
            <form onSubmit={handleSaveGoals} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#a3a3a3] block">
                  {t('body.dietMode')}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'cut', label: t('body.modeCut') },
                      { id: 'maintain', label: t('body.modeMaintain') },
                      { id: 'bulk', label: t('body.modeBulk') },
                    ] as const
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setDietGoal(mode.id)}
                      className={`min-h-[44px] px-2.5 rounded-[10px] border text-xs font-medium transition-colors cursor-pointer ${
                        dietGoal === mode.id
                          ? 'bg-[#022c22] border-[#064e3b] text-[#34d399]'
                          : 'bg-[#0a0a0a] border-[#404040] text-[#a3a3a3] hover:text-[#fafafa]'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-[10px] bg-[#0a0a0a] border border-[#262626] flex items-center justify-between text-xs">
                <span className="text-[#a3a3a3]">{t('nutrition.calories')}</span>
                <span className="font-mono tabular-nums text-base font-bold text-[#34d399]">
                  {recommendedCalories > 0
                    ? `${recommendedCalories.toLocaleString()} ${t('nutrition.kcalUnit')}`
                    : '—'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  type="number"
                  step="0.1"
                  label={`${t('body.targetWeight')} (${unitPref})`}
                  value={targetWeightInput}
                  onChange={(e) => setTargetWeightInput(e.target.value)}
                />

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#a3a3a3] block">
                    {t('body.weightUnitLabel')}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['kg', 'lb'] as const).map((unit) => (
                      <button
                        key={unit}
                        type="button"
                        onClick={() => {
                          if (unit !== unitPref) {
                            updateUnitMutation.mutate(unit);
                          }
                        }}
                        className={`min-h-[44px] rounded-[10px] border text-xs font-mono font-semibold uppercase transition-colors cursor-pointer ${
                          unitPref === unit
                            ? 'bg-[#022c22] border-[#064e3b] text-[#34d399]'
                            : 'bg-[#0a0a0a] border-[#404040] text-[#a3a3a3] hover:text-[#fafafa]'
                        }`}
                      >
                        {unit}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Button type="submit" variant="primary" className="w-full">
                {goalsSaved ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    {t('bmi.savedToProfile')}
                  </>
                ) : (
                  t('body.saveGoals')
                )}
              </Button>
            </form>

            {/* Macro Goals Sub-section */}
            <div className="pt-4 border-t border-[#262626] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[#fafafa]">
                  {t('body.macroGoals')}
                </span>
                <span className="text-xs font-mono tabular-nums text-[#34d399]">
                  {Math.round(liveMacroKcal)} {t('nutrition.kcalUnit')}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <Input
                  type="number"
                  step="1"
                  label={t('nutrition.protein')}
                  value={macroProteinInput}
                  onChange={(e) => setMacroProteinInput(e.target.value)}
                />
                <Input
                  type="number"
                  step="1"
                  label={t('nutrition.fat')}
                  value={macroFatInput}
                  onChange={(e) => setMacroFatInput(e.target.value)}
                />
                <Input
                  type="number"
                  step="1"
                  label={t('nutrition.carbs')}
                  value={macroCarbInput}
                  onChange={(e) => setMacroCarbInput(e.target.value)}
                />
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleSaveMacros}
              >
                {macrosSaved ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1.5 text-[#34d399]" />
                    {t('bmi.savedToProfile')}
                  </>
                ) : (
                  t('body.saveMacroGoals')
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
