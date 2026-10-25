import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Play,
  Trash2,
  FolderPlus,
  Search,
  BookOpen,
  Layers,
  Copy,
  Clock,
  Edit3,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Calendar,
  Sparkles,
  Dumbbell,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { Button } from '../../../shared/ui/button.tsx';
import { Card, Badge, Chip } from '../../../shared/ui/card.tsx';
import { Input } from '../../../shared/ui/input.tsx';
import { RoutineEditorModal } from '../../../features/routine-builder/ui/RoutineEditorModal.tsx';
import { RoutineDetailModal } from '../../../features/routine-preview/ui/RoutineDetailModal.tsx';
import { ProgramDetailModal } from '../../../features/program-preview/ui/ProgramDetailModal.tsx';
import { useStartWorkout } from '../../../features/start-workout/model/useStartWorkout.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import {
  Program,
  ProgramDay,
  ActiveProgramResponse,
  InstalledProgramItem,
} from '../../../entities/program/model/types.ts';

interface RoutineExercise {
  exercise_id: string;
  exercise_name: string;
  order_index: number;
  target_sets: number;
  target_reps_min?: number;
  target_reps_max?: number;
}

interface Routine {
  id: string;
  user_id?: string;
  name: string;
  notes?: string;
  exercises: RoutineExercise[];
  created_at: string;
}

interface WorkoutsPageProps {
  onNavigateToPrograms?: () => void;
}

export const WorkoutsPage: React.FC<WorkoutsPageProps> = ({ onNavigateToPrograms }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateRoutineOpen, setIsCreateRoutineOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [selectedRoutinePreview, setSelectedRoutinePreview] = useState<Routine | null>(null);
  const [selectedProgramPreview, setSelectedProgramPreview] = useState<Program | null>(null);
  const [selectedProgramDayIndex, setSelectedProgramDayIndex] = useState(0);
  const [isSplitExpanded, setIsSplitExpanded] = useState(false);

  const routineOrderKey = user?.id ? `np_my_routines_custom_order_${user.id}` : 'np_my_routines_custom_order';
  const [customRoutineOrder, setCustomRoutineOrder] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(
        user?.id ? `np_my_routines_custom_order_${user.id}` : 'np_my_routines_custom_order'
      );
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [isReorderMode, setIsReorderMode] = useState(false);

  const startWorkout = useStartWorkout();

  const handleStartQuickEmptyWorkout = async () => {
    const today = new Date().toLocaleDateString([], { day: 'numeric', month: 'short' });
    await startWorkout({
      name: `${t('workouts.quickWorkoutName') || 'Быстрая тренировка'} (${today})`,
      exercises: [],
    });
  };

  // Fetch Active Program
  const { data: activeProgramData } = useQuery<ActiveProgramResponse>({
    queryKey: ['programs', 'active'],
    queryFn: () => apiClient<ActiveProgramResponse>('/programs/user/active'),
  });

  // Fetch Installed Programs
  const { data: rawInstalledPrograms } = useQuery<InstalledProgramItem[]>({
    queryKey: ['programs', 'installed'],
    queryFn: () => apiClient<InstalledProgramItem[]>('/programs/user/installed'),
  });
  const installedPrograms = Array.isArray(rawInstalledPrograms) ? rawInstalledPrograms : [];

  // Fetch routines (both user + library templates)
  const { data: rawRoutines, isLoading: isRoutinesLoading } = useQuery<Routine[]>({
    queryKey: ['routines'],
    queryFn: () => apiClient<Routine[]>('/routines'),
  });
  const routines = Array.isArray(rawRoutines) ? rawRoutines : [];

  // Set Active Program Mutation
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

  // Delete routine mutation
  const deleteRoutineMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/routines/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['routines'] });
    },
  });

  // Clone routine mutation
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
    await startWorkout({
      name: routine.name,
      routineId: routine.id,
      exercises: routine.exercises,
    });
  };

  const handleStartProgramDay = async (program: Program, day: ProgramDay) => {
    await startWorkout({
      name: `${program.name} - ${day.name}`,
      exercises: day.exercises,
    });
  };

  // Filter user's personal routines
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
    return userRoutines.filter((r) => {
      return (
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.notes && r.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        r.exercises.some((e) => e.exercise_name.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    });
  }, [userRoutines, searchQuery]);

  const activeProgram = activeProgramData?.program;
  const activeProgramDays = activeProgram?.days || [];
  const currentProgramDay = activeProgramDays[selectedProgramDayIndex] || activeProgramDays[0];

  const goToPrograms = () => {
    if (onNavigateToPrograms) {
      onNavigateToPrograms();
    } else {
      navigate('/programs');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header with Ready-Made UI Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-dark-800/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Dumbbell className="w-6 h-6 text-brand-400" />
            <span>{t('workouts.title') || 'Тренировки'}</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {t('workouts.subtitle') || 'Запуск сессии, текущий сплит и персональные шаблоны'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="text-xs flex items-center gap-1.5 border-brand-500/40 text-brand-400 hover:bg-brand-500/10 cursor-pointer"
            onClick={handleStartQuickEmptyWorkout}
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>{t('workouts.emptyWorkout') || 'Пустая тренировка'}</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            className="text-xs flex items-center gap-1.5 cursor-pointer font-bold"
            onClick={() => {
              setEditingRoutine(null);
              setIsCreateRoutineOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
            <span>{t('workouts.newRoutine') || 'Новый шаблон'}</span>
          </Button>
        </div>
      </div>

      {/* Hero Section: Active Program Split Card */}
      {activeProgram && (
        <Card className="p-4 bg-gradient-to-br from-dark-850 to-dark-900 border border-brand-500/30 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="brand" size="sm" className="flex items-center gap-1 font-mono uppercase">
                  <Sparkles className="w-3 h-3" />
                  <span>{activeProgram.name}</span>
                </Badge>
                <span className="text-xs text-zinc-400 font-mono">
                  {t('workouts.dayOf', { day: selectedProgramDayIndex + 1, total: activeProgramDays.length })}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <h2 className="text-base sm:text-lg font-black text-white truncate">
                  {currentProgramDay?.name || `${t('programs.dayShort') || 'День'} ${selectedProgramDayIndex + 1}`}
                </h2>
                <span className="text-xs text-zinc-500 font-mono">
                  • {currentProgramDay?.exercises?.length || 0} {t('programs.exercises') || 'упражнений'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSplitExpanded((v) => !v)}
                className="text-xs flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5 text-brand-400" />
                <span>
                  {isSplitExpanded
                    ? t('workouts.splitHideDays') || '▲ Скрыть дни'
                    : t('workouts.splitSelectDay') || '▼ Выбрать день'}
                </span>
              </Button>

              <Button
                variant="primary"
                size="sm"
                className="font-bold text-xs flex items-center gap-1.5 px-4 py-2 shadow-lg shadow-brand-500/25"
                onClick={() => handleStartProgramDay(activeProgram, currentProgramDay)}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{t('workouts.start') || 'Начать'}</span>
              </Button>
            </div>
          </div>

          {/* Expandable Split Days Selector */}
          {isSplitExpanded && (
            <div className="pt-3 border-t border-dark-800/80 space-y-2.5 animate-in fade-in duration-150">
              {installedPrograms.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-400">{t('programs.switchProgram') || 'Сменить программу'}:</span>
                  <select
                    value={activeProgramData?.user_program?.id || ''}
                    onChange={(e) => setActiveProgramMutation.mutate(e.target.value)}
                    className="bg-dark-900 border border-dark-750 text-xs text-zinc-200 rounded-xl px-2.5 py-1 focus:outline-none focus:border-brand-500 font-medium"
                  >
                    {installedPrograms.map((item) => (
                      <option key={item.user_program.id} value={item.user_program.id}>
                        {item.program?.name || item.user_program.custom_name || 'Program'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none flex-1">
                  {activeProgramDays.map((day, idx) => {
                    const isSelected = idx === selectedProgramDayIndex;
                    return (
                      <Button
                        key={idx}
                        size="xs"
                        variant={isSelected ? 'primary' : 'outline'}
                        onClick={() => setSelectedProgramDayIndex(idx)}
                        className="gap-1.5 whitespace-nowrap text-xs"
                      >
                        <span className="font-mono">#{idx + 1}</span>
                        <span className="truncate max-w-[130px]">{day.name}</span>
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => setSelectedProgramPreview(activeProgram)}
                  className="gap-1 text-xs shrink-0"
                >
                  <BookOpen className="w-3 h-3 text-brand-400" />
                  <span>{t('programs.viewSplit') || 'Обзор'}</span>
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Personal Routines Section */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white">
              {t('workouts.myRoutines') || 'Мои шаблоны'}
            </h2>
            <Badge variant="neutral" size="sm">
              {userRoutines.length}
            </Badge>
          </div>

          {userRoutines.length > 1 && (
            <Button
              size="xs"
              variant={isReorderMode ? 'flat' : 'outline'}
              onClick={() => setIsReorderMode((prev) => !prev)}
              className="gap-1.5 text-xs font-bold"
              title="Переставить шаблоны местами"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-brand-400" />
              <span>{isReorderMode ? t('workouts.reorderDone') || 'Готово' : t('workouts.reorder') || 'Порядок'}</span>
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            placeholder={t('workouts.searchPlaceholder') || 'Поиск по названию или упражнению...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 text-xs"
          />
        </div>

        {/* Routines Grid */}
        {isRoutinesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-36 bg-dark-800/60 rounded-2xl border border-dark-700/60 animate-pulse"
              />
            ))}
          </div>
        ) : filteredRoutines.length === 0 ? (
          <Card className="text-center py-10 border-dashed border-dark-800 p-6 bg-dark-900/30">
            <FolderPlus className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-zinc-300">
              {userRoutines.length === 0
                ? t('workouts.noRoutines') || 'Нет сохранённых шаблонов'
                : t('common.search') || 'Ничего не найдено'}
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 mb-4">
              {userRoutines.length === 0
                ? t('workouts.noRoutinesHint') || 'Создайте свой первый тренировочный шаблон или выберите готовую программу в каталоге.'
                : t('workouts.searchNoResults') || 'Попробуйте изменить поисковый запрос.'}
            </p>

            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPrograms}
                className="text-xs"
              >
                <BookOpen className="w-3.5 h-3.5 mr-1 text-brand-400" />
                <span>{t('workouts.exploreLibrary') || 'Каталог программ'}</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditingRoutine(null);
                  setIsCreateRoutineOpen(true);
                }}
                className="text-xs font-bold"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                <span>{t('workouts.createFirstRoutine') || 'Создать шаблон'}</span>
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredRoutines.map((routine) => {
              const orderIndex = userRoutines.findIndex((r) => r.id === routine.id);
              const totalUserRoutines = userRoutines.length;

              return (
                <Card
                  key={routine.id}
                  isHoverable
                  onClick={() => setSelectedRoutinePreview(routine)}
                  className="p-4 bg-dark-850/90 border border-dark-750/80 hover:border-brand-500/50 transition-all flex flex-col justify-between shadow-lg cursor-pointer group"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          {orderIndex !== -1 && (
                            <Badge variant="brand" size="sm" className="font-mono font-bold mt-0.5">
                              #{orderIndex + 1}
                            </Badge>
                          )}
                          <h3 className="text-sm sm:text-base font-bold text-white leading-snug group-hover:text-brand-400 transition-colors break-words flex-1">
                            {routine.name}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-zinc-500" />
                            {routine.exercises?.length || 0} {t('programs.exercises') || 'упр.'}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-zinc-500" />
                            {t('workouts.approxMinutes', { mins: (routine.exercises?.length || 0) * 10 }) || `~${(routine.exercises?.length || 0) * 10} мин`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {isReorderMode && (
                          <div className="flex items-center bg-dark-900 rounded-lg p-0.5 border border-amber-500/40 mr-0.5 shadow-sm">
                            <Button
                              isIconOnly
                              size="xs"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveRoutine(routine.id, 'up');
                              }}
                              disabled={orderIndex <= 0}
                              className="text-amber-300 hover:text-amber-200"
                              title={t('routines.moveUp') || 'Вверх'}
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              isIconOnly
                              size="xs"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveRoutine(routine.id, 'down');
                              }}
                              disabled={orderIndex === -1 || orderIndex >= totalUserRoutines - 1}
                              className="text-amber-300 hover:text-amber-200"
                              title={t('routines.moveDown') || 'Вниз'}
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}

                        <Button
                          isIconOnly
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            setEditingRoutine(routine);
                            setIsCreateRoutineOpen(true);
                          }}
                          className="text-zinc-400 hover:text-brand-400"
                          title={t('common.edit') || 'Редактировать'}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          isIconOnly
                          size="xs"
                          variant="ghost"
                          onClick={() => deleteRoutineMutation.mutate(routine.id)}
                          className="text-zinc-500 hover:text-red-400"
                          title={t('common.delete') || 'Удалить'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {routine.notes && (
                      <p className="text-xs text-zinc-400 italic line-clamp-1">
                        "{routine.notes}"
                      </p>
                    )}

                    {/* Exercise Chips */}
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {routine.exercises?.slice(0, 4).map((ex, i) => (
                        <Chip
                          key={i}
                          size="sm"
                          variant="bordered"
                          color="default"
                          className="text-[10px] font-mono"
                        >
                          <span className="text-brand-400 font-bold">{ex.target_sets || 3}×</span>
                          <span className="font-sans truncate max-w-[130px]">{ex.exercise_name}</span>
                        </Chip>
                      ))}
                      {(routine.exercises?.length || 0) > 4 && (
                        <Badge variant="neutral" size="sm" className="font-mono text-[10px]">
                          +{(routine.exercises?.length || 0) - 4}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div
                    className="mt-3.5 pt-2.5 border-t border-dark-750 flex items-center justify-between gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => cloneRoutineMutation.mutate(routine)}
                      disabled={cloneRoutineMutation.isPending}
                      className="text-xs text-zinc-400 hover:text-zinc-200 gap-1.5"
                      title={t('routines.copyToMy') || 'Дублировать'}
                    >
                      <Copy className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{t('routines.copyToMy') || 'Копия'}</span>
                    </Button>

                    <Button
                      variant="primary"
                      size="sm"
                      className="text-xs font-bold flex items-center justify-center gap-1.5 px-4 shadow-sm"
                      onClick={() => handleStartRoutine(routine)}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{t('workouts.start') || 'Старт'}</span>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Dedicated Navigation Cards */}
      <div className="pt-2 border-t border-dark-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card
          isHoverable
          onClick={goToPrograms}
          className="p-3.5 bg-dark-850/60 hover:bg-dark-800 border-dark-750 hover:border-brand-500/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-brand-400 transition-colors">
                  {t('workouts.programCatalogTitle') || 'Каталог программ тренировок'}
                </div>
                <div className="text-[11px] text-zinc-400">
                  {t('workouts.programCatalogDesc') || 'PPL, Верх/Низ, Full Body и сплиты сообщества'}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
          </div>
        </Card>

        <Card
          isHoverable
          onClick={() => navigate('/exercises')}
          className="p-3.5 bg-dark-850/60 hover:bg-dark-800 border-dark-750 hover:border-brand-500/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                <Dumbbell className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">
                  {t('workouts.exercisesLibraryTitle') || 'База упражнений и техника'}
                </div>
                <div className="text-[11px] text-zinc-400">
                  {t('workouts.exercisesLibraryDesc') || 'Фильтры по мышцам, оборудованию и 3D-анимации'}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
          </div>
        </Card>
      </div>

      {/* Routine Detail Modal */}
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

      {/* Routine Creator / Editor Modal */}
      <RoutineEditorModal
        isOpen={isCreateRoutineOpen}
        initialRoutine={editingRoutine}
        onClose={() => {
          setIsCreateRoutineOpen(false);
          setEditingRoutine(null);
        }}
      />

      {/* Program Detail Modal */}
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
