import React, { useState, useMemo } from 'react';
import {
  Trophy,
  TrendingUp,
  Dumbbell,
  Flame,
  Calculator,
  Calendar as CalendarIcon,
  Activity,
  Layers,
  BarChart3,
  Shield,
  Scale,
  Sparkles,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '../../../shared/ui/card.tsx';
import { Input } from '../../../shared/ui/input.tsx';
import { Tabs } from '../../../shared/ui/tabs.tsx';
import { ProgressBar } from '../../../shared/ui/progress.tsx';
import { formatDate } from '../../../shared/lib/dates.ts';
import { formatWeight } from '../../../shared/lib/units.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { Exercise } from '../../../entities/exercise/model/types.ts';
import { WorkoutHistoryItem } from '../../../entities/workout/model/types.ts';
import { WorkoutCalendar } from '../../../features/workout-calendar/ui/WorkoutCalendar.tsx';
import { BodyTargetProgressCard } from '../../../features/body-target-progress/ui/BodyTargetProgressCard.tsx';
import { BMICalculatorCard } from '../../../features/bmi-calculator/ui/BMICalculatorCard.tsx';

interface PersonalRecord {
  pr_type: 'heaviest_weight' | 'best_e1rm' | 'max_volume_set' | 'max_reps';
  value: number;
  achieved_at: string;
  workout_id: string;
}

interface ExerciseRecordGroup {
  exercise_id: string;
  exercise_name: string;
  best_weight_kg?: number;
  best_e1rm_kg?: number;
  max_volume_set_kg?: number;
  max_reps?: number;
  records: PersonalRecord[];
}

interface HistoryDataPoint {
  workout_id: string;
  date: string;
  best_weight_kg: number;
  best_e1rm_kg?: number | null;
  total_exercise_volume_kg: number;
}

interface ExerciseHistoryResponse {
  exercise_id: string;
  exercise_name: string;
  data_points: HistoryDataPoint[];
}

const MUSCLE_FILTER = [
  { id: 'all', label: 'All Muscles' },
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'legs', label: 'Legs' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'arms', label: 'Arms' },
  { id: 'core', label: 'Core' },
];

export const ProgressPage: React.FC = () => {
  const unitPref = useAuthStore((s) => s.unitPreference);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedMuscle, setSelectedMuscle] = useState('all');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);

  // 1RM Calculator state
  const [calcWeight, setCalcWeight] = useState<number>(100);
  const [calcReps, setCalcReps] = useState<number>(5);

  // Fetch all personal records
  const { data: recordGroups = [] } = useQuery<ExerciseRecordGroup[]>({
    queryKey: ['records'],
    queryFn: () => apiClient<ExerciseRecordGroup[]>('/progress/records'),
  });

  // Fetch workout history for analytics & calendar
  const { data: workoutsData } = useQuery<{ items: WorkoutHistoryItem[] }>({
    queryKey: ['workouts'],
    queryFn: () => apiClient<{ items: WorkoutHistoryItem[] }>('/workouts?limit=100'),
  });
  const workouts = workoutsData?.items || [];

  // Fetch exercise catalog for dropdown
  const { data: exercises = [] } = useQuery<Exercise[]>({
    queryKey: ['exercises'],
    queryFn: () => apiClient<Exercise[]>('/exercises'),
  });

  const activeExerciseId =
    selectedExerciseId || (recordGroups[0]?.exercise_id ?? exercises[0]?.id);

  // Fetch time-series history for chosen exercise
  const { data: historyData } = useQuery<ExerciseHistoryResponse>({
    queryKey: ['history', activeExerciseId],
    queryFn: () => apiClient<ExerciseHistoryResponse>(`/progress/history/${activeExerciseId}`),
    enabled: !!activeExerciseId,
  });

  // 1RM calculations based on Brzycki formula
  const calculated1RM = useMemo(() => {
    if (calcReps <= 1) return calcWeight;
    const brzycki = calcWeight * (36 / (37 - Math.min(calcReps, 36)));
    return Math.round(brzycki * 10) / 10;
  }, [calcWeight, calcReps]);

  const percentageTable = useMemo(() => {
    const percentages = [100, 95, 90, 85, 80, 75, 70, 65];
    return percentages.map((pct) => ({
      percentage: pct,
      weightKg: Math.round(((calculated1RM * pct) / 100) * 10) / 10,
      repsGoal:
        pct === 100 ? '1 rep' :
        pct === 95 ? '2 reps' :
        pct === 90 ? '3-4 reps' :
        pct === 85 ? '5-6 reps' :
        pct === 80 ? '7-8 reps' :
        pct === 75 ? '9-10 reps' :
        pct === 70 ? '11-12 reps' : '12-15 reps',
    }));
  }, [calculated1RM]);

  // Filter PR groups by muscle
  const filteredRecordGroups = useMemo(() => {
    if (selectedMuscle === 'all') return recordGroups;
    return recordGroups.filter((g) => {
      const exObj = exercises.find((e) => e.id === g.exercise_id);
      const muscle = exObj?.primary_muscle_group || exObj?.primary_muscle || '';
      return muscle.toLowerCase() === selectedMuscle.toLowerCase();
    });
  }, [recordGroups, exercises, selectedMuscle]);

  // Overall Athletics Analytics summary
  const analyticsSummary = useMemo(() => {
    let totalTonnage = 0;
    let totalSets = 0;
    let totalSecs = 0;

    const muscleSets: Record<string, number> = {
      Chest: 0,
      Back: 0,
      Legs: 0,
      Shoulders: 0,
      Arms: 0,
      Core: 0,
    };

    for (const w of workouts) {
      totalTonnage += w.total_volume_kg || 0;
      totalSets += w.completed_sets_count || 0;
      totalSecs += w.duration_seconds || 0;

      for (const ex of w.exercises || []) {
        const name = (ex.exercise_name || '').toLowerCase();
        let group = 'Chest';
        if (name.includes('bench') || name.includes('chest') || name.includes('dip') || name.includes('fly')) group = 'Chest';
        else if (name.includes('pull') || name.includes('row') || name.includes('lat') || name.includes('deadlift')) group = 'Back';
        else if (name.includes('squat') || name.includes('leg') || name.includes('lunge') || name.includes('calf')) group = 'Legs';
        else if (name.includes('press') || name.includes('raise') || name.includes('shoulder') || name.includes('delt')) group = 'Shoulders';
        else if (name.includes('curl') || name.includes('tricep') || name.includes('bicep') || name.includes('extension')) group = 'Arms';
        else if (name.includes('crunch') || name.includes('plank') || name.includes('ab') || name.includes('core')) group = 'Core';

        muscleSets[group] = (muscleSets[group] || 0) + (ex.sets?.length || 0);
      }
    }

    const totalPRs = recordGroups.reduce((acc, g) => acc + (g.records?.length || 1), 0);

    return {
      totalWorkouts: workouts.length,
      totalTonnageKg: totalTonnage,
      totalSets,
      totalHours: Math.round((totalSecs / 3600) * 10) / 10,
      totalPRs,
      muscleSets,
    };
  }, [workouts, recordGroups]);

  // Strength Standards
  const strengthStandards = useMemo(() => {
    const targets = [
      { name: 'Barbell Bench Press', beginner: 60, intermediate: 90, advanced: 120, elite: 150 },
      { name: 'Barbell Back Squat', beginner: 80, intermediate: 120, advanced: 160, elite: 200 },
      { name: 'Barbell Deadlift', beginner: 100, intermediate: 140, advanced: 190, elite: 240 },
      { name: 'Overhead Shoulder Press', beginner: 40, intermediate: 60, advanced: 80, elite: 100 },
      { name: 'Weighted Pull-Up', beginner: 10, intermediate: 25, advanced: 45, elite: 65 },
    ];

    return targets.map((t) => {
      const match = recordGroups.find((g) => g.exercise_name?.toLowerCase().includes(t.name.toLowerCase().slice(0, 8)));
      const best1RM = match?.best_e1rm_kg || match?.best_weight_kg || 0;

      let level = 'Unranked';
      let progressPct = 0;
      let badgeColor = 'neutral';

      if (best1RM >= t.elite) {
        level = 'Elite Athlete';
        progressPct = 100;
        badgeColor = 'accent';
      } else if (best1RM >= t.advanced) {
        level = 'Advanced';
        progressPct = 75 + ((best1RM - t.advanced) / (t.elite - t.advanced)) * 25;
        badgeColor = 'brand';
      } else if (best1RM >= t.intermediate) {
        level = 'Intermediate';
        progressPct = 50 + ((best1RM - t.intermediate) / (t.advanced - t.intermediate)) * 25;
        badgeColor = 'info';
      } else if (best1RM >= t.beginner) {
        level = 'Novice';
        progressPct = 25 + ((best1RM - t.beginner) / (t.intermediate - t.beginner)) * 25;
        badgeColor = 'success';
      } else if (best1RM > 0) {
        level = 'Beginner';
        progressPct = (best1RM / t.beginner) * 25;
        badgeColor = 'neutral';
      }

      return {
        ...t,
        best1RM,
        level,
        progressPct: Math.min(100, Math.max(5, Math.round(progressPct))),
        badgeColor: badgeColor as any,
      };
    });
  }, [recordGroups]);

  const navTabs = [
    { id: 'overview', label: 'Overview & Volume', icon: <Activity className="w-4 h-4" /> },
    { id: 'body', label: 'Body Weight & Goals', icon: <Scale className="w-4 h-4" /> },
    { id: 'calendar', label: 'Workout Calendar', icon: <CalendarIcon className="w-4 h-4" /> },
    { id: 'muscles', label: 'Muscle Heatmap', icon: <Layers className="w-4 h-4" /> },
    { id: 'strength', label: 'Strength Standards', icon: <Shield className="w-4 h-4" /> },
    { id: 'prs', label: 'PRs Hall of Fame', icon: <Trophy className="w-4 h-4" />, badge: recordGroups.length },
    { id: 'calculator', label: '1RM Calculator', icon: <Calculator className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-dark-850 via-dark-800 to-brand-950/40 border border-dark-700/80 p-6 sm:p-7 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 shadow-sm">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Analytics & Performance Hub
              </h1>
              <Badge variant="brand" size="sm">
                <Sparkles className="w-3 h-3 mr-1" />
                Live Hub
              </Badge>
            </div>
            <p className="text-xs text-zinc-400">
              Interactive progression curves, volume heatmaps, personal records, and strength standards.
            </p>
          </div>
        </div>

        {/* HeroUI Tabs Navigation */}
        <div className="pt-5 border-t border-dark-700/60 mt-4">
          <Tabs
            tabs={navTabs}
            selectedKey={activeTab}
            onSelectionChange={setActiveTab}
            variant="bordered"
          />
        </div>
      </div>

      {/* TAB: BODY WEIGHT & TARGET GOALS */}
      {activeTab === 'body' && (
        <div className="space-y-6 animate-fade-in">
          <BodyTargetProgressCard />
          <BMICalculatorCard />
        </div>
      )}

      {/* TAB: OVERVIEW & VOLUME PROGRESSION */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          {/* Top KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-4.5 bg-dark-800/80 border-dark-700/80 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-bold">
                <Dumbbell className="w-4 h-4 text-brand-400" />
                <span>Total Workouts</span>
              </div>
              <div className="text-2xl font-black text-white font-mono">
                {analyticsSummary.totalWorkouts}
              </div>
            </Card>

            <Card className="p-4.5 bg-dark-800/80 border-dark-700/80 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-bold">
                <Flame className="w-4 h-4 text-emerald-400" />
                <span>Total Tonnage</span>
              </div>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                {analyticsSummary.totalTonnageKg > 1000
                  ? `${(analyticsSummary.totalTonnageKg / 1000).toFixed(1)} T`
                  : `${analyticsSummary.totalTonnageKg.toFixed(0)} kg`}
              </div>
            </Card>

            <Card className="p-4.5 bg-dark-800/80 border-dark-700/80 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-bold">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Personal Records</span>
              </div>
              <div className="text-2xl font-black text-amber-400 font-mono">
                {analyticsSummary.totalPRs}
              </div>
            </Card>

            <Card className="p-4.5 bg-dark-800/80 border-dark-700/80 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-bold">
                <Activity className="w-4 h-4 text-sky-400" />
                <span>Time Under Load</span>
              </div>
              <div className="text-2xl font-black text-sky-400 font-mono">
                {analyticsSummary.totalHours} hrs
              </div>
            </Card>
          </div>

          {/* Exercise Progression Curve Chart */}
          <Card className="space-y-4">
            <CardHeader>
              <div>
                <CardTitle>
                  <TrendingUp className="w-5 h-5 text-brand-400" />
                  Strength & Weight Progression Curve
                </CardTitle>
                <CardDescription>
                  Track 1RM and working weight milestones over time for any movement.
                </CardDescription>
              </div>

              {/* Exercise Selector */}
              <select
                value={activeExerciseId}
                onChange={(e) => setSelectedExerciseId(e.target.value)}
                className="bg-dark-900 border border-dark-700 text-zinc-200 text-xs rounded-xl px-3.5 py-2 font-bold focus:outline-none focus:border-brand-500 max-w-xs"
              >
                {exercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
            </CardHeader>

            <CardContent>
              {/* SVG Interactive Chart */}
              {historyData?.data_points && historyData.data_points.length > 0 ? (
                <div className="space-y-4 pt-2">
                  <div className="h-64 w-full bg-dark-950/70 rounded-2xl p-4 border border-dark-700/60 relative flex items-end">
                    <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {(() => {
                        const pts = historyData.data_points;
                        const maxVal = Math.max(...pts.map((p) => p.best_weight_kg || 1), 10);
                        const minVal = Math.min(...pts.map((p) => p.best_weight_kg || 0), 0);
                        const range = maxVal - minVal || 1;

                        const coords = pts.map((p, i) => {
                          const x = pts.length === 1 ? 50 : (i / (pts.length - 1)) * 96 + 2;
                          const y = 90 - ((p.best_weight_kg - minVal) / range) * 75;
                          return { x, y, val: p.best_weight_kg, date: p.date };
                        });

                        const pathString = coords
                          .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x}% ${c.y}%`)
                          .join(' ');

                        return (
                          <>
                            <path
                              d={`${pathString} L ${coords[coords.length - 1].x}% 95% L ${coords[0].x}% 95% Z`}
                              fill="url(#areaGradient)"
                            />
                            <path
                              d={pathString}
                              fill="none"
                              stroke="#22c55e"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            {coords.map((c, i) => (
                              <g key={i} className="group cursor-pointer">
                                <circle
                                  cx={`${c.x}%`}
                                  cy={`${c.y}%`}
                                  r="5"
                                  className="fill-emerald-400 stroke-dark-900 stroke-2 hover:r-7 transition-all"
                                />
                                <text
                                  x={`${c.x}%`}
                                  y={`${c.y - 8}%`}
                                  textAnchor="middle"
                                  className="text-[10px] font-bold fill-zinc-200 font-mono"
                                >
                                  {c.val}kg
                                </text>
                              </g>
                            ))}
                          </>
                        );
                      })()}
                    </svg>
                  </div>

                  {/* Session Data Table */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {historyData.data_points.map((p, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-dark-900/80 border border-dark-750 flex items-center justify-between text-xs font-mono"
                      >
                        <span className="text-zinc-400 font-sans">{formatDate(p.date)}</span>
                        <span className="text-emerald-400 font-bold">
                          {formatWeight(p.best_weight_kg, unitPref)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-zinc-500 text-xs">
                  No historical logs recorded yet for this exercise. Complete a workout with this movement to render the progression curve!
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB: CALENDAR */}
      {activeTab === 'calendar' && (
        <WorkoutCalendar workouts={workouts} />
      )}

      {/* TAB: MUSCLE HEATMAP */}
      {activeTab === 'muscles' && (
        <div className="space-y-6 animate-fade-in">
          <Card className="space-y-5">
            <CardHeader>
              <div>
                <CardTitle>
                  <Layers className="w-5 h-5 text-brand-400" />
                  Muscle Volume Distribution & Hypertrophy Targets
                </CardTitle>
                <CardDescription>
                  Audited weekly set volume against optimal hypertrophy benchmarks (10–20 direct sets/week).
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(analyticsSummary.muscleSets).map(([muscle, setsCount]) => {
                  const targetSets = 16;
                  const pct = Math.min(100, Math.round((setsCount / targetSets) * 100));
                  const status =
                    setsCount >= 10 && setsCount <= 20
                      ? { label: 'Optimal Growth (MEV-MRV)', badge: 'success' }
                      : setsCount > 20
                      ? { label: 'High Overload', badge: 'warning' }
                      : setsCount > 0
                      ? { label: 'Maintenance (MV)', badge: 'info' }
                      : { label: 'Untrained', badge: 'neutral' };

                  return (
                    <div
                      key={muscle}
                      className="p-4 rounded-2xl bg-dark-900/80 border border-dark-700/80 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-extrabold text-zinc-100">{muscle}</span>
                        <Badge variant={status.badge as any} size="sm">
                          {status.label}
                        </Badge>
                      </div>

                      <ProgressBar value={pct} color={status.badge === 'success' ? 'success' : status.badge === 'warning' ? 'warning' : 'primary'} size="sm" />

                      <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                        <span>{setsCount} completed sets</span>
                        <span>Target: 12-16 sets/wk</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB: STRENGTH STANDARDS */}
      {activeTab === 'strength' && (
        <div className="space-y-6 animate-fade-in">
          <Card className="space-y-4">
            <CardHeader>
              <div>
                <CardTitle>
                  <Shield className="w-5 h-5 text-brand-400" />
                  Athletic Strength Classification
                </CardTitle>
                <CardDescription>
                  Evaluates your 1RM personal records against global powerlifting & athletic benchmarks.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-3.5 pt-1">
              {strengthStandards.map((std, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-dark-900/90 border border-dark-700/80 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-100">{std.name}</h3>
                      <div className="text-xs text-zinc-400 font-mono mt-0.5">
                        Current Best: <span className="text-white font-bold">{std.best1RM > 0 ? `${std.best1RM} kg` : 'Not logged'}</span>
                      </div>
                    </div>

                    <Badge variant={std.badgeColor} size="md">
                      {std.level}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <ProgressBar value={std.progressPct} color="gradient" size="sm" />
                    <div className="flex justify-between text-[10px] text-zinc-500 font-mono pt-0.5">
                      <span>Beg ({std.beginner}kg)</span>
                      <span>Nov ({std.intermediate}kg)</span>
                      <span>Adv ({std.advanced}kg)</span>
                      <span>Elite ({std.elite}kg)</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB: PRS HALL OF FAME */}
      {activeTab === 'prs' && (
        <div className="space-y-6 animate-fade-in">
          {/* Muscle Filters */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {MUSCLE_FILTER.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setSelectedMuscle(filter.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedMuscle === filter.id
                    ? 'bg-brand-500 text-dark-950 shadow-md shadow-brand-500/20'
                    : 'bg-dark-800 text-zinc-400 hover:text-zinc-200 border border-dark-700'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* PR Groups Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRecordGroups.map((group) => (
              <Card
                key={group.exercise_id}
                isHoverable
                className="space-y-4 hover:border-brand-500/40"
              >
                <div className="flex items-center justify-between border-b border-dark-700/70 pb-3">
                  <div className="flex items-center gap-2.5">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    <h3 className="text-sm font-black text-white">{group.exercise_name}</h3>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-dark-900/80 border border-dark-700/60 space-y-1">
                    <div className="text-[11px] text-zinc-400 font-medium">Heaviest Weight</div>
                    <div className="text-base font-bold text-blue-400 font-mono">
                      {group.best_weight_kg ? formatWeight(group.best_weight_kg, unitPref) : '—'}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-dark-900/80 border border-dark-700/60 space-y-1">
                    <div className="text-[11px] text-zinc-400 font-medium">Best Est. 1RM</div>
                    <div className="text-base font-bold text-amber-400 font-mono">
                      {group.best_e1rm_kg ? formatWeight(group.best_e1rm_kg, unitPref) : '—'}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-dark-900/80 border border-dark-700/60 space-y-1">
                    <div className="text-[11px] text-zinc-400 font-medium">Max Set Volume</div>
                    <div className="text-base font-bold text-emerald-400 font-mono">
                      {group.max_volume_set_kg ? formatWeight(group.max_volume_set_kg, unitPref) : '—'}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-dark-900/80 border border-dark-700/60 space-y-1">
                    <div className="text-[11px] text-zinc-400 font-medium">Max Reps in Set</div>
                    <div className="text-base font-bold text-purple-400 font-mono">
                      {group.max_reps ? `${group.max_reps} reps` : '—'}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB: 1RM PERCENTAGE CALCULATOR */}
      {activeTab === 'calculator' && (
        <div className="space-y-6 animate-fade-in">
          <Card className="space-y-6">
            <CardHeader>
              <div>
                <CardTitle>
                  <Calculator className="w-5 h-5 text-brand-400" />
                  One-Rep Max & Working Percentages Calculator
                </CardTitle>
                <CardDescription>
                  Enter your lift and reps to calculate theoretical 1RM and customized working loads for your training blocks.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label={`Weight Lifted (${unitPref.toUpperCase()})`}
                  type="number"
                  value={calcWeight}
                  onChange={(e) => setCalcWeight(Number(e.target.value))}
                  className="font-mono text-base font-bold text-brand-400"
                />

                <Input
                  label="Reps Completed"
                  type="number"
                  value={calcReps}
                  onChange={(e) => setCalcReps(Number(e.target.value))}
                  className="font-mono text-base font-bold text-blue-400"
                />

                <div className="p-4 rounded-2xl bg-gradient-to-br from-dark-900 to-brand-950/40 border border-brand-500/30 flex flex-col justify-center items-center">
                  <div className="text-[11px] text-zinc-400 uppercase font-bold">Estimated 1RM</div>
                  <div className="text-2xl font-black text-brand-400 font-mono">
                    {formatWeight(calculated1RM, unitPref)}
                  </div>
                </div>
              </div>

              {/* Percentage Table */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Working Load Percentages Matrix
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {percentageTable.map((item) => (
                    <div
                      key={item.percentage}
                      className="p-3.5 rounded-xl bg-dark-900/80 border border-dark-750 flex flex-col justify-between space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-zinc-300">{item.percentage}%</span>
                        <span className="text-[10px] text-zinc-500 font-mono">{item.repsGoal}</span>
                      </div>
                      <div className="text-sm font-black text-brand-400 font-mono">
                        {formatWeight(item.weightKg, unitPref)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
