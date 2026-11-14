import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Calendar as CalendarIcon,
  Shield,
  Scale,
  PieChart,
  ChevronRight,
  Calculator,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Input } from '../../../shared/ui/input.tsx';
import { Tabs } from '../../../shared/ui/tabs.tsx';
import { ProgressBar } from '../../../shared/ui/progress.tsx';
import { formatWeight, kgToLb } from '../../../shared/lib/units.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { Exercise } from '../../../entities/exercise/model/types.ts';
import { WorkoutHistoryItem } from '../../../entities/workout/model/types.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { usePageSEO } from '../../../shared/lib/seo/usePageSEO.ts';
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
  usePageSEO({ pageKey: 'progress', canonicalPath: '/progress' });
  const navigate = useNavigate();
  const unitPref = useAuthStore((s) => s.unitPreference);
  const { t, language } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>('progression');
  const [selectedMuscle, setSelectedMuscle] = useState('all');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);

  // 1RM Calculator state
  const [calcWeight, setCalcWeight] = useState<number>(100);
  const [calcReps, setCalcReps] = useState<number>(5);
  const [calcFormula, setCalcFormula] = useState<'brzycki' | 'epley'>('brzycki');

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
        noMuscleRecords: 'Нет записей для выбранной группы мышц.',
        historyCardTitle: 'История тренировок',
        historyCardDesc: 'Календарь прошлых сессий, повторы и подходы',
        bodyCardTitle: 'Замеры тела и вес',
        bodyCardDesc: 'График веса, расчёт ИМТ и обхваты тела',
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
        noMuscleRecords: 'Tanlangan mushak guruhi bo‘yicha yozuvlar yo‘q.',
        historyCardTitle: 'Mashg‘ulotlar tarixi',
        historyCardDesc: 'O‘tgan mashg‘ulotlar taqvimi, takrorlar va setlar',
        bodyCardTitle: 'Tana o‘lchamlari va vazn',
        bodyCardDesc: 'Vazn grafigi, BMI hisoblash va tana aylanasi',
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
      noMuscleRecords: 'No records for the selected muscle group.',
      historyCardTitle: 'Workout History',
      historyCardDesc: 'Past workout calendar, sets, and rep logs',
      bodyCardTitle: 'Body Metrics & Weight',
      bodyCardDesc: 'Weight trend, BMI calculation, and body measurements',
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

  // 1RM calculations based on Brzycki or Epley formula
  const brzycki1RM = useMemo(() => {
    if (calcReps <= 1 || calcWeight <= 0) return calcWeight;
    const brzycki = calcWeight * (36 / (37 - Math.min(calcReps, 36)));
    return Math.round(brzycki * 10) / 10;
  }, [calcWeight, calcReps]);

  const epley1RM = useMemo(() => {
    if (calcReps <= 1 || calcWeight <= 0) return calcWeight;
    const epley = calcWeight * (1 + calcReps / 30);
    return Math.round(epley * 10) / 10;
  }, [calcWeight, calcReps]);

  const calculated1RM = calcFormula === 'epley' ? epley1RM : brzycki1RM;

  const percentageTable = useMemo(() => {
    const percentages = [50, 60, 70, 80, 90, 95, 100];
    return percentages.map((pct) => ({
      percentage: pct,
      weightKg: Math.round(((calculated1RM * pct) / 100) * 10) / 10,
      repsGoal:
        pct === 100 ? '1' :
        pct === 95 ? '2' :
        pct === 90 ? '3–4' :
        pct === 80 ? '7–8' :
        pct === 70 ? '11–12' :
        pct === 60 ? '15+' : '20+',
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
      { id: 'progression', label: t('progress.tabProgression'), icon: <TrendingUp className="w-3.5 h-3.5" /> },
      { id: 'volume', label: t('progress.tabVolume'), icon: <PieChart className="w-3.5 h-3.5" /> },
      { id: 'standards', label: t('progress.tabStandards'), icon: <Shield className="w-3.5 h-3.5" /> },
    ],
    [t]
  );

  const formattedTonnage = useMemo(() => {
    if (unitPref === 'lb') {
      const lbs = kgToLb(analyticsSummary.totalTonnageKg);
      return lbs >= 2000 ? `${(lbs / 2000).toFixed(1)} t` : `${Math.round(lbs)} lb`;
    }
    if (analyticsSummary.totalTonnageKg >= 1000) {
      return `${(analyticsSummary.totalTonnageKg / 1000).toFixed(1)} ${language === 'ru' ? 'т' : 't'}`;
    }
    return `${analyticsSummary.totalTonnageKg.toFixed(0)} kg`;
  }, [analyticsSummary.totalTonnageKg, unitPref, language]);

  return (
    <div className="space-y-6 pb-10">
      {/* Page Header & Tab Bar */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#fafafa] tracking-[-0.02em] leading-tight">
            {labels.title}
          </h1>
          <p className="text-[14px] text-[#a3a3a3] mt-1">{t('progress.subtitle')}</p>
        </div>

        <Tabs
          tabs={navTabs}
          selectedKey={activeTab}
          onSelectionChange={setActiveTab}
          size="md"
        />
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#171717] border border-[#404040] rounded-[14px] p-5 flex flex-col justify-between gap-1.5">
          <div className="text-[24px] sm:text-[26px] font-bold text-[#fafafa] font-mono tabular-nums leading-none">
            {analyticsSummary.totalWorkouts}
          </div>
          <div className="text-[12px] text-[#a3a3a3] font-medium">{labels.totalWorkouts}</div>
        </div>

        <div className="bg-[#171717] border border-[#404040] rounded-[14px] p-5 flex flex-col justify-between gap-1.5">
          <div className="text-[24px] sm:text-[26px] font-bold text-[#34d399] font-mono tabular-nums leading-none">
            {formattedTonnage}
          </div>
          <div className="text-[12px] text-[#a3a3a3] font-medium">{labels.totalTonnage}</div>
        </div>

        <div className="bg-[#171717] border border-[#404040] rounded-[14px] p-5 flex flex-col justify-between gap-1.5">
          <div className="text-[24px] sm:text-[26px] font-bold text-[#fafafa] font-mono tabular-nums leading-none">
            {analyticsSummary.totalPRs}
          </div>
          <div className="text-[12px] text-[#a3a3a3] font-medium">{labels.personalRecords}</div>
        </div>

        <div className="bg-[#171717] border border-[#404040] rounded-[14px] p-5 flex flex-col justify-between gap-1.5">
          <div className="text-[24px] sm:text-[26px] font-bold text-[#fafafa] font-mono tabular-nums leading-none">
            {analyticsSummary.totalHours} {labels.hrs}
          </div>
          <div className="text-[12px] text-[#a3a3a3] font-medium">{labels.timeUnderLoad}</div>
        </div>
      </div>

      {/* TAB 1: PROGRESSION & PERSONAL RECORDS */}
      {activeTab === 'progression' && (
        <div className="space-y-5">
          {/* Exercise Progression Curve Card */}
          <div className="bg-[#171717] border border-[#404040] rounded-[14px] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#262626]">
              <div>
                <h2 className="text-[16px] font-semibold text-[#fafafa]">{labels.progressionTitle}</h2>
                <p className="text-[12px] text-[#a3a3a3] mt-0.5">{labels.progressionDesc}</p>
              </div>

              <select
                value={activeExerciseId}
                onChange={(e) => setSelectedExerciseId(e.target.value)}
                className="min-h-[44px] bg-[#0a0a0a] border border-[#404040] text-[#fafafa] text-[13px] font-medium rounded-[10px] px-3.5 focus:outline-none focus:border-[#34d399] max-w-xs cursor-pointer"
              >
                {exercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
            </div>

            {historyData?.data_points && historyData.data_points.length > 0 ? (
              <ExerciseProgressionChart
                dataPoints={historyData.data_points}
                exerciseName={activeExerciseName}
                unitPref={unitPref}
              />
            ) : (
              <div className="bg-[#0a0a0a] border border-dashed border-[#404040] rounded-[12px] py-10 text-center text-[13px] text-[#a3a3a3]">
                {labels.noHistoryData}
              </div>
            )}
          </div>

          {/* Personal Records Table */}
          <div className="bg-[#171717] border border-[#404040] rounded-[14px] p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#262626]">
              <h2 className="text-[16px] font-semibold text-[#fafafa]">
                {labels.prHallTitle}{' '}
                <span className="text-[#a3a3a3] font-mono font-normal">
                  ({filteredRecordGroups.length})
                </span>
              </h2>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {muscleFilters.map((filter) => {
                  const isActive = selectedMuscle === filter.id;
                  return (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setSelectedMuscle(filter.id)}
                      className={`min-h-[44px] px-3 rounded-[10px] border text-[12px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#022c22] border-[#064e3b] text-[#34d399]'
                          : 'bg-[#0a0a0a] border-[#404040] text-[#a3a3a3] hover:text-[#fafafa]'
                      }`}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {filteredRecordGroups.length === 0 ? (
              <div className="text-center py-8 text-[#a3a3a3] text-[13px]">
                {t('progress.noMuscleRecords')}
              </div>
            ) : (
              <>
                {/* Desktop Clean Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#262626] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#a3a3a3]">
                        <th className="pb-3 pr-4">{labels.progressionTitle.split(' ')[0]}</th>
                        <th className="pb-3 px-4">{labels.heaviestWeight}</th>
                        <th className="pb-3 px-4">{labels.bestE1rm}</th>
                        <th className="pb-3 px-4">{labels.maxSetVolume}</th>
                        <th className="pb-3 pl-4 text-right">{labels.maxReps}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#262626] text-[13px]">
                      {filteredRecordGroups.map((group) => (
                        <tr
                          key={group.exercise_id}
                          onClick={() => setSelectedExerciseId(group.exercise_id)}
                          className="hover:bg-[#0a0a0a]/60 transition-colors cursor-pointer"
                        >
                          <td className="py-3.5 pr-4 font-semibold text-[#fafafa]">
                            {group.exercise_name}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-[#34d399] tabular-nums">
                            {group.best_weight_kg ? formatWeight(group.best_weight_kg, unitPref) : '—'}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[#fafafa] tabular-nums">
                            {group.best_e1rm_kg
                              ? formatWeight(Math.round(group.best_e1rm_kg * 10) / 10, unitPref)
                              : '—'}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[#a3a3a3] tabular-nums">
                            {group.max_volume_set_kg
                              ? formatWeight(group.max_volume_set_kg, unitPref)
                              : '—'}
                          </td>
                          <td className="py-3.5 pl-4 text-right font-mono text-[#a3a3a3] tabular-nums">
                            {group.max_reps ? `${group.max_reps} ${labels.repsUnit}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-2.5">
                  {filteredRecordGroups.map((group) => (
                    <div
                      key={group.exercise_id}
                      onClick={() => setSelectedExerciseId(group.exercise_id)}
                      className="p-4 rounded-[12px] bg-[#0a0a0a] border border-[#262626] space-y-3 cursor-pointer"
                    >
                      <div className="text-[14px] font-semibold text-[#fafafa]">
                        {group.exercise_name}
                      </div>
                      <div className="grid grid-cols-2 gap-2.5 text-[12px]">
                        <div>
                          <div className="text-[#a3a3a3] text-[11px]">{labels.heaviestWeight}</div>
                          <div className="font-mono font-bold text-[#34d399] mt-0.5">
                            {group.best_weight_kg ? formatWeight(group.best_weight_kg, unitPref) : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[#a3a3a3] text-[11px]">{labels.bestE1rm}</div>
                          <div className="font-mono text-[#fafafa] mt-0.5">
                            {group.best_e1rm_kg
                              ? formatWeight(Math.round(group.best_e1rm_kg * 10) / 10, unitPref)
                              : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[#a3a3a3] text-[11px]">{labels.maxSetVolume}</div>
                          <div className="font-mono text-[#a3a3a3] mt-0.5">
                            {group.max_volume_set_kg
                              ? formatWeight(group.max_volume_set_kg, unitPref)
                              : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[#a3a3a3] text-[11px]">{labels.maxReps}</div>
                          <div className="font-mono text-[#a3a3a3] mt-0.5">
                            {group.max_reps ? `${group.max_reps} ${labels.repsUnit}` : '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: VOLUME & MUSCLE BALANCE */}
      {activeTab === 'volume' && (
        <div className="space-y-5">
          <MuscleBalanceRadarChart muscleSets={analyticsSummary.muscleSets} />
          <TonnageVolumeHistoryChart workouts={workouts} unitPref={unitPref} />
        </div>
      )}

      {/* TAB 3: 1RM CALCULATOR & STRENGTH STANDARDS */}
      {activeTab === 'standards' && (
        <div className="space-y-5">
          {/* 1RM & Working Percentages Card */}
          <div className="bg-[#171717] border border-[#404040] rounded-[14px] p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#262626]">
              <div>
                <h2 className="text-[16px] font-semibold text-[#fafafa] flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-[#34d399]" />
                  <span>{labels.calcTitle}</span>
                </h2>
                <p className="text-[12px] text-[#a3a3a3] mt-0.5">{labels.calcDesc}</p>
              </div>

              <div className="flex items-center gap-1 p-1 bg-[#0a0a0a] border border-[#404040] rounded-[10px] self-start">
                <button
                  type="button"
                  onClick={() => setCalcFormula('brzycki')}
                  className={`px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-colors cursor-pointer ${
                    calcFormula === 'brzycki'
                      ? 'bg-[#022c22] text-[#34d399] border border-[#064e3b]'
                      : 'text-[#a3a3a3] hover:text-[#fafafa]'
                  }`}
                >
                  Brzycki
                </button>
                <button
                  type="button"
                  onClick={() => setCalcFormula('epley')}
                  className={`px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-colors cursor-pointer ${
                    calcFormula === 'epley'
                      ? 'bg-[#022c22] text-[#34d399] border border-[#064e3b]'
                      : 'text-[#a3a3a3] hover:text-[#fafafa]'
                  }`}
                >
                  Epley
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_240px] gap-4 items-stretch">
              <Input
                label={`${labels.weightLifted} (${unitPref.toUpperCase()})`}
                type="number"
                value={calcWeight}
                onChange={(e) => setCalcWeight(Number(e.target.value))}
                className="font-mono text-[16px] font-bold text-[#fafafa]"
              />

              <Input
                label={labels.repsCompleted}
                type="number"
                value={calcReps}
                onChange={(e) => setCalcReps(Number(e.target.value))}
                className="font-mono text-[16px] font-bold text-[#fafafa]"
              />

              <div className="p-4 rounded-[12px] bg-[#022c22]/50 border border-[#064e3b] flex flex-col justify-center items-center text-center">
                <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#a3a3a3]">
                  {labels.estimated1RM}
                </div>
                <div className="text-[26px] font-bold text-[#34d399] font-mono tabular-nums mt-1">
                  {formatWeight(calculated1RM, unitPref)}
                </div>
                <div className="text-[11px] font-mono text-[#a3a3a3] mt-1">
                  {calcFormula === 'brzycki'
                    ? `Epley: ${formatWeight(epley1RM, unitPref)}`
                    : `Brzycki: ${formatWeight(brzycki1RM, unitPref)}`}
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#a3a3a3]">
                {labels.workingMatrix}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                {percentageTable.map((item) => (
                  <div
                    key={item.percentage}
                    className="p-3 rounded-[10px] bg-[#0a0a0a] border border-[#262626] flex flex-col justify-between gap-1"
                  >
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="font-semibold text-[#fafafa]">{item.percentage}%</span>
                      <span className="text-[10px] text-[#737373] font-mono">
                        {item.repsGoal} {labels.repsUnit}
                      </span>
                    </div>
                    <div className="text-[14px] font-bold text-[#34d399] font-mono tabular-nums">
                      {formatWeight(item.weightKg, unitPref)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <StrengthStandardsBarChart standards={strengthStandards} unitPref={unitPref} />

          {/* Strength Standards Classification Rows */}
          <div className="bg-[#171717] border border-[#404040] rounded-[14px] p-5 space-y-4">
            <div className="pb-3 border-b border-[#262626]">
              <h2 className="text-[16px] font-semibold text-[#fafafa]">{labels.standardsTitle}</h2>
              <p className="text-[12px] text-[#a3a3a3] mt-0.5">{labels.standardsDesc}</p>
            </div>

            <div className="space-y-3">
              {strengthStandards.map((std, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-[12px] bg-[#0a0a0a] border border-[#262626] space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#fafafa]">{std.name}</h3>
                      <div className="text-[12px] text-[#a3a3a3] font-mono mt-0.5">
                        {labels.currentBest}{' '}
                        <span className="text-[#34d399] font-semibold">
                          {std.best1RM > 0 ? formatWeight(std.best1RM, unitPref) : labels.notLogged}
                        </span>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-[8px] bg-[#022c22] border border-[#064e3b] text-[#34d399] text-[12px] font-medium self-start sm:self-center">
                      {std.level}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <ProgressBar value={std.progressPct} color="brand" size="sm" />
                    <div className="flex justify-between text-[11px] text-[#737373] font-mono">
                      <span>01 Beg ({std.beginner}kg)</span>
                      <span>02 Nov ({std.intermediate}kg)</span>
                      <span>03 Adv ({std.advanced}kg)</span>
                      <span>04 Elite ({std.elite}kg)</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Strip */}
      <div className="pt-4 border-t border-[#262626] grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => navigate('/history')}
          className="min-h-[60px] p-4 rounded-[14px] bg-[#171717] hover:bg-[#262626]/70 border border-[#404040] flex items-center justify-between text-left cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-[10px] bg-[#022c22] border border-[#064e3b] flex items-center justify-center text-[#34d399] shrink-0">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-[#fafafa] truncate">
                {t('progress.backToHistory')}
              </div>
              <div className="text-[12px] text-[#a3a3a3] truncate">
                {t('progress.historyCardDesc')}
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#a3a3a3] shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => navigate('/body')}
          className="min-h-[60px] p-4 rounded-[14px] bg-[#171717] hover:bg-[#262626]/70 border border-[#404040] flex items-center justify-between text-left cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-[10px] bg-[#0a0a0a] border border-[#404040] flex items-center justify-center text-[#fafafa] shrink-0">
              <Scale className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-[#fafafa] truncate">
                {t('progress.toBodyMetrics')}
              </div>
              <div className="text-[12px] text-[#a3a3a3] truncate">
                {t('progress.bodyCardDesc')}
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#a3a3a3] shrink-0" />
        </button>
      </div>
    </div>
  );
};
export default ProgressPage;
