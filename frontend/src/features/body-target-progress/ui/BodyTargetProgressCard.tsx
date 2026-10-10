import React, { useState, useMemo } from 'react';
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
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '../../../shared/ui/card.tsx';
import { Button } from '../../../shared/ui/button.tsx';
import { Input } from '../../../shared/ui/input.tsx';
import { ProgressBar } from '../../../shared/ui/progress.tsx';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

interface BodyTargetProgressCardProps {
  className?: string;
  onNavigateToBody?: () => void;
}

export const BodyTargetProgressCard: React.FC<BodyTargetProgressCardProps> = ({
  className = '',
  onNavigateToBody,
}) => {
  const { t } = useTranslation();
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

  const { data: logs = [] } = useQuery<Array<{ id: string; log_date: string; weight_kg: number }>>({
    queryKey: ['body-logs'],
    queryFn: () => apiClient.get('/body/logs'),
  });

  // Current weight resolution
  const currentWeightKg =
    trend?.current_weight_kg ||
    (logs.length > 0 ? logs[logs.length - 1].weight_kg : undefined) ||
    user?.weight_kg ||
    Number(localStorage.getItem('np_current_weight_kg') || 78);

  // Target weight input
  const initialTargetWeight = user?.target_weight_kg || Number(localStorage.getItem('np_target_weight_kg') || 75);
  const [targetWeightInput, setTargetWeightInput] = useState<string>(() => {
    return unitPref === 'lb' ? kgToLb(initialTargetWeight).toFixed(1) : initialTargetWeight.toFixed(1);
  });

  // Quick daily weight log input
  const [quickWeight, setQuickWeight] = useState<string>(() => {
    return unitPref === 'lb' ? kgToLb(currentWeightKg).toFixed(1) : currentWeightKg.toFixed(1);
  });

  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);

  // Parse target weight
  const parsedTargetRaw = parseFloat(targetWeightInput) || 75;
  const targetWeightKg = unitPref === 'lb' ? lbToKg(parsedTargetRaw) : parsedTargetRaw;

  // First recorded weight for baseline progress calculation
  const startWeightKg = logs.length > 0 ? logs[0].weight_kg : currentWeightKg;

  // Calculate Progress Percentage
  const { progressPercent, diffToGoal } = useMemo(() => {
    const diff = Math.round((currentWeightKg - targetWeightKg) * 10) / 10;
    const isCut = startWeightKg >= targetWeightKg;
    const totalDelta = Math.abs(startWeightKg - targetWeightKg);
    const completedDelta = Math.abs(startWeightKg - currentWeightKg);

    let pct = 0;
    if (totalDelta > 0) {
      if (isCut) {
        if (currentWeightKg <= targetWeightKg) pct = 100;
        else pct = Math.min(100, Math.max(0, Math.round((completedDelta / totalDelta) * 100)));
      } else {
        if (currentWeightKg >= targetWeightKg) pct = 100;
        else pct = Math.min(100, Math.max(0, Math.round((completedDelta / totalDelta) * 100)));
      }
    } else if (Math.abs(diff) < 0.2) {
      pct = 100;
    }

    return { progressPercent: pct, diffToGoal: diff };
  }, [currentWeightKg, targetWeightKg, startWeightKg]);

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
      void queryClient.invalidateQueries({ queryKey: ['body-trend'] });
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
      void queryClient.invalidateQueries({ queryKey: ['body-trend'] });
      void queryClient.invalidateQueries({ queryKey: ['body-logs'] });
      setLogSuccess(true);
      setTimeout(() => setLogSuccess(false), 2500);
    },
  });

  const handleQuickLog = (e: React.FormEvent) => {
    e.preventDefault();
    const rawVal = parseFloat(quickWeight);
    if (!rawVal || rawVal <= 0) return;

    const valKg = unitPref === 'lb' ? lbToKg(rawVal) : rawVal;
    logWeightMutation.mutate(valKg);
  };

  return (
    <Card className={`relative overflow-hidden ${className}`}>
      <div className="absolute top-0 right-0 w-48 h-48 bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-brand-500/20 to-emerald-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400 shadow-md shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>{t('body.goalTitle')}</CardTitle>
              <Badge variant="brand" size="sm">
                <Sparkles className="w-3 h-3 mr-1" />
                Live Tracker
              </Badge>
            </div>
            <CardDescription>
              {t('body.goalSubtitle')}
            </CardDescription>
          </div>
        </div>

        {onNavigateToBody && (
          <button
            onClick={onNavigateToBody}
            className="text-xs text-brand-400 hover:text-brand-300 font-bold flex items-center gap-1 self-start sm:self-auto hover:underline cursor-pointer"
          >
            <span>{t('body.allHistory')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Primary KPI Grid: Current vs Target vs Delta */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 1. Current Weight */}
          <div className="p-4 rounded-2xl bg-dark-900/80 border border-dark-700/80 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-zinc-400" />
              {t('body.currentWeight')}
            </span>
            <div className="text-2xl font-black font-mono text-white tracking-tight">
              {formatWeight(currentWeightKg, unitPref)}
            </div>
            <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
              <span>BMI {currentBMI > 0 ? currentBMI.toFixed(1) : '—'}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${bmiCategory.bgColor} ${bmiCategory.textColor} ${bmiCategory.borderColor}`}>
                {bmiCategory.label}
              </span>
            </div>
          </div>

          {/* 2. Target Goal Weight */}
          <div className="p-4 rounded-2xl bg-dark-900/80 border border-brand-500/30 space-y-1 relative">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" />
                {t('body.targetWeight')}
              </span>
              <button
                onClick={() => setIsEditingTarget(!isEditingTarget)}
                className="text-[10px] font-semibold text-zinc-400 hover:text-brand-400 transition-colors cursor-pointer"
              >
                {isEditingTarget ? t('common.cancel') : t('common.edit')}
              </button>
            </div>

            {isEditingTarget ? (
              <div className="flex items-center gap-1.5 pt-1">
                <Input
                  type="number"
                  step="0.1"
                  size="sm"
                  value={targetWeightInput}
                  onChange={(e) => setTargetWeightInput(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button size="sm" variant="primary" onClick={handleSaveTarget} className="h-8 px-3 text-xs">
                  {t('common.save')}
                </Button>
              </div>
            ) : (
              <div className="text-2xl font-black font-mono text-brand-400 tracking-tight">
                {formatWeight(targetWeightKg, unitPref)}
              </div>
            )}

            <div className="text-[11px] text-zinc-400">
              {t('body.targetBMI')}: <strong className="text-zinc-200">{targetBMI > 0 ? targetBMI.toFixed(1) : '—'}</strong>
            </div>
          </div>

          {/* 3. Remaining Delta */}
          <div className="p-4 rounded-2xl bg-dark-900/80 border border-dark-700/80 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              {diffToGoal > 0 ? (
                <TrendingDown className="w-3.5 h-3.5 text-blue-400" />
              ) : (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              )}
              {t('body.remainingToGoal')}
            </span>
            <div className="text-2xl font-black font-mono text-emerald-400 tracking-tight">
              {Math.abs(diffToGoal) < 0.1 ? (
                <span className="text-emerald-400 flex items-center gap-1 text-lg">
                  <CheckCircle2 className="w-5 h-5" /> {t('body.goalAchieved')}
                </span>
              ) : (
                <>
                  {diffToGoal > 0 ? '-' : '+'}
                  {formatWeight(Math.abs(diffToGoal), unitPref)}
                </>
              )}
            </div>
            <div className="text-[11px] text-zinc-400">
              {diffToGoal > 0 ? t('body.cutting') : t('body.bulking')}
            </div>
          </div>
        </div>

        {/* Progress Bar Visualizer */}
        <div className="space-y-2 bg-dark-950/70 p-4 rounded-2xl border border-dark-750">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-zinc-200 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-brand-400" />
              {t('body.goalProgress')}
            </span>
            <span className="font-mono font-bold text-brand-400 text-sm">{progressPercent}%</span>
          </div>

          <ProgressBar value={progressPercent} color="gradient" size="lg" />

          <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono pt-0.5">
            <span>{t('body.start')}: {formatWeight(startWeightKg, unitPref)}</span>
            <span>{t('body.current')}: {formatWeight(currentWeightKg, unitPref)}</span>
            <span className="text-brand-400 font-bold">{t('body.goal')}: {formatWeight(targetWeightKg, unitPref)}</span>
          </div>
        </div>

        {/* Quick Today Weigh-In Form */}
        <form
          onSubmit={handleQuickLog}
          className="p-4 rounded-2xl bg-dark-900/90 border border-brand-500/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-md"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-100">
                {t('body.logTodayWeight')}
              </div>
              <div className="text-[10px] text-zinc-400">
                {t('body.logTodayDesc')}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-full sm:w-36">
              <Input
                type="number"
                step="0.1"
                size="sm"
                value={quickWeight}
                onChange={(e) => setQuickWeight(e.target.value)}
                placeholder="80.5"
                className="font-mono font-bold text-right text-xs"
                endContent={<span className="text-xs text-zinc-400 font-bold">{unitPref.toUpperCase()}</span>}
              />
            </div>

            <Button
              type="submit"
              size="sm"
              variant={logSuccess ? 'success' : 'primary'}
              disabled={logWeightMutation.isPending}
              isLoading={logWeightMutation.isPending}
              className="shrink-0"
            >
              {logSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t('body.weightSaved')}</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('body.logWeightBtn')}</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
