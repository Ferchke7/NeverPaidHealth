import React, { useState, useEffect } from 'react';
import {
  Scale,
  TrendingUp,
  TrendingDown,
  Trash2,
  Calculator,
  Calendar,
  Layers,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '../../../shared/ui/card.tsx';
import { Button } from '../../../shared/ui/button.tsx';
import { Input } from '../../../shared/ui/input.tsx';
import { formatWeight, lbToKg, kgToLb } from '../../../shared/lib/units.ts';
import { calculateBMI, getBMICategory } from '../../../shared/lib/calculations.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { BMICalculatorCard } from '../../../features/bmi-calculator/ui/BMICalculatorCard.tsx';
import { BodyTargetProgressCard } from '../../../features/body-target-progress/ui/BodyTargetProgressCard.tsx';

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
  const updateUserStats = useAuthStore((s) => s.updateUserStats);

  const todayStr = new Date().toISOString().split('T')[0];
  const [logDate, setLogDate] = useState(todayStr);
  const [weightInput, setWeightInput] = useState('');
  const [heightCm, setHeightCm] = useState<string>(() => {
    return user?.height_cm ? user.height_cm.toString() : localStorage.getItem('np_saved_height_cm') || '180';
  });
  const [bodyFat, setBodyFat] = useState('');
  const [waistCm, setWaistCm] = useState('');
  const [chestCm, setChestCm] = useState('');
  const [armsCm, setArmsCm] = useState('');
  const [neckCm, setNeckCm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);

  useEffect(() => {
    if (user?.height_cm && !heightCm) {
      setHeightCm(user.height_cm.toString());
    }
  }, [user?.height_cm, heightCm]);

  const { data: trend } = useQuery<BodyTrendResponse>({
    queryKey: ['body-trend'],
    queryFn: () => apiClient<BodyTrendResponse>('/body/trend'),
  });

  const { data: rawLogs, isLoading: isLoadingLogs } = useQuery<BodyLog[]>({
    queryKey: ['body-logs'],
    queryFn: () => apiClient<BodyLog[]>('/body/logs'),
  });
  const logs = Array.isArray(rawLogs) ? rawLogs : [];

  const numWeight =
    parseFloat(weightInput) ||
    (trend ? (unitPref === 'lb' ? kgToLb(trend.current_weight_kg) : trend.current_weight_kg) : 0);
  const weightKgLive = unitPref === 'lb' ? lbToKg(numWeight) : numWeight;
  const numHeight = parseFloat(heightCm) || 0;
  const liveBMI = numHeight > 0 && weightKgLive > 0 ? calculateBMI(weightKgLive, numHeight) : 0;
  const liveBMICat = getBMICategory(liveBMI);

  const logMutation = useMutation({
    mutationFn: async () => {
      const parsedWeight = parseFloat(weightInput);
      if (isNaN(parsedWeight) || parsedWeight <= 0) {
        throw new Error(t('body.logWeightBtn'));
      }

      const weightKg = unitPref === 'lb' ? lbToKg(parsedWeight) : parsedWeight;
      const heightNum = heightCm ? parseFloat(heightCm) : undefined;

      if (heightNum) {
        localStorage.setItem('np_saved_height_cm', heightNum.toString());
        updateUserStats({ height_cm: heightNum, weight_kg: weightKg });
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

  const lbl = {
    calcToggle:
      language === 'uz'
        ? 'BMI va KBJU kalkulyatori'
        : language === 'en'
        ? 'BMI & TDEE Calculator'
        : 'Калькулятор ИМТ и КБЖУ',
    sma7d: language === 'uz' ? '7 kunlik o‘rtacha' : language === 'en' ? '7-Day Avg (SMA)' : 'Средний за 7д (SMA)',
    delta30d: language === 'uz' ? '30 kunlik farq' : language === 'en' ? '30-Day Delta' : 'Динамика 30д',
    logSection:
      language === 'uz'
        ? 'Vazn va tana o‘lchamlarini kiritish'
        : language === 'en'
        ? 'Log Weight & Measurements'
        : 'Записать вес и замеры',
    circumferences:
      language === 'uz'
        ? 'Tana aylanalari (ixtiyoriy, sm)'
        : language === 'en'
        ? 'Body Circumferences (optional, cm)'
        : 'Обхваты тела (опционально, см)',
    waist: language === 'uz' ? 'Bel (sm)' : language === 'en' ? 'Waist (cm)' : 'Талия (см)',
    chest: language === 'uz' ? 'Ko‘krak (sm)' : language === 'en' ? 'Chest (cm)' : 'Грудь (см)',
    arms: language === 'uz' ? 'Biseps (sm)' : language === 'en' ? 'Arms (cm)' : 'Бицепс (см)',
    neck: language === 'uz' ? 'Bo‘yin (sm)' : language === 'en' ? 'Neck (cm)' : 'Шея (см)',
    date: language === 'uz' ? 'Sana' : language === 'en' ? 'Date' : 'Дата',
    emptyLogs:
      language === 'uz'
        ? 'Hali vazn qayd etilmagan'
        : language === 'en'
        ? 'No body logs recorded yet'
        : 'Замеров пока нет — добавьте первое взвешивание',
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Compact Header Row */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
          <Scale className="w-5 h-5 text-brand-400" />
          <span>{t('body.title')}</span>
        </h2>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCalculator(!showCalculator)}
          className="text-xs flex items-center gap-1.5"
        >
          <Calculator className="w-3.5 h-3.5 text-brand-400" />
          <span>{lbl.calcToggle}</span>
        </Button>
      </div>

      {/* Live Target Weight Progress & Quick Log Card */}
      <BodyTargetProgressCard />

      {/* Collapsible Interactive BMI & TDEE Calculator */}
      {showCalculator && (
        <BMICalculatorCard
          initialHeightCm={parseFloat(heightCm) || undefined}
          initialWeightKg={trend?.current_weight_kg}
          onSaveStats={(s) => {
            setHeightCm(s.heightCm.toString());
            void queryClient.invalidateQueries({ queryKey: ['body-trend'] });
            void queryClient.invalidateQueries({ queryKey: ['coach-insights'] });
          }}
        />
      )}

      {/* Compact Trend KPI Strip */}
      {trend && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Card className="p-3 bg-dark-800/90 border-dark-700/80 space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              {t('body.currentWeight')}
            </span>
            <div className="text-lg font-black font-mono text-white">
              {formatWeight(trend.current_weight_kg, unitPref)}
            </div>
          </Card>

          <Card className="p-3 bg-dark-800/90 border-dark-700/80 space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{lbl.sma7d}</span>
            <div className="text-lg font-black font-mono text-brand-400">
              {formatWeight(trend.current_7day_sma_kg, unitPref)}
            </div>
          </Card>

          <Card className="p-3 bg-dark-800/90 border-dark-700/80 space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{t('body.bmi')}</span>
            <div className="text-lg font-black font-mono text-emerald-400 flex items-center gap-1.5">
              <span>{numHeight > 0 ? calculateBMI(trend.current_weight_kg, numHeight).toFixed(1) : '—'}</span>
              {numHeight > 0 && (
                <span
                  className={`text-[9px] font-sans font-bold px-1.5 py-0.5 rounded border ${
                    getBMICategory(calculateBMI(trend.current_weight_kg, numHeight)).bgColor
                  } ${getBMICategory(calculateBMI(trend.current_weight_kg, numHeight)).textColor} ${
                    getBMICategory(calculateBMI(trend.current_weight_kg, numHeight)).borderColor
                  }`}
                >
                  {getBMICategory(calculateBMI(trend.current_weight_kg, numHeight)).label}
                </span>
              )}
            </div>
          </Card>

          <Card className="p-3 bg-dark-800/90 border-dark-700/80 space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{lbl.delta30d}</span>
            <div
              className={`text-lg font-black font-mono flex items-center gap-1 ${
                (trend.delta_30day_kg ?? 0) > 0
                  ? 'text-amber-400'
                  : (trend.delta_30day_kg ?? 0) < 0
                  ? 'text-emerald-400'
                  : 'text-zinc-300'
              }`}
            >
              {trend.delta_30day_kg !== undefined && trend.delta_30day_kg !== null ? (
                <>
                  {trend.delta_30day_kg > 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : trend.delta_30day_kg < 0 ? (
                    <TrendingDown className="w-4 h-4" />
                  ) : null}
                  {formatWeight(Math.abs(trend.delta_30day_kg), unitPref)}
                </>
              ) : (
                '—'
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Detailed Measurement Input Card */}
      <Card className="space-y-3">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-brand-400" />
            <CardTitle className="text-sm">{lbl.logSection}</CardTitle>
          </div>
          <Badge variant="brand" size="sm">
            {unitPref.toUpperCase()}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-3">
          {error && (
            <div className="p-2.5 bg-red-950/50 border border-red-800/60 rounded-xl text-red-300 text-xs">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                {lbl.date} *
              </label>
              <input
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="w-full bg-dark-900 border border-dark-700 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <Input
                label={`${t('bmi.weight')} (${unitPref.toUpperCase()}) *`}
                type="number"
                step="0.1"
                placeholder={unitPref === 'lb' ? '175.5' : '80.0'}
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="font-mono font-bold"
              />
            </div>

            <div>
              <Input
                label={`${t('bmi.height')} (cm)`}
                type="number"
                placeholder="180"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                className="font-mono font-bold"
              />
            </div>
          </div>

          {liveBMI > 0 && (
            <div className="px-3 py-2 rounded-xl bg-dark-900/90 border border-dark-700/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">{t('body.bmi')}:</span>
                <strong className="font-mono font-black text-white text-sm">{liveBMI.toFixed(1)}</strong>
                <Badge
                  variant={
                    liveBMICat.category === 'normal'
                      ? 'success'
                      : liveBMICat.category === 'underweight'
                      ? 'info'
                      : 'warning'
                  }
                >
                  {liveBMICat.label}
                </Badge>
              </div>
            </div>
          )}

          {/* Body Circumferences */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              {lbl.circumferences}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <Input
                label={t('body.bodyFat')}
                type="number"
                step="0.1"
                placeholder="15.0"
                value={bodyFat}
                onChange={(e) => setBodyFat(e.target.value)}
                className="font-mono text-xs"
              />
              <Input
                label={lbl.waist}
                type="number"
                step="0.1"
                placeholder="82.0"
                value={waistCm}
                onChange={(e) => setWaistCm(e.target.value)}
                className="font-mono text-xs"
              />
              <Input
                label={lbl.chest}
                type="number"
                step="0.1"
                placeholder="102.0"
                value={chestCm}
                onChange={(e) => setChestCm(e.target.value)}
                className="font-mono text-xs"
              />
              <Input
                label={lbl.arms}
                type="number"
                step="0.1"
                placeholder="38.5"
                value={armsCm}
                onChange={(e) => setArmsCm(e.target.value)}
                className="font-mono text-xs"
              />
              <Input
                label={lbl.neck}
                type="number"
                step="0.1"
                placeholder="38.0"
                value={neckCm}
                onChange={(e) => setNeckCm(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-end pt-2 border-t border-dark-700/60">
            <Button
              variant="primary"
              size="sm"
              isLoading={logMutation.isPending}
              onClick={() => logMutation.mutate()}
              disabled={!weightInput}
              className="px-5"
            >
              {t('body.logWeightBtn')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Measurement Logs Table */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">
          {t('body.allHistory')} ({logs.length})
        </h3>

        {isLoadingLogs ? (
          <div className="h-32 bg-dark-800/60 rounded-2xl border border-dark-700 animate-pulse" />
        ) : logs.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-dark-800 rounded-2xl p-4 bg-dark-900/40">
            <Scale className="w-8 h-8 text-zinc-600 mx-auto mb-1.5" />
            <p className="text-xs text-zinc-400">{lbl.emptyLogs}</p>
          </div>
        ) : (
          <Card className="p-0 overflow-hidden shadow-xl border-dark-700">
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-dark-700 text-zinc-400 uppercase text-[10px] text-left bg-dark-900/70">
                    <th className="py-2.5 px-3">{lbl.date}</th>
                    <th className="py-2.5 px-3">{t('bmi.weight')}</th>
                    <th className="py-2.5 px-3">{t('body.bmi')}</th>
                    <th className="py-2.5 px-3">{t('body.bodyFat')}</th>
                    <th className="py-2.5 px-3">{lbl.waist}</th>
                    <th className="py-2.5 px-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700/50">
                  {logs
                    .slice()
                    .reverse()
                    .map((log) => {
                      const itemBmi =
                        log.calculated_bmi ?? (numHeight > 0 ? calculateBMI(log.weight_kg, numHeight) : null);
                      const cat = itemBmi ? getBMICategory(itemBmi) : null;

                      return (
                        <tr key={log.id} className="hover:bg-dark-700/30 transition-colors">
                          <td className="py-2.5 px-3 text-zinc-300 font-sans flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                            <span>{log.log_date}</span>
                          </td>
                          <td className="py-2.5 px-3 text-white font-bold">
                            {formatWeight(log.weight_kg, unitPref)}
                          </td>
                          <td className="py-2.5 px-3">
                            {itemBmi ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white">{itemBmi.toFixed(1)}</span>
                                {cat && (
                                  <Badge
                                    variant={
                                      cat.category === 'normal'
                                        ? 'success'
                                        : cat.category === 'underweight'
                                        ? 'info'
                                        : 'warning'
                                    }
                                    size="sm"
                                  >
                                    {cat.label}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-zinc-600">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-300">
                            {log.body_fat_percentage !== undefined && log.body_fat_percentage !== null
                              ? `${log.body_fat_percentage.toFixed(1)}%`
                              : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-400">
                            {log.waist_cm ? `${log.waist_cm}` : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => deleteMutation.mutate(log.log_date)}
                              className="text-zinc-500 hover:text-red-400 p-1 rounded-lg hover:bg-dark-700 transition-colors cursor-pointer"
                              title={t('common.delete')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
