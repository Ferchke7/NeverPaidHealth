import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { Button } from '../../../shared/ui/button.tsx';
import { Card } from '../../../shared/ui/card.tsx';
import { Input } from '../../../shared/ui/input.tsx';
import { EmptyStateCard, LoadingStateCard } from '../../../shared/ui/SystemState.tsx';
import { RoutineEditorModal } from '../../../features/routine-builder/ui/RoutineEditorModal.tsx';
import { RoutineDetailModal } from '../../../features/routine-preview/ui/RoutineDetailModal.tsx';
import { ProgramDetailModal } from '../../../features/program-preview/ui/ProgramDetailModal.tsx';
import { useStartWorkout } from '../../../features/start-workout/model/useStartWorkout.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { usePageSEO } from '../../../shared/lib/seo/usePageSEO.ts';
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
  usePageSEO({ pageKey: 'workouts', canonicalPath: '/workouts' });
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

  const routineOrderKey = user?.id
    ? `np_my_routines_custom_order_${user.id}`
    : 'np_my_routines_custom_order';
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

  // Fetch routines
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
    <div className="space-y-8">
      {/* Page Header & Top Action Bar */}
      <div className="space-y-4">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-[#fafafa]">
            {t('nav.workouts')}
          </h1>
          <p className="text-[14px] text-[#a3a3a3] mt-1">
            {t('workouts.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="primary"
            size="md"
            onClick={handleStartQuickEmptyWorkout}
          >
            {t('workouts.startEmptyWorkout')}
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={() => {
              setEditingRoutine(null);
              setIsCreateRoutineOpen(true);
            }}
          >
            {t('workouts.newRoutineFigma')}
          </Button>
        </div>
      </div>

      {/* Active Program Hero Card */}
      {activeProgram ? (
        <Card className="p-5 sm:p-6 space-y-4">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#34d399]">
              {t('programs.activeBadge')}
            </div>

            <h2 className="text-[22px] sm:text-[24px] font-bold tracking-tight text-[#fafafa]">
              {activeProgram.name}
            </h2>

            {currentProgramDay && (
              <div className="space-y-1">
                <div className="text-[14px] font-medium text-[#fafafa]">
                  {t('workouts.dayOf', {
                    day: selectedProgramDayIndex + 1,
                    total: activeProgramDays.length,
                  })}{' '}
                  · {currentProgramDay.name}
                </div>
                <div className="text-[13px] text-[#a3a3a3]">
                  {t('workouts.exercisesCountShort', {
                    count: currentProgramDay.exercises?.length || 0,
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            {currentProgramDay && (
              <Button
                variant="primary"
                size="md"
                onClick={() => handleStartProgramDay(activeProgram, currentProgramDay)}
              >
                {t('programs.startWorkout')}
              </Button>
            )}

            {activeProgramDays.length > 1 && (
              <Button
                variant="outline"
                size="md"
                onClick={() => setIsSplitExpanded((prev) => !prev)}
              >
                {isSplitExpanded ? t('workouts.hideDays') : t('workouts.selectDay')}
              </Button>
            )}

            <Button
              variant="outline"
              size="md"
              onClick={() => setSelectedProgramPreview(activeProgram)}
            >
              {t('workouts.openProgram')}
            </Button>
          </div>

          {/* Expandable Split Day Switcher */}
          {isSplitExpanded && activeProgramDays.length > 0 && (
            <div className="pt-4 border-t border-[#262626] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {activeProgramDays.map((day, idx) => {
                const isSelected = idx === selectedProgramDayIndex;
                return (
                  <button
                    key={day.day_number || idx}
                    type="button"
                    onClick={() => setSelectedProgramDayIndex(idx)}
                    className={`min-h-[44px] px-3.5 py-2.5 rounded-[10px] border text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#022c22] border-[#34d399]/40 text-[#34d399]'
                        : 'bg-[#0a0a0a] border-[#404040] text-[#fafafa] hover:bg-[#262626]'
                    }`}
                  >
                    <div className="text-[13px] font-medium truncate">
                      {t('workouts.dayOf', {
                        day: idx + 1,
                        total: activeProgramDays.length,
                      })}{' '}
                      · {day.name}
                    </div>
                    <div className="text-[12px] text-[#a3a3a3] mt-0.5 truncate">
                      {t('workouts.exercisesCountShort', {
                        count: day.exercises?.length || 0,
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Switch among Installed Programs if user has multiple */}
          {installedPrograms.length > 1 && (
            <div className="pt-4 border-t border-[#262626] flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-[#a3a3a3] mr-1">
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
                    className={`h-[36px] px-3 rounded-[8px] border text-[12px] font-medium transition-colors cursor-pointer ${
                      isAct
                        ? 'bg-[#022c22] border-[#34d399]/30 text-[#34d399]'
                        : 'bg-[#0a0a0a] border-[#404040] text-[#a3a3a3] hover:text-[#fafafa]'
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

      {/* Section: My Routines */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-[20px] font-semibold tracking-tight text-[#fafafa]">
            {t('workouts.myRoutines')}
          </h2>
        </div>

        {/* Search & Order Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="flex-1 min-w-0">
            <Input
              placeholder={t('workouts.searchTemplatesInput')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Button
            variant={isReorderMode ? 'flat' : 'outline'}
            size="md"
            onClick={() => setIsReorderMode((prev) => !prev)}
            className="shrink-0"
          >
            {t('workouts.reorderMy')}
          </Button>
        </div>

        {/* Routine Cards Grid (3-col Desktop / 1-col Mobile) */}
        {isRoutinesLoading ? (
          <LoadingStateCard
            eyebrow={t('workouts.myRoutines')}
            title={t('common.loading')}
          />
        ) : filteredRoutines.length === 0 ? (
          <EmptyStateCard
            title={t('workouts.emptyRoutinesTitle')}
            description={
              searchQuery ? t('workouts.searchNoResults') : t('workouts.noRoutinesHint')
            }
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
                  className="p-5 flex flex-col justify-between gap-4 hover:border-[#525252] transition-colors"
                >
                  <div className="space-y-3">
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedRoutinePreview(routine)}
                        className="text-left min-w-0 cursor-pointer group"
                      >
                        <h3 className="text-[18px] font-semibold text-[#fafafa] group-hover:text-[#34d399] transition-colors leading-snug">
                          {routine.name}
                        </h3>
                        <div className="text-[13px] text-[#a3a3a3] mt-1">
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

                    <div className="border-t border-[#262626]" />

                    {/* Exercise Vertical List */}
                    <div className="space-y-2">
                      {routine.exercises.slice(0, 5).map((ex, idx) => (
                        <div
                          key={`${ex.exercise_id}-${idx}`}
                          className="text-[14px] text-[#fafafa] leading-snug truncate"
                        >
                          {ex.target_sets} × {ex.exercise_name}
                        </div>
                      ))}
                      {routine.exercises.length > 5 && (
                        <div className="text-[12px] text-[#a3a3a3]">
                          + {routine.exercises.length - 5}
                        </div>
                      )}
                    </div>

                    {routine.notes && (
                      <p className="text-[12px] text-[#a3a3a3] leading-relaxed line-clamp-2">
                        {routine.notes}
                      </p>
                    )}
                  </div>

                  {/* Card Actions Footer */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => handleStartRoutine(routine)}
                    >
                      {t('workouts.startShort')}
                    </Button>
                    <Button
                      variant="outline"
                      size="md"
                      onClick={() => {
                        setEditingRoutine(routine);
                        setIsCreateRoutineOpen(true);
                      }}
                    >
                      {t('workouts.editShort')}
                    </Button>
                    <Button
                      variant="outline"
                      size="md"
                      onClick={() => cloneRoutineMutation.mutate(routine)}
                      isLoading={cloneRoutineMutation.isPending}
                    >
                      {t('workouts.copyShort')}
                    </Button>
                    <Button
                      variant="outline"
                      size="md"
                      onClick={() => deleteRoutineMutation.mutate(routine.id)}
                      isLoading={deleteRoutineMutation.isPending}
                    >
                      {t('common.delete')}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

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
