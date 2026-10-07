import React, { useState, useEffect } from 'react';
import {
  Scale,
  TrendingUp,
  TrendingDown,
  Trash2,
  Calculator,
  Calendar,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Card } from '../../../shared/ui/card.tsx';
import { Button } from '../../../shared/ui/button.tsx';
import { Input } from '../../../shared/ui/input.tsx';
import { formatWeight, lbToKg, kgToLb } from '../../../shared/lib/units.ts';
import { calculateBMI, getBMICategory } from '../../../shared/lib/calculations.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
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
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const unitPref = useAuthStore((s) => s.unitPreference);
  const updateUserStats = useAuthStore((s) => s.updateUserStats);

  // Form State
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
  const [error, setError] = useState<string | null>(null);
  const [showCalculator, setShowCalculator] = useState(true);

  // Sync saved height
  useEffect(() => {
    if (user?.height_cm && !heightCm) {
      setHeightCm(user.height_cm.toString());
    }
  }, [user?.height_cm]);

  // Queries
  const { data: trend } = useQuery<BodyTrendResponse>({
    queryKey: ['body-trend'],
    queryFn: () => apiClient<BodyTrendResponse>('/body/trend'),
  });

  const { data: logs = [], isLoading: isLoadingLogs } = useQuery<BodyLog[]>({
    queryKey: ['body-logs'],
    queryFn: () => apiClient<BodyLog[]>('/body/logs'),
  });

  // Calculate live BMI for the form input
  const numWeight = parseFloat(weightInput) || (trend ? (unitPref === 'lb' ? kgToLb(trend.current_weight_kg) : trend.current_weight_kg) : 0);
  const weightKgLive = unitPref === 'lb' ? lbToKg(numWeight) : numWeight;
  const numHeight = parseFloat(heightCm) || 0;
  const liveBMI = numHeight > 0 && weightKgLive > 0 ? calculateBMI(weightKgLive, numHeight) : 0;
  const liveBMICat = getBMICategory(liveBMI);

  // Mutation: Log Body Measurement
  const logMutation = useMutation({
    mutationFn: async () => {
      const parsedWeight = parseFloat(weightInput);
      if (isNaN(parsedWeight) || parsedWeight <= 0) {
        throw new Error('Please enter a valid body weight');
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
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['body-trend'] });
      queryClient.invalidateQueries({ queryKey: ['body-logs'] });
      setWeightInput('');
      setBodyFat('');
      setWaistCm('');
      setChestCm('');
      setArmsCm('');
      setError(null);
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to save body measurement');
    },
  });

  // Mutation: Delete Log
  const deleteMutation = useMutation({
    mutationFn: (date: string) =>
      apiClient(`/body/logs/${date}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['body-trend'] });
      queryClient.invalidateQueries({ queryKey: ['body-logs'] });
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <span>Body Composition & BMI Tracker</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">
              Health Hub
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Log your daily weight, monitor 7-day moving averages (SMA), calculate BMI and metabolic expenditure.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCalculator(!showCalculator)}
          className="text-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Calculator className="w-3.5 h-3.5 text-brand-400" />
          <span>{showCalculator ? 'Hide Health Calculator' : 'Show Health Calculator'}</span>
        </Button>
      </div>

      {/* Live Target Weight Progress & Quick Log Card */}
      <BodyTargetProgressCard />

      {/* Interactive Health & BMI Calculator Card */}
      {showCalculator && (
        <BMICalculatorCard
          initialHeightCm={parseFloat(heightCm) || undefined}
          initialWeightKg={trend?.current_weight_kg}
          onSaveStats={(s) => {
            setHeightCm(s.heightCm.toString());
            queryClient.invalidateQueries({ queryKey: ['body-trend'] });
          }}
        />
      )}

      {/* Trend KPI Cards */}
      {trend && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Card className="p-4 bg-dark-800/90 border-dark-700/80 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Current Weight</span>
            <div className="text-xl font-black font-mono text-white">
              {formatWeight(trend.current_weight_kg, unitPref)}
            </div>
            <span className="text-[10px] text-zinc-500">Latest recorded weigh-in</span>
          </Card>

          <Card className="p-4 bg-dark-800/90 border-dark-700/80 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">7-Day Moving Avg</span>
            <div className="text-xl font-black font-mono text-brand-400">
              {formatWeight(trend.current_7day_sma_kg, unitPref)}
            </div>
            <span className="text-[10px] text-zinc-500">Filters daily water fluctuations</span>
          </Card>

          <Card className="p-4 bg-dark-800/90 border-dark-700/80 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Current BMI</span>
            <div className="text-xl font-black font-mono text-emerald-400 flex items-center gap-1.5">
              <span>
                {numHeight > 0 ? calculateBMI(trend.current_weight_kg, numHeight).toFixed(1) : '—'}
              </span>
              {numHeight > 0 && (
                <span className="text-[10px] font-sans font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  {getBMICategory(calculateBMI(trend.current_weight_kg, numHeight)).labelRu}
                </span>
              )}
            </div>
            <span className="text-[10px] text-zinc-500">Based on {heightCm} cm height</span>
          </Card>

          <Card className="p-4 bg-dark-800/90 border-dark-700/80 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">30-Day Delta</span>
            <div
              className={`text-xl font-black font-mono flex items-center gap-1 ${
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
            <span className="text-[10px] text-zinc-500">True 30-day net progress</span>
          </Card>
        </div>
      )}

      {/* Daily Log Input Form */}
      <Card className="p-5 bg-dark-800/90 border-dark-700/80 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-dark-700/70 pb-3">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-brand-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
              Log Weigh-In & Measurements
            </h2>
          </div>
          <span className="text-[11px] text-zinc-400 font-mono">
            Active Unit: <strong className="text-brand-400">{unitPref.toUpperCase()}</strong>
          </span>
        </div>

        {error && (
          <div className="p-3 bg-red-950/50 border border-red-800/60 rounded-xl text-red-300 text-xs">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">
              Date *
            </label>
            <input
              type="date"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">
              Body Weight ({unitPref.toUpperCase()}) *
            </label>
            <Input
              type="number"
              step="0.1"
              placeholder={unitPref === 'lb' ? '175.5' : '80.0'}
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              className="font-mono font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">
              Height (cm, for BMI)
            </label>
            <Input
              type="number"
              placeholder="180"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              className="font-mono font-bold"
            />
          </div>
        </div>

        {/* Live BMI preview banner during input */}
        {liveBMI > 0 && (
          <div className="p-3 rounded-xl bg-dark-900/90 border border-dark-700/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400 font-medium">Calculated BMI:</span>
              <strong className="font-mono font-bold text-white text-sm">{liveBMI.toFixed(1)}</strong>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${liveBMICat.bgColor} ${liveBMICat.textColor} ${liveBMICat.borderColor}`}>
                {liveBMICat.labelRu}
              </span>
            </div>
            <span className="text-[11px] text-zinc-400">
              WHO Standard
            </span>
          </div>
        )}

        {/* Optional Circumferences */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
              Body Fat (%)
            </label>
            <Input
              type="number"
              step="0.1"
              placeholder="15.0"
              value={bodyFat}
              onChange={(e) => setBodyFat(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
              Waist (cm)
            </label>
            <Input
              type="number"
              step="0.1"
              placeholder="82.0"
              value={waistCm}
              onChange={(e) => setWaistCm(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
              Chest (cm)
            </label>
            <Input
              type="number"
              step="0.1"
              placeholder="102.0"
              value={chestCm}
              onChange={(e) => setChestCm(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
              Arms (cm)
            </label>
            <Input
              type="number"
              step="0.1"
              placeholder="38.5"
              value={armsCm}
              onChange={(e) => setArmsCm(e.target.value)}
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
            className="font-bold text-xs shadow-md shadow-brand-500/20 px-5"
          >
            Save Weigh-In
          </Button>
        </div>
      </Card>

      {/* Measurement Logs Table */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
          <span>Weigh-In & Metric History ({logs.length})</span>
        </h2>

        {isLoadingLogs ? (
          <div className="h-36 bg-dark-800/60 rounded-2xl border border-dark-700 animate-pulse" />
        ) : logs.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-dark-800 rounded-2xl p-6 bg-dark-900/40">
            <Scale className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
            <p className="text-xs text-zinc-400">
              No body logs recorded yet. Track your daily weigh-ins to see 7-day moving averages and BMI trends.
            </p>
          </div>
        ) : (
          <Card className="bg-dark-800/90 border-dark-700 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-dark-700 text-zinc-400 uppercase text-[10px] text-left bg-dark-900/50">
                    <th className="py-3 px-3.5">Date</th>
                    <th className="py-3 px-3.5">Weight</th>
                    <th className="py-3 px-3.5">BMI</th>
                    <th className="py-3 px-3.5">Body Fat</th>
                    <th className="py-3 px-3.5">Waist</th>
                    <th className="py-3 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700/50">
                  {logs.map((log) => {
                    const itemBmi = log.calculated_bmi ?? (numHeight > 0 ? calculateBMI(log.weight_kg, numHeight) : null);
                    const cat = itemBmi ? getBMICategory(itemBmi) : null;

                    return (
                      <tr key={log.id} className="hover:bg-dark-700/30 transition-colors">
                        <td className="py-3 px-3.5 text-zinc-300 font-sans flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                          <span>{log.log_date}</span>
                        </td>
                        <td className="py-3 px-3.5 text-white font-bold">
                          {formatWeight(log.weight_kg, unitPref)}
                        </td>
                        <td className="py-3 px-3.5">
                          {itemBmi ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white">{itemBmi.toFixed(1)}</span>
                              {cat && (
                                <span className={`text-[9px] font-sans font-semibold px-1.5 py-0.2 rounded border ${cat.bgColor} ${cat.textColor} ${cat.borderColor}`}>
                                  {cat.labelRu}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-zinc-300">
                          {log.body_fat_percentage !== undefined && log.body_fat_percentage !== null
                            ? `${log.body_fat_percentage.toFixed(1)}%`
                            : '—'}
                        </td>
                        <td className="py-3 px-3.5 text-zinc-400">
                          {log.waist_cm ? `${log.waist_cm} cm` : '—'}
                        </td>
                        <td className="py-3 px-3.5 text-right">
                          <button
                            onClick={() => deleteMutation.mutate(log.log_date)}
                            className="text-zinc-500 hover:text-red-400 p-1 rounded-lg hover:bg-dark-700 transition-colors"
                            title="Delete measurement"
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
