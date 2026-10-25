import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trophy,
  TrendingUp,
  Dumbbell,
  Flame,
  Calculator,
  Calendar as CalendarIcon,
  Activity,
  BarChart3,
  Shield,
  Scale,
  PieChart,
  ChevronRight,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Button } from '../../../shared/ui/button.tsx';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '../../../shared/ui/card.tsx';
import { Input } from '../../../shared/ui/input.tsx';
import { Tabs } from '../../../shared/ui/tabs.tsx';
import { ProgressBar } from '../../../shared/ui/progress.tsx';
import { formatWeight } from '../../../shared/lib/units.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { Exercise } from '../../../entities/exercise/model/types.ts';
import { WorkoutHistoryItem } from '../../../entities/workout/model/types.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import {
  ExerciseProgressionChart,
  MuscleBalanceRadarChart,
  TonnageVolumeHistoryChart,
  StrengthStandardsBarChart,
} from '../../../features/progress-charts/index.ts';

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

export const ProgressPage: React.FC = () => {
  const navigate = useNavigate();
  const unitPref = useAuthStore((s) => s.unitPreference);
  const { language } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>('progression');
  const [selectedMuscle, setSelectedMuscle] = useState('all');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);

  // 1RM Calculator state
  const [calcWeight, setCalcWeight] = useState<number>(100);
  const [calcReps, setCalcReps] = useState<number>(5);

  const labels = useMemo(() => {
    if (language === 'ru') {
      return {
        title: 'Прогресс и аналитика',
        subtitle: 'Динамика силы, персональные рекорды и баланс мышечной нагрузки',
        tabProgression: 'Прогрессия & PR',
        tabVolume: 'Баланс & Тоннаж',
        tabStandards: '1RM & Стандарты',
        totalWorkouts: 'Тренировки',
        totalTonnage: 'Общий тоннаж',
        personalRecords: 'Личные рекорды',
        timeUnderLoad: 'Время под нагрузкой',
        hrs: 'ч',
        progressionTitle: 'Прогрессия рабочих весов и 1RM',
        progressionDesc: 'Динамика лучшего веса в подходах по выбранному упражнению.',
        noHistoryData: 'Пока нет записей по этому упражнению. Завершите тренировку, чтобы построить график.',
        prHallTitle: 'Личные рекорды (PR)',
        heaviestWeight: 'Макс. вес',
        bestE1rm: 'Расчётный 1RM',
        maxSetVolume: 'Макс. объём сета',
        maxReps: 'Макс. повторений',
        repsUnit: 'повт.',
        muscleVolumeTitle: 'Объём по мышечным группам',
        muscleVolumeDesc: 'Количество рабочих подходов относительно ориентира гипертрофии (10–20 сетов).',
        completedSets: 'сетов выполнено',
        targetSets: 'Цель: 12–16 сетов',
        statusOptimal: 'Оптимум (MEV–MRV)',
        statusHigh: 'Высокая нагрузка',
        statusMaint: 'Поддержка (MV)',
        statusUntrained: 'Без нагрузки',
        calcTitle: 'Калькулятор 1RM и рабочих процентов',
        calcDesc: 'Формула Бжицки для расчёта одноповторного максимума и весов по зонам интенсивности.',
        weightLifted: 'Вес снаряда',
        repsCompleted: 'Повторения',
        estimated1RM: 'Расчётный 1RM',
        workingMatrix: 'Таблица рабочих весов (% от 1RM)',
        standardsTitle: 'Силовые стандарты',
        standardsDesc: 'Сравнение ваших рекордов 1RM с классификацией силовых атлетов.',
        currentBest: 'Лучший 1RM:',
        notLogged: 'Нет данных',
        allMuscles: 'Все мышцы',
        chest: 'Грудь',
        back: 'Спина',
        legs: 'Ноги',
        shoulders: 'Плечи',
        arms: 'Руки',
        core: 'Пресс',
      };
    }
    if (language === 'uz') {
      return {
        title: 'Progress va tahlil',
        subtitle: 'Kuch dinamikasi, shaxsiy rekordlar va yuklama balansi',
        tabProgression: 'Progressiya & PR',
        tabVolume: 'Balans & Tonnaj',
        tabStandards: '1RM & Standartlar',
        totalWorkouts: 'Mashg‘ulotlar',
        totalTonnage: 'Umumiy tonnaj',
        personalRecords: 'Shaxsiy rekordlar',
        timeUnderLoad: 'Yuklama vaqti',
        hrs: 'soat',
        progressionTitle: 'Ishchi vazn va 1RM progressiyasi',
        progressionDesc: 'Tanlangan mashq bo‘yicha eng yaxshi vazn dinamikasi.',
        noHistoryData: 'Ushbu mashq bo‘yicha hali ma’lumot yo‘q.',
        prHallTitle: 'Shaxsiy rekordlar (PR)',
        heaviestWeight: 'Maks. vazn',
        bestE1rm: 'Hisoblangan 1RM',
        maxSetVolume: 'Maks. set hajmi',
        maxReps: 'Maks. takrorlar',
        repsUnit: 'marta',
        muscleVolumeTitle: 'Mushak guruhlari bo‘yicha hajm',
        muscleVolumeDesc: 'Optimal gipertrofiya me’yori (10–20 set) bo‘yicha bajarilgan setlar.',
        completedSets: 'set bajarildi',
        targetSets: 'Maqsad: 12–16 set',
        statusOptimal: 'Optimal (MEV–MRV)',
        statusHigh: 'Yuqori yuklama',
        statusMaint: 'Ushlab turish (MV)',
        statusUntrained: 'Ishlanmagan',
        calcTitle: '1RM va ishchi foizlar kalkulyatori',
        calcDesc: 'Brzycki formulasi bo‘yicha 1RM va ishchi vaznlarni hisoblash.',
        weightLifted: 'Ko‘tarilgan vazn',
        repsCompleted: 'Takrorlar soni',
        estimated1RM: 'Hisoblangan 1RM',
        workingMatrix: 'Ishchi vaznlar jadvali (% 1RM)',
        standardsTitle: 'Kuch standartlari',
        standardsDesc: '1RM rekordlaringizni sport standartlari bilan solishtirish.',
        currentBest: 'Eng yaxshi 1RM:',
        notLogged: 'Ma’lumot yo‘q',
        allMuscles: 'Barchasi',
        chest: 'Ko‘krak',
        back: 'Orqa',
        legs: 'Oyoqlar',
        shoulders: 'Yelka',
        arms: 'Qo‘llar',
        core: 'Press',
      };
    }
    return {
      title: 'Progress & Analytics',
      subtitle: 'Strength milestones, personal records, and muscle load balance',
      tabProgression: 'Progression & PRs',
      tabVolume: 'Balance & Tonnage',
      tabStandards: '1RM & Standards',
      totalWorkouts: 'Workouts',
      totalTonnage: 'Total Tonnage',
      personalRecords: 'Personal Records',
      timeUnderLoad: 'Time Under Load',
      hrs: 'hrs',
      progressionTitle: 'Strength & Weight Progression',
      progressionDesc: 'Track 1RM and working weight milestones over time for any movement.',
      noHistoryData: 'No historical logs recorded yet for this exercise.',
      prHallTitle: 'Personal Records (PRs)',
      heaviestWeight: 'Heaviest Weight',
      bestE1rm: 'Best Est. 1RM',
      maxSetVolume: 'Max Set Volume',
      maxReps: 'Max Reps',
      repsUnit: 'reps',
      muscleVolumeTitle: 'Muscle Volume Distribution',
      muscleVolumeDesc: 'Completed sets compared against hypertrophy benchmarks (10–20 sets).',
      completedSets: 'completed sets',
      targetSets: 'Target: 12–16 sets',
      statusOptimal: 'Optimal (MEV–MRV)',
      statusHigh: 'High Overload',
      statusMaint: 'Maintenance (MV)',
      statusUntrained: 'Untrained',
      calcTitle: '1RM & Working Percentages Calculator',
      calcDesc: 'Calculate theoretical 1RM (Brzycki) and working loads across intensity zones.',
      weightLifted: 'Weight Lifted',
      repsCompleted: 'Reps Completed',
      estimated1RM: 'Estimated 1RM',
      workingMatrix: 'Working Load Percentages (% of 1RM)',
      standardsTitle: 'Athletic Strength Classification',
      standardsDesc: 'Evaluates your 1RM records against global strength benchmarks.',
      currentBest: 'Current Best:',
      notLogged: 'Not logged',
      allMuscles: 'All Muscles',
      chest: 'Chest',
      back: 'Back',
      legs: 'Legs',
      shoulders: 'Shoulders',
      arms: 'Arms',
      core: 'Core',
    };
  }, [language]);

  const muscleFilters = useMemo(
    () => [
      { id: 'all', label: labels.allMuscles },
      { id: 'chest', label: labels.chest },
      { id: 'back', label: labels.back },
      { id: 'legs', label: labels.legs },
      { id: 'shoulders', label: labels.shoulders },
      { id: 'arms', label: labels.arms },
      { id: 'core', label: labels.core },
    ],
    [labels]
  );

  // Fetch all personal records
  const { data: rawRecordGroups } = useQuery<ExerciseRecordGroup[]>({
    queryKey: ['records'],
    queryFn: () => apiClient<ExerciseRecordGroup[]>('/progress/records'),
  });
  const recordGroups = Array.isArray(rawRecordGroups) ? rawRecordGroups : [];

  // Fetch workout history for analytics
  const { data: workoutsData } = useQuery<{ items: WorkoutHistoryItem[] }>({
    queryKey: ['workouts'],
    queryFn: () => apiClient<{ items: WorkoutHistoryItem[] }>('/workouts?limit=100'),
  });
  const workouts = Array.isArray(workoutsData?.items) ? workoutsData.items : [];

  // Fetch exercise catalog for dropdown
  const { data: rawExercises } = useQuery<Exercise[]>({
    queryKey: ['exercises'],
    queryFn: () => apiClient<Exercise[]>('/exercises'),
  });
  const exercises = Array.isArray(rawExercises) ? rawExercises : [];

  const activeExerciseId =
    selectedExerciseId || (recordGroups[0]?.exercise_id ?? exercises[0]?.id);
  const activeExercise = exercises.find((e) => e.id === activeExerciseId);
  const activeExerciseName = activeExercise?.name || labels.progressionTitle;

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
        pct === 100 ? '1' :
        pct === 95 ? '2' :
        pct === 90 ? '3–4' :
        pct === 85 ? '5–6' :
        pct === 80 ? '7–8' :
        pct === 75 ? '9–10' :
        pct === 70 ? '11–12' : '12–15',
    }));
  }, [calculated1RM]);

  // Filter PR groups by muscle
  const filteredRecordGroups = useMemo(() => {
    if (selectedMuscle === 'all') return recordGroups;
    return recordGroups.filter((g) => {
      const exObj = exercises.find((e) => e.id === g.exercise_id);
      const muscle = (exObj?.primary_muscle_group || exObj?.primary_muscle || '').toLowerCase();
      if (selectedMuscle === 'legs') {
        return muscle === 'legs' || muscle === 'quads' || muscle === 'hamstrings' || muscle === 'calves';
      }
      if (selectedMuscle === 'arms') {
        return muscle === 'arms' || muscle === 'biceps' || muscle === 'triceps';
      }
      return muscle === selectedMuscle.toLowerCase();
    });
  }, [recordGroups, exercises, selectedMuscle]);

  // Overall Athletics Analytics summary
  const analyticsSummary = useMemo(() => {
    let totalTonnage = 0;
    let totalSets = 0;
    let totalSecs = 0;

    const muscleSets: Record<string, number> = {
      [labels.chest]: 0,
      [labels.back]: 0,
      [labels.legs]: 0,
      [labels.shoulders]: 0,
      [labels.arms]: 0,
      [labels.core]: 0,
    };

    for (const w of workouts) {
      totalTonnage += w.total_volume_kg || 0;
      totalSets += w.completed_sets_count || 0;
      totalSecs += w.duration_seconds || 0;

      for (const ex of w.exercises || []) {
        const name = (ex.exercise_name || '').toLowerCase();
        let group = labels.chest;
        if (name.includes('bench') || name.includes('chest') || name.includes('dip') || name.includes('fly') || name.includes('жим')) group = labels.chest;
        else if (name.includes('pull') || name.includes('row') || name.includes('lat') || name.includes('deadlift') || name.includes('тяга') || name.includes('подтяг')) group = labels.back;
        else if (name.includes('squat') || name.includes('leg') || name.includes('lunge') || name.includes('calf') || name.includes('присед')) group = labels.legs;
        else if (name.includes('press') || name.includes('raise') || name.includes('shoulder') || name.includes('delt') || name.includes('мах')) group = labels.shoulders;
        else if (name.includes('curl') || name.includes('tricep') || name.includes('bicep') || name.includes('extension') || name.includes('бицепс') || name.includes('трицепс')) group = labels.arms;
        else if (name.includes('crunch') || name.includes('plank') || name.includes('ab') || name.includes('core') || name.includes('пресс') || name.includes('планк')) group = labels.core;

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
  }, [workouts, recordGroups, labels]);

  // Strength Standards
  const strengthStandards = useMemo(() => {
    const targets = [
      { name: 'Barbell Bench Press', keys: ['bench press', 'жим лежа', 'жим штанги'], beginner: 60, intermediate: 90, advanced: 120, elite: 150 },
      { name: 'Barbell Back Squat', keys: ['squat', 'присед'], beginner: 80, intermediate: 120, advanced: 160, elite: 200 },
      { name: 'Barbell Deadlift', keys: ['deadlift', 'становая'], beginner: 100, intermediate: 140, advanced: 190, elite: 240 },
      { name: 'Overhead Shoulder Press', keys: ['overhead', 'military', 'армейский жим', 'жим стоя'], beginner: 40, intermediate: 60, advanced: 80, elite: 100 },
      { name: 'Weighted Pull-Up', keys: ['pull-up', 'pull up', 'подтягивания'], beginner: 10, intermediate: 25, advanced: 45, elite: 65 },
    ];

    return targets.map((t) => {
      const match = recordGroups.find((g) => {
        const lower = (g.exercise_name || '').toLowerCase();
        return t.keys.some((k) => lower.includes(k));
      });
      const best1RM = match?.best_e1rm_kg || match?.best_weight_kg || 0;

      let level = 'Unranked';
      let progressPct = 0;
      let badgeColor = 'neutral';

      if (best1RM >= t.elite) {
        level = 'Elite';
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
        best1RM: Math.round(best1RM * 10) / 10,
        level,
        progressPct: Math.min(100, Math.max(5, Math.round(progressPct))),
        badgeColor: badgeColor as any,
      };
    });
  }, [recordGroups]);

  // Strictly 3 Focused Analytics Tabs
  const navTabs = useMemo(
    () => [
      { id: 'progression', label: labels.tabProgression, icon: <TrendingUp className="w-3.5 h-3.5" />, badge: recordGroups.length },
      { id: 'volume', label: labels.tabVolume, icon: <PieChart className="w-3.5 h-3.5" /> },
      { id: 'standards', label: labels.tabStandards, icon: <Shield className="w-3.5 h-3.5" /> },
    ],
    [labels, recordGroups.length]
  );

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Page Header with Ready-Made Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-dark-800/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-brand-400" />
            <span>{labels.title}</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {labels.subtitle}
          </p>
        </div>

        <Tabs
          tabs={navTabs}
          selectedKey={activeTab}
          onSelectionChange={setActiveTab}
          size="md"
        />
      </div>

      {/* Top KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3.5 sm:p-4 bg-dark-850/80 border-dark-750/80 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-bold">
            <Dumbbell className="w-3.5 h-3.5 text-brand-400" />
            <span className="truncate">{labels.totalWorkouts}</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono">
            {analyticsSummary.totalWorkouts}
          </div>
        </Card>

        <Card className="p-3.5 sm:p-4 bg-dark-850/80 border-dark-750/80 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-bold">
            <Flame className="w-3.5 h-3.5 text-emerald-400" />
            <span className="truncate">{labels.totalTonnage}</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
            {analyticsSummary.totalTonnageKg > 1000
              ? `${(analyticsSummary.totalTonnageKg / 1000).toFixed(1)} T`
              : `${analyticsSummary.totalTonnageKg.toFixed(0)} kg`}
          </div>
        </Card>

        <Card className="p-3.5 sm:p-4 bg-dark-850/80 border-dark-750/80 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-bold">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span className="truncate">{labels.personalRecords}</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
            {analyticsSummary.totalPRs}
          </div>
        </Card>

        <Card className="p-3.5 sm:p-4 bg-dark-850/80 border-dark-750/80 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-bold">
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            <span className="truncate">{labels.timeUnderLoad}</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-sky-400 font-mono">
            {analyticsSummary.totalHours} {labels.hrs}
          </div>
        </Card>
      </div>

      {/* TAB 1: PROGRESSION & PERSONAL RECORDS */}
      {activeTab === 'progression' && (
        <div className="space-y-6 animate-fade-in">
          {/* Exercise Progression Curve Chart */}
          <Card className="space-y-4">
            <CardHeader>
              <div>
                <CardTitle>
                  <TrendingUp className="w-5 h-5 text-brand-400" />
                  {labels.progressionTitle}
                </CardTitle>
              </div>

              <select
                value={activeExerciseId}
                onChange={(e) => setSelectedExerciseId(e.target.value)}
                className="bg-dark-900 border border-dark-700 text-zinc-200 text-xs rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-brand-500 max-w-xs"
              >
                {exercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
            </CardHeader>

            <CardContent>
              {historyData?.data_points && historyData.data_points.length > 0 ? (
                <ExerciseProgressionChart
                  dataPoints={historyData.data_points}
                  exerciseName={activeExerciseName}
                  unitPref={unitPref}
                />
              ) : (
                <div className="text-center py-10 text-zinc-500 text-xs">
                  {labels.noHistoryData}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Personal Records (PRs Hall of Fame) */}
          <Card className="space-y-4">
            <CardHeader>
              <CardTitle>
                <Trophy className="w-5 h-5 text-amber-400" />
                {labels.prHallTitle} ({filteredRecordGroups.length})
              </CardTitle>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {muscleFilters.map((filter) => (
                  <Button
                    key={filter.id}
                    size="xs"
                    variant={selectedMuscle === filter.id ? 'primary' : 'outline'}
                    onClick={() => setSelectedMuscle(filter.id)}
                    className="whitespace-nowrap font-bold"
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </CardHeader>

            <CardContent>
              {filteredRecordGroups.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-xs">
                  Нет записей для выбранной группы мышц.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredRecordGroups.map((group) => (
                    <Card
                      key={group.exercise_id}
                      isHoverable
                      className="p-4 bg-dark-900/80 border-dark-700/80 hover:border-brand-500/40 space-y-3"
                    >
                      <div className="flex items-center gap-2 border-b border-dark-700/60 pb-2.5">
                        <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                        <h3 className="text-sm font-black text-white truncate">{group.exercise_name}</h3>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Card variant="flat" className="p-2.5 bg-dark-850/80 border-dark-700/50">
                          <div className="text-[10px] text-zinc-400">{labels.heaviestWeight}</div>
                          <div className="text-sm font-bold text-blue-400 font-mono mt-0.5">
                            {group.best_weight_kg ? formatWeight(group.best_weight_kg, unitPref) : '—'}
                          </div>
                        </Card>

                        <Card variant="flat" className="p-2.5 bg-dark-850/80 border-dark-700/50">
                          <div className="text-[10px] text-zinc-400">{labels.bestE1rm}</div>
                          <div className="text-sm font-bold text-amber-400 font-mono mt-0.5">
                            {group.best_e1rm_kg ? formatWeight(Math.round(group.best_e1rm_kg * 10) / 10, unitPref) : '—'}
                          </div>
                        </Card>

                        <Card variant="flat" className="p-2.5 bg-dark-850/80 border-dark-700/50">
                          <div className="text-[10px] text-zinc-400">{labels.maxSetVolume}</div>
                          <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                            {group.max_volume_set_kg ? formatWeight(group.max_volume_set_kg, unitPref) : '—'}
                          </div>
                        </Card>

                        <Card variant="flat" className="p-2.5 bg-dark-850/80 border-dark-700/50">
                          <div className="text-[10px] text-zinc-400">{labels.maxReps}</div>
                          <div className="text-sm font-bold text-purple-400 font-mono mt-0.5">
                            {group.max_reps ? `${group.max_reps} ${labels.repsUnit}` : '—'}
                          </div>
                        </Card>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: VOLUME & MUSCLE BALANCE */}
      {activeTab === 'volume' && (
        <div className="space-y-6 animate-fade-in">
          {/* Muscle Balance Radar Chart */}
          <MuscleBalanceRadarChart muscleSets={analyticsSummary.muscleSets} />

          {/* Overall Tonnage & Workload Volume History Chart */}
          <TonnageVolumeHistoryChart workouts={workouts} unitPref={unitPref} />
        </div>
      )}

      {/* TAB 3: 1RM CALCULATOR & STRENGTH STANDARDS */}
      {activeTab === 'standards' && (
        <div className="space-y-6 animate-fade-in">
          {/* 1RM Calculator */}
          <Card className="space-y-5">
            <CardHeader>
              <div>
                <CardTitle>
                  <Calculator className="w-5 h-5 text-brand-400" />
                  {labels.calcTitle}
                </CardTitle>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label={`${labels.weightLifted} (${unitPref.toUpperCase()})`}
                  type="number"
                  value={calcWeight}
                  onChange={(e) => setCalcWeight(Number(e.target.value))}
                  className="font-mono text-base font-bold text-brand-400"
                />

                <Input
                  label={labels.repsCompleted}
                  type="number"
                  value={calcReps}
                  onChange={(e) => setCalcReps(Number(e.target.value))}
                  className="font-mono text-base font-bold text-blue-400"
                />

                <Card variant="glow" className="p-4 bg-gradient-to-br from-dark-900 to-brand-950/40 border-brand-500/30 flex flex-col justify-center items-center">
                  <div className="text-[11px] text-zinc-400 uppercase font-bold">{labels.estimated1RM}</div>
                  <div className="text-2xl font-black text-brand-400 font-mono">
                    {formatWeight(calculated1RM, unitPref)}
                  </div>
                </Card>
              </div>

              <div className="space-y-2.5">
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  {labels.workingMatrix}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {percentageTable.map((item) => (
                    <Card
                      variant="flat"
                      key={item.percentage}
                      className="p-3 bg-dark-900/80 border-dark-750 flex flex-col justify-between space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-zinc-300">{item.percentage}%</span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {item.repsGoal} {labels.repsUnit}
                        </span>
                      </div>
                      <div className="text-sm font-black text-brand-400 font-mono">
                        {formatWeight(item.weightKg, unitPref)}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Athletic Strength Standards Horizontal Benchmark */}
          <StrengthStandardsBarChart standards={strengthStandards} unitPref={unitPref} />

          {/* Athletic Strength Classification */}
          <Card className="space-y-4">
            <CardHeader>
              <div>
                <CardTitle>
                  <Shield className="w-5 h-5 text-brand-400" />
                  {labels.standardsTitle}
                </CardTitle>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 pt-1">
              {strengthStandards.map((std, idx) => (
                <Card
                  key={idx}
                  className="p-4 bg-dark-900/90 border-dark-700/80 space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-100">{std.name}</h3>
                      <div className="text-xs text-zinc-400 font-mono mt-0.5">
                        {labels.currentBest}{' '}
                        <span className="text-white font-bold">
                          {std.best1RM > 0 ? `${std.best1RM} kg` : labels.notLogged}
                        </span>
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
                </Card>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dedicated Navigation Cards */}
      <div className="pt-2 border-t border-dark-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card
          isHoverable
          onClick={() => navigate('/history')}
          className="p-3.5 bg-dark-850/60 hover:bg-dark-800 border-dark-750 hover:border-brand-500/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 shrink-0">
                <CalendarIcon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-brand-400 transition-colors">
                  История тренировок
                </div>
                <div className="text-[11px] text-zinc-400">
                  Календарь прошлых сессий, повторы и подходы
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
          </div>
        </Card>

        <Card
          isHoverable
          onClick={() => navigate('/body')}
          className="p-3.5 bg-dark-850/60 hover:bg-dark-800 border-dark-750 hover:border-brand-500/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                <Scale className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors">
                  Замеры тела и вес
                </div>
                <div className="text-[11px] text-zinc-400">
                  График веса, расчёт ИМТ и обхваты тела
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
          </div>
        </Card>
      </div>
    </div>
  );
};
export default ProgressPage;
