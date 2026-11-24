import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bot,
  Calendar,
  CalendarCheck,
  Copy,
  Dumbbell,
  Flame,
  FolderKanban,
  NotebookPen,
  Pencil,
  Play,
  Plus,
  Scale,
  Search,
  Sparkles,
  Trash2,
  Utensils,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { ExerciseThumbnail } from '../../../entities/exercise/ui/ExerciseThumbnail.tsx';
import { Button } from '../../../shared/ui/button.tsx';
import { Card } from '../../../shared/ui/card.tsx';
import { Input } from '../../../shared/ui/input.tsx';
import { EmptyStateCard, LoadingStateCard } from '../../../shared/ui/SystemState.tsx';
import { RoutineEditorModal } from '../../../features/routine-builder/ui/RoutineEditorModal.tsx';
import { RoutineDetailModal } from '../../../features/routine-preview/ui/RoutineDetailModal.tsx';
import { ProgramDetailModal } from '../../../features/program-preview/ui/ProgramDetailModal.tsx';
import { useStartWorkout } from '../../../features/start-workout/model/useStartWorkout.ts';
import { applyProgramOverride } from '../../../entities/program/model/programWorkoutSync.ts';
import { formatWeight } from '../../../shared/lib/units.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { usePageSEO } from '../../../shared/lib/seo/usePageSEO.ts';
import {
  ActiveProgramResponse,
  InstalledProgramItem,
  Program,
  ProgramDay,
} from '../../../entities/program/model/types.ts';

interface RoutineExercise {
  exercise_id: string;
  exercise_name: string;
  order_index: number;
  target_sets: number;
  target_reps_min?: number;
  target_reps_max?: number;
  primary_muscle_group?: string;
}

interface Routine {
  id: string;
  user_id?: string;
  name: string;
  notes?: string;
  exercises: RoutineExercise[];
  created_at: string;
}

interface WorkoutHistorySet {
  set_number?: number;
  weight_kg?: number;
  reps?: number;
  completed?: boolean;
  notes?: string;
}

interface WorkoutHistoryExercise {
  exercise_name?: string;
  notes?: string;
  sets?: WorkoutHistorySet[];
}

interface WorkoutHistoryItem {
  id: string;
  name: string;
  started_at?: string;
  finished_at?: string;
  created_at?: string;
  total_volume_kg?: number;
  notes?: string;
  exercises?: WorkoutHistoryExercise[];
}

interface WorkoutsPageProps {
  onNavigateToPrograms?: () => void;
}

export const WorkoutsPage: React.FC<WorkoutsPageProps> = ({ onNavigateToPrograms }) => {
  usePageSEO({ pageKey: 'workouts', canonicalPath: '/workouts' });
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const unitPref = useAuthStore((s) => s.unitPreference);
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateRoutineOpen, setIsCreateRoutineOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [selectedRoutinePreview, setSelectedRoutinePreview] = useState<Routine | null>(null);
  const [selectedProgramPreview, setSelectedProgramPreview] = useState<Program | null>(null);
  const [selectedProgramDayIndex, setSelectedProgramDayIndex] = useState(0);
  const [isSplitExpanded, setIsSplitExpanded] = useState(false);

  const routineOrderKey = user?.id
    ? `np_my_routines_custom_order_${user.id}`
    : 'np_my_routines_custom_order';

  const readStoredOrder = (storageKey: string): string[] => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const [customRoutineOrder, setCustomRoutineOrder] = useState<string[]>(() =>
    readStoredOrder(routineOrderKey)
  );
  const [isReorderMode, setIsReorderMode] = useState(false);

  useEffect(() => {
    setCustomRoutineOrder(readStoredOrder(routineOrderKey));
  }, [routineOrderKey]);

  const startWorkout = useStartWorkout();

  const handleStartQuickEmptyWorkout = async () => {
    const today = new Date().toLocaleDateString([], { day: 'numeric', month: 'short' });
    await startWorkout({
      name: `${t('workouts.quickWorkoutName') || 'Быстрая тренировка'} (${today})`,
      exercises: [],
    });
  };

  const { data: activeProgramData } = useQuery<ActiveProgramResponse>({
    queryKey: ['programs', 'active'],
    queryFn: () => apiClient<ActiveProgramResponse>('/programs/user/active'),
  });

  const { data: rawInstalledPrograms } = useQuery<InstalledProgramItem[]>({
    queryKey: ['programs', 'installed'],
    queryFn: () => apiClient<InstalledProgramItem[]>('/programs/user/installed'),
  });
  const installedPrograms = Array.isArray(rawInstalledPrograms) ? rawInstalledPrograms : [];

  const { data: rawRoutines, isLoading: isRoutinesLoading } = useQuery<Routine[]>({
    queryKey: ['routines'],
    queryFn: () => apiClient<Routine[]>('/routines'),
  });
  const routines = Array.isArray(rawRoutines) ? rawRoutines : [];

  const { data: rawWorkouts } = useQuery<WorkoutHistoryItem[] | { items?: WorkoutHistoryItem[] }>({
    queryKey: ['workouts'],
    queryFn: () => apiClient<WorkoutHistoryItem[] | { items?: WorkoutHistoryItem[] }>('/workouts?limit=40'),
  });
  const workouts = Array.isArray(rawWorkouts)
    ? rawWorkouts
    : Array.isArray(rawWorkouts?.items)
    ? rawWorkouts.items
    : [];

  const setActiveProgramMutation = useMutation({
    mutationFn: async (userProgramId: string) => {
      return apiClient('/programs/user/active', {
        method: 'POST',
        body: JSON.stringify({ user_program_id: userProgramId }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['programs', 'active'] });
      void queryClient.invalidateQueries({ queryKey: ['programs', 'installed'] });
    },
  });

  const deleteRoutineMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/routines/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['routines'] });
    },
  });

  const cloneRoutineMutation = useMutation({
    mutationFn: async (routine: Routine) => {
      return apiClient('/routines', {
        method: 'POST',
        body: JSON.stringify({
          name: `${routine.name} ${t('routines.copySuffix') || '(Копия)'}`,
          notes: routine.notes,
          exercises: routine.exercises.map((e, idx) => ({
            exercise_id: e.exercise_id,
            exercise_name: e.exercise_name,
            order_index: idx,
            target_sets: e.target_sets || 3,
            target_reps_min: e.target_reps_min || 8,
            target_reps_max: e.target_reps_max || 12,
          })),
        }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['routines'] });
    },
  });

  const handleMoveRoutine = (routineId: string, direction: 'up' | 'down') => {
    const isSystem = (r: Routine) =>
      !r.user_id || r.user_id === '00000000-0000-0000-0000-000000000000';
    const users = routines.filter((r) => !isSystem(r));
    const sortedUserIds = [...users]
      .sort((a, b) => {
        const idxA = customRoutineOrder.indexOf(a.id);
        const idxB = customRoutineOrder.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      })
      .map((r) => r.id);

    const index = sortedUserIds.indexOf(routineId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedUserIds.length) return;

    const updated = [...sortedUserIds];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    setCustomRoutineOrder(updated);
    localStorage.setItem(routineOrderKey, JSON.stringify(updated));
  };

  const handleStartRoutine = async (routine: Routine) => {
    const isSystem = !routine.user_id || routine.user_id === '00000000-0000-0000-0000-000000000000';
    const preferred = isSystem
      ? userRoutines.find((u) => u.name.toLowerCase().trim() === routine.name.toLowerCase().trim()) || routine
      : routine;
    await startWorkout({
      name: preferred.name,
      routineId: preferred.id,
      exercises: preferred.exercises,
    });
  };

  const handleStartProgramDay = async (program: Program, day: ProgramDay) => {
    await startWorkout({
      name: `${program.name} - ${day.name}`,
      programId: program.id,
      programDayNumber: day.day_number || selectedProgramDayIndex + 1,
      exercises: day.exercises,
    });
  };

  const userRoutines = useMemo(() => {
    const isSystem = (r: Routine) =>
      !r.user_id || r.user_id === '00000000-0000-0000-0000-000000000000';

    const userOnly = routines.filter((r) => !isSystem(r));
    return [...userOnly].sort((a, b) => {
      const idxA = customRoutineOrder.indexOf(a.id);
      const idxB = customRoutineOrder.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [routines, customRoutineOrder]);

  const filteredRoutines = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return userRoutines;
    return userRoutines.filter((r) => {
      return (
        r.name.toLowerCase().includes(q) ||
        (r.notes && r.notes.toLowerCase().includes(q)) ||
        r.exercises.some((e) => e.exercise_name.toLowerCase().includes(q))
      );
    });
  }, [userRoutines, searchQuery]);

  const weeklyMetrics = useMemo(() => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const weekStart = now - sevenDaysMs;
    const dayKeys = new Set<string>();
    let weekVolumeKg = 0;
    let weekSessions = 0;

    workouts.forEach((w) => {
      const rawDate = w.finished_at || w.started_at || w.created_at;
      if (!rawDate) return;
      const ms = new Date(rawDate).getTime();
      if (Number.isNaN(ms)) return;
      dayKeys.add(new Date(ms).toISOString().slice(0, 10));
      if (ms >= weekStart) {
        weekSessions += 1;
        const computedVol =
          typeof w.total_volume_kg === 'number' && w.total_volume_kg > 0
            ? w.total_volume_kg
            : (w.exercises || []).reduce((acc, ex) => {
                return (
                  acc +
                  (ex.sets || []).reduce(
                    (sAcc, s) => sAcc + (s.completed !== false ? (s.weight_kg || 0) * (s.reps || 0) : 0),
                    0
                  )
                );
              }, 0);
        weekVolumeKg += computedVol;
      }
    });

    // Calculate consecutive day streak up to today/yesterday
    let streak = 0;
    const todayDate = new Date();
    for (let i = 0; i < 60; i++) {
      const d = new Date(todayDate);
      d.setDate(todayDate.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (dayKeys.has(key)) {
        streak += 1;
      } else if (i === 0) {
        continue;
      } else {
        break;
      }
    }

    const recentNotes: Array<{ title: string; note: string; dateLabel: string }> = [];
    for (const w of workouts) {
      if (recentNotes.length >= 3) break;
      const dateStr = w.finished_at || w.started_at || w.created_at || '';
      const dateLabel = dateStr
        ? new Date(dateStr).toLocaleDateString([], { day: 'numeric', month: 'short' })
        : '';

      if (w.notes && w.notes.trim()) {
        recentNotes.push({ title: w.name, note: w.notes.trim(), dateLabel });
      }
      for (const ex of w.exercises || []) {
        if (recentNotes.length >= 3) break;
        if (ex.notes && ex.notes.trim()) {
          recentNotes.push({
            title: ex.exercise_name || w.name,
            note: ex.notes.trim(),
            dateLabel,
          });
        }
      }
    }

    return { weekVolumeKg, weekSessions, streak, recentNotes };
  }, [workouts]);

  const formattedHeroTonnage = useMemo(() => {
    if (unitPref !== 'lb' && weeklyMetrics.weekVolumeKg >= 1000) {
      return `${(weeklyMetrics.weekVolumeKg / 1000).toFixed(1).replace('.', ',')} ${t('summary.tons')}`;
    }
    return formatWeight(weeklyMetrics.weekVolumeKg, unitPref);
  }, [weeklyMetrics.weekVolumeKg, unitPref, t]);

  const activeProgram = useMemo(
    () => applyProgramOverride(activeProgramData?.program),
    [activeProgramData?.program]
  );
  const activeProgramDays = activeProgram?.days || [];
  const currentProgramDay = activeProgramDays[selectedProgramDayIndex] || activeProgramDays[0];

  const goToPrograms = () => {
    if (onNavigateToPrograms) {
      onNavigateToPrograms();
    } else {
      navigate('/programs');
    }
  };

  const gymTools = [
    {
      label: t('nav.programs'),
      icon: FolderKanban,
      onClick: goToPrograms,
      bg: 'bg-[#F0EFFE]',
      fg: 'text-[#6D28D9]',
    },
    {
      label: t('nav.exercises'),
      icon: Dumbbell,
      onClick: () => navigate('/exercises'),
      bg: 'bg-[#FFF7ED]',
      fg: 'text-[#EA580C]',
    },
    {
      label: t('nav.progress'),
      icon: BarChart3,
      onClick: () => navigate('/progress'),
      bg: 'bg-[#ECFDF5]',
      fg: 'text-[#059669]',
    },
    {
      label: t('nav.history'),
      icon: Calendar,
      onClick: () => navigate('/history'),
      bg: 'bg-[#ECFEFF]',
      fg: 'text-[#0891B2]',
    },
    {
      label: t('nav.nutrition'),
      icon: Utensils,
      onClick: () => navigate('/nutrition'),
      bg: 'bg-[#FFF1F2]',
      fg: 'text-[#E11D48]',
    },
    {
      label: t('nav.planShort'),
      icon: CalendarCheck,
      onClick: () => navigate('/todo'),
      bg: 'bg-[#EEF2FF]',
      fg: 'text-[#4338CA]',
    },
    {
      label: t('nav.body'),
      icon: Scale,
      onClick: () => navigate('/body'),
      bg: 'bg-[#F5F3FF]',
      fg: 'text-[#7C3AED]',
    },
    {
      label: t('nav.coach'),
      icon: Bot,
      onClick: () => navigate('/coach'),
      bg: 'bg-[#ECFEFF]',
      fg: 'text-[#0E7490]',
    },
  ];

  return (
    <div className="space-y-7">
      {/* 1. Royal Violet Hero + Floating White 4-Action Quick Dock (Figma Screens 01 & 13) */}
      <section className="relative">
        <div className="royal-hero-gradient rounded-[26px] px-5 pt-6 pb-12 sm:px-7 sm:pt-7 sm:pb-14 text-white royal-card-shadow">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white/75">
                <Sparkles className="w-3.5 h-3.5 text-[#C4B5FD]" />
                <span>{t('workouts.weeklyTonnageLabel')}</span>
              </div>

              <div className="flex flex-wrap items-baseline gap-3">
                <h1 className="text-[32px] sm:text-[38px] font-extrabold tracking-tight tabular-nums leading-none">
                  {formattedHeroTonnage}
                </h1>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-xs font-semibold text-white backdrop-blur-xs">
                  <Flame className="w-3.5 h-3.5 text-[#34D399]" />
                  <span>
                    {weeklyMetrics.streak} {t('workouts.streakDays')}
                  </span>
                </div>
                <span className="text-xs font-medium text-white/75">
                  · {weeklyMetrics.weekSessions} {t('workouts.sessionsCountLabel')}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleStartQuickEmptyWorkout}
                className="min-h-[44px] px-4 rounded-[14px] bg-white text-[#3B0CA3] hover:bg-[#F5F3FF] font-bold text-sm inline-flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{t('workouts.startEmptyWorkout')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingRoutine(null);
                  setIsCreateRoutineOpen(true);
                }}
                className="min-h-[44px] px-4 rounded-[14px] bg-white/15 hover:bg-white/25 text-white border border-white/25 font-semibold text-sm inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('workouts.newRoutineFigma')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Floating White 4-Action Dock */}
        <div className="-mt-7 mx-3 sm:mx-6 bg-white rounded-[20px] border border-[#ECEAF6] royal-float-shadow p-2.5 sm:p-3 grid grid-cols-4 gap-1.5">
          {[
            {
              label: t('workouts.startShort'),
              icon: Dumbbell,
              onClick: handleStartQuickEmptyWorkout,
              pillBg: 'bg-[#F0EFFE]',
              pillFg: 'text-[#6D28D9]',
            },
            {
              label: t('nav.programs'),
              icon: FolderKanban,
              onClick: goToPrograms,
              pillBg: 'bg-[#EEF2FF]',
              pillFg: 'text-[#4338CA]',
            },
            {
              label: t('nav.history'),
              icon: Calendar,
              onClick: () => navigate('/history'),
              pillBg: 'bg-[#ECFEFF]',
              pillFg: 'text-[#0891B2]',
            },
            {
              label: t('nav.coach'),
              icon: Bot,
              onClick: () => navigate('/coach'),
              pillBg: 'bg-[#ECFDF5]',
              pillFg: 'text-[#059669]',
            },
          ].map((act) => {
            const Icon = act.icon;
            return (
              <button
                key={act.label}
                type="button"
                onClick={act.onClick}
                className="flex flex-col items-center justify-center gap-1.5 py-2 px-1 rounded-[14px] hover:bg-[#F8F7FC] transition-colors cursor-pointer"
              >
                <span
                  className={`w-9 h-9 rounded-[12px] ${act.pillBg} ${act.pillFg} flex items-center justify-center`}
                >
                  <Icon className="w-4 h-4" />
                </span>
                <span className="text-[11px] font-semibold text-[#1E1B4B] truncate max-w-full">
                  {act.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Secondary Tools Dock (Exercises, Progress, Nutrition, Plan, Body) */}
      <Card className="p-3 sm:p-4">
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {gymTools
            .filter(
              (tool) =>
                tool.label !== t('nav.programs') &&
                tool.label !== t('nav.history') &&
                tool.label !== t('nav.coach')
            )
            .map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.label}
                  type="button"
                  onClick={tool.onClick}
                  className="flex flex-col items-center gap-1.5 py-2 px-1 rounded-[14px] hover:bg-[#F8F7FC] transition-colors cursor-pointer group"
                >
                  <span
                    className={`w-10 h-10 rounded-[13px] ${tool.bg} ${tool.fg} flex items-center justify-center transition-transform group-hover:-translate-y-0.5`}
                  >
                    <Icon className="w-[18px] h-[18px]" />
                  </span>
                  <span className="text-[11px] font-semibold text-[#1E1B4B] text-center leading-tight line-clamp-1">
                    {tool.label}
                  </span>
                </button>
              );
            })}
        </div>
      </Card>

      {/* 3. Active Personal Program Split Section (Indigo + Teal Cards with Auto-Save Badge) */}
      {activeProgram ? (
        <Card className="p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#F0EFFE] text-[#6D28D9] border border-[#DDD6FE]">
                  {t('programs.activeBadge')}
                </span>
              </div>

              <h2 className="text-[20px] sm:text-[22px] font-bold tracking-tight text-[#1E1B4B]">
                {activeProgram.name}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {activeProgramDays.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSplitExpanded((prev) => !prev)}
                >
                  {isSplitExpanded ? t('workouts.hideDays') : t('workouts.selectDay')}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedProgramPreview(activeProgram)}
              >
                {t('workouts.openProgram')}
              </Button>
            </div>
          </div>

          {/* Indigo + Teal Split Feature Cards (Figma Screen 01 & 13) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            {currentProgramDay && (
              <div className="lg:col-span-7 indigo-card-gradient rounded-[20px] p-5 text-white flex flex-col justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-white/75">
                    {t('workouts.dayOf', {
                      day: selectedProgramDayIndex + 1,
                      total: activeProgramDays.length,
                    })}
                  </div>
                  <div className="text-[19px] font-bold leading-snug">
                    {currentProgramDay.name}
                  </div>
                  <div className="text-[13px] text-white/80">
                    {t('workouts.exercisesCountShort', {
                      count: currentProgramDay.exercises?.length || 0,
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleStartProgramDay(activeProgram, currentProgramDay)}
                    className="h-10 px-4 rounded-[12px] bg-white text-[#1B1145] hover:bg-[#F5F3FF] font-bold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{t('programs.startWorkout')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Next Day / Recovery Teal Accent Card */}
            <div className="lg:col-span-5 teal-card-gradient rounded-[20px] p-5 text-white flex flex-col justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-white/85">
                  <Activity className="w-3.5 h-3.5" />
                  <span>{t('programs.tabInstalled')}</span>
                </div>
                {activeProgramDays.length > 1 ? (
                  <>
                    <div className="text-[16px] font-bold leading-snug">
                      {activeProgramDays[(selectedProgramDayIndex + 1) % activeProgramDays.length]?.name}
                    </div>
                    <div className="text-[12px] text-white/85">
                      {t('workouts.exercisesCountShort', {
                        count:
                          activeProgramDays[
                            (selectedProgramDayIndex + 1) % activeProgramDays.length
                          ]?.exercises?.length || 0,
                      })}
                    </div>
                  </>
                ) : (
                  <div className="text-[14px] font-semibold text-white/95">
                    {t('programs.personalCopyAutoSave')}
                  </div>
                )}
              </div>

              {activeProgramDays.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setSelectedProgramDayIndex(
                      (selectedProgramDayIndex + 1) % activeProgramDays.length
                    )
                  }
                  className="self-start h-9 px-3.5 rounded-[10px] bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  {t('workouts.selectDay')} →
                </button>
              )}
            </div>
          </div>

          {isSplitExpanded && activeProgramDays.length > 0 && (
            <div className="pt-3 border-t border-[#ECEAF6] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {activeProgramDays.map((day, idx) => {
                const isSelected = idx === selectedProgramDayIndex;
                return (
                  <button
                    key={day.day_number || idx}
                    type="button"
                    onClick={() => setSelectedProgramDayIndex(idx)}
                    className={`min-h-[44px] px-3.5 py-2.5 rounded-[12px] border text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#F0EFFE] border-[#6D28D9] text-[#6D28D9]'
                        : 'bg-[#F8F7FC] border-[#ECEAF6] text-[#1E1B4B] hover:border-[#C4B5FD]'
                    }`}
                  >
                    <div className="text-[13px] font-semibold truncate">
                      {t('workouts.dayOf', {
                        day: idx + 1,
                        total: activeProgramDays.length,
                      })}{' '}
                      · {day.name}
                    </div>
                    <div className="text-[12px] text-[#6B7280] mt-0.5 truncate">
                      {t('workouts.exercisesCountShort', {
                        count: day.exercises?.length || 0,
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {installedPrograms.length > 1 && (
            <div className="pt-3 border-t border-[#ECEAF6] flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-medium text-[#6B7280] mr-1">
                {t('programs.tabInstalled')}:
              </span>
              {installedPrograms.map((item) => {
                if (!item.program) return null;
                const isAct = item.program.id === activeProgram.id;
                return (
                  <button
                    key={item.user_program.id}
                    type="button"
                    disabled={setActiveProgramMutation.isPending || isAct}
                    onClick={() => setActiveProgramMutation.mutate(item.user_program.id)}
                    className={`h-[34px] px-3 rounded-[10px] border text-[12px] font-semibold transition-colors cursor-pointer ${
                      isAct
                        ? 'bg-[#6D28D9] border-[#6D28D9] text-white'
                        : 'bg-[#F8F7FC] border-[#ECEAF6] text-[#6B7280] hover:text-[#1E1B4B]'
                    }`}
                  >
                    {item.program.name}
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      ) : (
        <EmptyStateCard
          eyebrow={t('programs.activeBadge')}
          title={t('programs.noActive')}
          description={t('programs.noActiveDesc')}
          actionLabel={t('workouts.browseLibraryBtn')}
          onAction={goToPrograms}
        />
      )}

      {/* 4. My Routines Section */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-[20px] font-bold tracking-tight text-[#1E1B4B]">
            {t('workouts.myRoutines')}
          </h2>

          <div className="flex items-center gap-2 flex-1 sm:max-w-md">
            <div className="flex-1 min-w-0">
              <Input
                placeholder={t('workouts.searchTemplatesInput')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                startContent={<Search className="w-4 h-4 text-[#94A3B8]" />}
                size="sm"
              />
            </div>

            <Button
              variant={isReorderMode ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setIsReorderMode((prev) => !prev)}
              className="shrink-0"
            >
              {t('workouts.reorderMy')}
            </Button>
          </div>
        </div>

        {isRoutinesLoading ? (
          <LoadingStateCard eyebrow={t('workouts.myRoutines')} title={t('common.loading')} />
        ) : filteredRoutines.length === 0 ? (
          <EmptyStateCard
            title={t('workouts.emptyRoutinesTitle')}
            description={searchQuery ? t('workouts.searchNoResults') : t('workouts.noRoutinesHint')}
            actionLabel={t('workouts.newRoutineFigma')}
            onAction={() => {
              setEditingRoutine(null);
              setIsCreateRoutineOpen(true);
            }}
            secondaryActionLabel={t('workouts.browseLibraryBtn')}
            onSecondaryAction={goToPrograms}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRoutines.map((routine) => {
              const estMinutes = Math.max(15, routine.exercises.length * 8);
              const orderIndex = userRoutines.findIndex((r) => r.id === routine.id);
              const totalUserRoutines = userRoutines.length;

              return (
                <Card
                  key={routine.id}
                  className="p-5 flex flex-col justify-between gap-4 hover:border-[#C4B5FD] transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedRoutinePreview(routine)}
                        className="text-left min-w-0 cursor-pointer group flex-1"
                      >
                        <h3 className="text-[17px] font-bold text-[#1E1B4B] group-hover:text-[#6D28D9] transition-colors leading-snug truncate">
                          {routine.name}
                        </h3>
                        <div className="text-[12px] font-medium text-[#6B7280] mt-1">
                          {t('routines.exercisesCount', { count: routine.exercises.length })} ·{' '}
                          {t('workouts.approxMinutes', { mins: estMinutes })}
                        </div>
                      </button>

                      {isReorderMode && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            isIconOnly
                            size="xs"
                            variant="outline"
                            disabled={orderIndex <= 0}
                            onClick={() => handleMoveRoutine(routine.id, 'up')}
                            title={t('routines.moveUp')}
                            aria-label={t('routines.moveUp')}
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            isIconOnly
                            size="xs"
                            variant="outline"
                            disabled={orderIndex === totalUserRoutines - 1}
                            onClick={() => handleMoveRoutine(routine.id, 'down')}
                            title={t('routines.moveDown')}
                            aria-label={t('routines.moveDown')}
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-[#ECEAF6]" />

                    <div className="space-y-2">
                      {routine.exercises.slice(0, 4).map((ex, idx) => (
                        <div
                          key={`${ex.exercise_id}-${idx}`}
                          className="flex items-center gap-2.5 min-w-0"
                        >
                          <ExerciseThumbnail
                            exerciseName={ex.exercise_name}
                            fallbackMuscle={ex.primary_muscle_group}
                            size="xs"
                          />
                          <span className="text-[13px] font-medium text-[#1E1B4B] leading-snug truncate">
                            {ex.target_sets} × {ex.exercise_name}
                          </span>
                        </div>
                      ))}
                      {routine.exercises.length > 4 && (
                        <div className="text-[12px] font-semibold text-[#6D28D9] pl-9">
                          + {routine.exercises.length - 4}
                        </div>
                      )}
                    </div>

                    {routine.notes && (
                      <p className="text-[12px] text-[#6B7280] bg-[#F8F7FC] px-3 py-2 rounded-[10px] border border-[#ECEAF6] leading-relaxed line-clamp-2">
                        {routine.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleStartRoutine(routine)}
                      className="flex-1"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      {t('workouts.startShort')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      isIconOnly
                      onClick={() => {
                        setEditingRoutine(routine);
                        setIsCreateRoutineOpen(true);
                      }}
                      title={t('workouts.editShort')}
                      aria-label={t('workouts.editShort')}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      isIconOnly
                      onClick={() => cloneRoutineMutation.mutate(routine)}
                      isLoading={cloneRoutineMutation.isPending}
                      title={t('workouts.copyShort')}
                      aria-label={t('workouts.copyShort')}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      isIconOnly
                      onClick={() => deleteRoutineMutation.mutate(routine.id)}
                      isLoading={deleteRoutineMutation.isPending}
                      title={t('common.delete')}
                      aria-label={t('common.delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-[#EF4444]" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. Recent Set Notes Widget */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-[10px] bg-[#F0EFFE] text-[#6D28D9] flex items-center justify-center">
              <NotebookPen className="w-4 h-4" />
            </span>
            <h3 className="text-[15px] font-bold text-[#1E1B4B]">
              {t('workouts.recentNotesTitle')}
            </h3>
          </div>
          <Button variant="ghost" size="xs" onClick={() => navigate('/history')}>
            {t('nav.history')} →
          </Button>
        </div>

        {weeklyMetrics.recentNotes.length === 0 ? (
          <p className="text-[13px] text-[#6B7280] bg-[#F8F7FC] border border-[#ECEAF6] rounded-[12px] px-3.5 py-3">
            {t('workouts.noNotesYet')}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {weeklyMetrics.recentNotes.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-[12px] bg-[#F8F7FC] border border-[#ECEAF6] space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#1E1B4B] truncate">{item.title}</span>
                  <span className="text-[11px] font-medium text-[#6B7280] shrink-0">
                    {item.dateLabel}
                  </span>
                </div>
                <p className="text-xs text-[#6B7280] line-clamp-2">{item.note}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modals */}
      <RoutineDetailModal
        isOpen={Boolean(selectedRoutinePreview)}
        routine={selectedRoutinePreview}
        onClose={() => setSelectedRoutinePreview(null)}
        onEditRoutine={(r) => {
          setSelectedRoutinePreview(null);
          setEditingRoutine(r as Routine);
          setIsCreateRoutineOpen(true);
        }}
        onCloneToMyRoutines={(r) => {
          setSelectedRoutinePreview(null);
          cloneRoutineMutation.mutate(r as Routine);
        }}
        onStartWorkout={(r) => {
          setSelectedRoutinePreview(null);
          handleStartRoutine(r as Routine);
        }}
      />

      <RoutineEditorModal
        isOpen={isCreateRoutineOpen}
        initialRoutine={editingRoutine}
        onClose={() => {
          setIsCreateRoutineOpen(false);
          setEditingRoutine(null);
        }}
      />

      <ProgramDetailModal
        isOpen={Boolean(selectedProgramPreview)}
        program={selectedProgramPreview}
        isActiveProgram={activeProgramData?.program?.id === selectedProgramPreview?.id}
        onClose={() => setSelectedProgramPreview(null)}
      />
    </div>
  );
};

export default WorkoutsPage;
