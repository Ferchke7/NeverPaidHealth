import React, { useState } from 'react';
import {
  Scale,
  Target,
  TrendingDown,
  TrendingUp,
  Plus,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Flame,
  Calendar,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { formatWeight, lbToKg, kgToLb } from '../../../shared/lib/units.ts';
import { calculateBMI, getBMICategory } from '../../../shared/lib/calculations.ts';
import { Card } from '../../../shared/ui/card.tsx';
import { Button } from '../../../shared/ui/button.tsx';
import { Input } from '../../../shared/ui/input.tsx';

interface BodyTargetProgressCardProps {
  className?: string;
  onNavigateToBody?: () => void;
}

export const BodyTargetProgressCard: React.FC<BodyTargetProgressCardProps> = ({
  className = '',
  onNavigateToBody,
}) => {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const unitPref = useAuthStore((s) => s.unitPreference);
  const updateUserStats = useAuthStore((s) => s.updateUserStats);

  // Fetch body trends and logs
  const { data: trend } = useQuery<{
    current_weight_kg: number;
    current_7day_sma_kg: number;
    delta_7day_kg?: number;
    delta_30day_kg?: number;
  }>({
    queryKey: ['body-trend'],
    queryFn: () => apiClient.get('/body/trend'),
  });

  const { data: logs = [] } = useQuery<Array<{ log_date: string; weight_kg: number }>>({
    queryKey: ['body-logs'],
    queryFn: () => apiClient.get('/body/logs'),
  });

  // Current weight: trend -> user profile -> localStorage -> 78
  const currentWeightKg =
    trend?.current_weight_kg ||
    user?.weight_kg ||
    Number(localStorage.getItem('np_current_weight_kg') || 78);

  // Target weight: user profile -> localStorage -> 72
  const [targetWeightInput, setTargetWeightInput] = useState<string>(() => {
    const val = user?.target_weight_kg || localStorage.getItem('np_target_weight_kg') || '75';
    if (unitPref === 'lb') {
      return kgToLb(Number(val)).toFixed(1);
    }
    return String(val);
  });

  // Quick daily weight log input
  const [quickWeight, setQuickWeight] = useState<string>(() => {
    return unitPref === 'lb'
      ? kgToLb(currentWeightKg).toFixed(1)
      : currentWeightKg.toFixed(1);
  });

  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);

  // Parse target weight
  const parsedTargetRaw = parseFloat(targetWeightInput) || 75;
  const targetWeightKg = unitPref === 'lb' ? lbToKg(parsedTargetRaw) : parsedTargetRaw;

  // First recorded weight for baseline progress calculation
  const startWeightKg = logs.length > 0 ? logs[logs.length - 1].weight_kg : currentWeightKg;

  // Difference and Progress calculation
  const diffToGoal = currentWeightKg - targetWeightKg;
  const totalChangeNeeded = Math.abs((startWeightKg || currentWeightKg) - targetWeightKg);
  const changeAchieved = Math.abs((startWeightKg || currentWeightKg) - currentWeightKg);

  let progressPercent = 0;
  if (totalChangeNeeded > 0) {
    progressPercent = Math.min(100, Math.max(0, Math.round((changeAchieved / totalChangeNeeded) * 100)));
  } else if (Math.abs(diffToGoal) < 0.2) {
    progressPercent = 100;
  }

  // BMI calculations
  const heightCm = user?.height_cm || Number(localStorage.getItem('np_saved_height_cm') || 178);
  const currentBMI = calculateBMI(currentWeightKg, heightCm);
  const targetBMI = calculateBMI(targetWeightKg, heightCm);
  const bmiCategory = getBMICategory(currentBMI);

  // Save Target Weight Mutation
  const handleSaveTarget = () => {
    if (targetWeightKg > 0) {
      updateUserStats({
        target_weight_kg: targetWeightKg,
      });
      localStorage.setItem('np_target_weight_kg', targetWeightKg.toString());
      setIsEditingTarget(false);
      queryClient.invalidateQueries({ queryKey: ['body-trend'] });
    }
  };

  // Quick Log Today's Weight Mutation
  const logWeightMutation = useMutation({
    mutationFn: async (weightValueKg: number) => {
      const todayStr = new Date().toISOString().split('T')[0];
      return apiClient.post('/body/logs', {
        log_date: todayStr,
        weight_kg: weightValueKg,
        height_cm: heightCm,
      });
    },
    onSuccess: (_, weightValueKg) => {
      updateUserStats({
        weight_kg: weightValueKg,
      });
      localStorage.setItem('np_current_weight_kg', weightValueKg.toString());
      queryClient.invalidateQueries({ queryKey: ['body-trend'] });
      queryClient.invalidateQueries({ queryKey: ['body-logs'] });
      setLogSuccess(true);
      setTimeout(() => setLogSuccess(false), 2500);
    },
  });

  const handleQuickLog = (e: React.FormEvent) => {
    e.preventDefault();
    const rawVal = parseFloat(quickWeight);
    if (isNaN(rawVal) || rawVal <= 0) return;

    const valKg = unitPref === 'lb' ? lbToKg(rawVal) : rawVal;
    logWeightMutation.mutate(valKg);
  };

  return (
    <Card className={`p-5 bg-gradient-to-br from-dark-850 via-dark-900 to-dark-850 border-dark-700/80 space-y-5 shadow-xl relative overflow-hidden ${className}`}>
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-dark-750 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-brand-500/20 to-emerald-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400 shadow-md shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-white tracking-tight">
                Цель и прогресс веса (Body Weight Goal)
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/15 text-brand-400 border border-brand-500/30 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                Live Tracker
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Связка вашего профиля с динамикой веса, расчетом БЖУ и прогрессом к цели.
            </p>
          </div>
        </div>

        {onNavigateToBody && (
          <button
            onClick={onNavigateToBody}
            className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1 self-start sm:self-auto hover:underline"
          >
            <span>Вся история и замеры</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Primary KPI Grid: Current vs Target vs Delta */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* 1. Current Weight */}
        <div className="p-4 rounded-2xl bg-dark-800/80 border border-dark-700/80 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-zinc-400" />
            Текущий вес
          </span>
          <div className="text-2xl font-black font-mono text-white tracking-tight">
            {formatWeight(currentWeightKg, unitPref)}
          </div>
          <div className="text-[11px] text-zinc-400 flex items-center gap-1">
            <span>BMI {currentBMI.toFixed(1)}</span>
            <span className="text-emerald-400 font-semibold">({bmiCategory.labelRu})</span>
          </div>
        </div>

        {/* 2. Target Goal Weight */}
        <div className="p-4 rounded-2xl bg-dark-800/80 border border-brand-500/30 space-y-1 relative">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" />
              Целевой вес
            </span>
            <button
              onClick={() => setIsEditingTarget(!isEditingTarget)}
              className="text-[10px] font-semibold text-zinc-400 hover:text-brand-400 transition-colors"
            >
              {isEditingTarget ? 'Отмена' : 'Изменить'}
            </button>
          </div>

          {isEditingTarget ? (
            <div className="flex items-center gap-1.5 pt-1">
              <Input
                type="number"
                step="0.1"
                value={targetWeightInput}
                onChange={(e) => setTargetWeightInput(e.target.value)}
                className="font-mono text-sm py-1 h-8 bg-dark-900"
              />
              <Button size="sm" variant="primary" onClick={handleSaveTarget} className="h-8 px-3 text-xs">
                OK
              </Button>
            </div>
          ) : (
            <div className="text-2xl font-black font-mono text-brand-400 tracking-tight">
              {formatWeight(targetWeightKg, unitPref)}
            </div>
          )}

          <div className="text-[11px] text-zinc-400">
            Целевой BMI: <strong className="text-zinc-200">{targetBMI.toFixed(1)}</strong>
          </div>
        </div>

        {/* 3. Remaining Delta */}
        <div className="p-4 rounded-2xl bg-dark-800/80 border border-dark-700/80 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            {diffToGoal > 0 ? (
              <TrendingDown className="w-3.5 h-3.5 text-blue-400" />
            ) : (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            )}
            Осталось до цели
          </span>
          <div className="text-2xl font-black font-mono text-emerald-400 tracking-tight">
            {Math.abs(diffToGoal) < 0.1 ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-5 h-5" /> Цель достигнута!
              </span>
            ) : (
              <>
                {diffToGoal > 0 ? '-' : '+'}
                {formatWeight(Math.abs(diffToGoal), unitPref)}
              </>
            )}
          </div>
          <div className="text-[11px] text-zinc-400">
            {diffToGoal > 0 ? 'Сброс веса (дефицит)' : 'Набор массы (профицит)'}
          </div>
        </div>
      </div>

      {/* Progress Bar Visualizer */}
      <div className="space-y-2 bg-dark-900/60 p-4 rounded-2xl border border-dark-750">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-brand-400" />
            Прогресс достижения цели
          </span>
          <span className="font-mono font-bold text-brand-400">{progressPercent}%</span>
        </div>

        {/* Bar */}
        <div className="w-full h-3.5 bg-dark-800 rounded-full overflow-hidden p-0.5 border border-dark-700 flex items-center">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-400 transition-all duration-500 shadow-sm"
            style={{ width: `${Math.max(4, Math.min(100, progressPercent))}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono pt-0.5">
          <span>Старт: {formatWeight(startWeightKg, unitPref)}</span>
          <span>Текущий: {formatWeight(currentWeightKg, unitPref)}</span>
          <span className="text-brand-400 font-bold">Цель: {formatWeight(targetWeightKg, unitPref)}</span>
        </div>
      </div>

      {/* Quick Today Weigh-In Form */}
      <form
        onSubmit={handleQuickLog}
        className="p-4 rounded-2xl bg-dark-800/90 border border-brand-500/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-md"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-zinc-100">
              Записать взвешивание за сегодня
            </div>
            <div className="text-[10px] text-zinc-400">
              Мгновенно обновляет прогресс и историю измерений
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-36">
            <Input
              type="number"
              step="0.1"
              value={quickWeight}
              onChange={(e) => setQuickWeight(e.target.value)}
              placeholder="80.5"
              className="bg-dark-900 font-mono font-bold text-right pr-10 text-xs h-9"
            />
            <span className="absolute right-3 top-2.5 text-xs text-zinc-400 font-bold pointer-events-none">
              {unitPref.toUpperCase()}
            </span>
          </div>

          <Button
            type="submit"
            size="sm"
            variant="primary"
            disabled={logWeightMutation.isPending}
            className="text-xs font-bold gap-1.5 h-9 shrink-0 shadow-md shadow-brand-500/20"
          >
            {logSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Записано!</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Записать вес</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
};
