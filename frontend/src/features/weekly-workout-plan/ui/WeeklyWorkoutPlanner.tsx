import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Dumbbell,
  FolderKanban,
  Play,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../shared/ui/button.tsx';
import { Card } from '../../../shared/ui/card.tsx';
import { Modal } from '../../../shared/ui/modal.tsx';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { generateUUID } from '../../../shared/lib/uuid.ts';
import { InstalledProgramItem, Program } from '../../../entities/program/model/types.ts';
import {
  WeeklyPlanItem,
  WeeklyPlanResponse,
  distributeProgramAcrossWeek,
  getCurrentIsoWeekday,
  movePlanItemToWeekday,
  movePlanItemWithinDay,
  swapPlanWeekdays,
  weeklyPlanApi,
} from '../../../entities/workout/api/weeklyPlanApi.ts';

interface RoutineOption {
  id: string;
  user_id?: string;
  name: string;
  notes?: string;
  exercises: Array<{
    exercise_id: string;
    exercise_name: string;
    order_index: number;
    target_sets: number;
    target_reps_min?: number;
    target_reps_max?: number;
  }>;
}

interface WeeklyWorkoutPlannerProps {
  planItems: WeeklyPlanItem[];
  routines: RoutineOption[];
  activeProgram?: Program | null;
  installedPrograms: InstalledProgramItem[];
  onStartPlanItem: (item: WeeklyPlanItem) => void;
  onCreateNewRoutineForDay: (weekday: number) => void;
}

export const WeeklyWorkoutPlanner: React.FC<WeeklyWorkoutPlannerProps> = ({
  planItems,
  routines,
  activeProgram,
  installedPrograms,
  onStartPlanItem,
  onCreateNewRoutineForDay,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const todayIso = useMemo(() => getCurrentIsoWeekday(), []);

  const [selectedDay, setSelectedDay] = useState<number>(todayIso);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [movingItemId, setMovingItemId] = useState<string | null>(null);
  const [swapSourceDay, setSwapSourceDay] = useState<number | null>(null);

  // Add-to-day modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addTargetDays, setAddTargetDays] = useState<number[]>([todayIso]);
  const [addSourceTab, setAddSourceTab] = useState<'routines' | 'programs'>('routines');

  const weekdays = useMemo(
    () => [
      { day: 1, short: t('weeklyPlan.monShort'), full: t('weeklyPlan.monFull') },
      { day: 2, short: t('weeklyPlan.tueShort'), full: t('weeklyPlan.tueFull') },
      { day: 3, short: t('weeklyPlan.wedShort'), full: t('weeklyPlan.wedFull') },
      { day: 4, short: t('weeklyPlan.thuShort'), full: t('weeklyPlan.thuFull') },
      { day: 5, short: t('weeklyPlan.friShort'), full: t('weeklyPlan.friFull') },
      { day: 6, short: t('weeklyPlan.satShort'), full: t('weeklyPlan.satFull') },
      { day: 7, short: t('weeklyPlan.sunShort'), full: t('weeklyPlan.sunFull') },
    ],
    [t]
  );

  const availablePrograms = useMemo(() => {
    const map = new Map<string, Program>();
    if (activeProgram?.id) {
      map.set(activeProgram.id, activeProgram);
    }
    for (const inst of installedPrograms) {
      if (inst.program?.id && !map.has(inst.program.id)) {
        map.set(inst.program.id, inst.program);
      }
    }
    return Array.from(map.values());
  }, [activeProgram, installedPrograms]);

  const savePlanMutation = useMutation({
    mutationFn: (nextItems: WeeklyPlanItem[]) => weeklyPlanApi.saveWeeklyPlan(nextItems),
    onMutate: async (nextItems) => {
      await queryClient.cancelQueries({ queryKey: ['workouts', 'weekly-plan'] });
      const prev = queryClient.getQueryData<WeeklyPlanResponse>(['workouts', 'weekly-plan']);
      queryClient.setQueryData<WeeklyPlanResponse>(['workouts', 'weekly-plan'], (old) => ({
        week_start: old?.week_start || '',
        items: nextItems,
      }));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(['workouts', 'weekly-plan'], ctx.prev);
      }
    },
    onSuccess: (res) => {
      queryClient.setQueryData(['workouts', 'weekly-plan'], res);
    },
  });

  const toggleCompleteMutation = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      weeklyPlanApi.toggleItemComplete(id, completed),
    onSuccess: (res) => {
      queryClient.setQueryData(['workouts', 'weekly-plan'], res);
    },
  });

  const itemsByDay = useMemo(() => {
    const grouped: Record<number, WeeklyPlanItem[]> = {
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
      7: [],
    };
    for (const item of planItems) {
      if (grouped[item.day_of_week]) {
        grouped[item.day_of_week].push(item);
      }
    }
    for (const d of [1, 2, 3, 4, 5, 6, 7]) {
      grouped[d].sort((a, b) => a.order_index - b.order_index);
    }
    return grouped;
  }, [planItems]);

  const completedTotal = useMemo(
    () => planItems.filter((i) => i.is_completed_this_week).length,
    [planItems]
  );

  const openAddModalForDay = (day: number) => {
    setAddTargetDays([day]);
    setAddSourceTab(routines.length > 0 ? 'routines' : 'programs');
    setIsAddModalOpen(true);
  };

  const toggleTargetDay = (day: number) => {
    setAddTargetDays((prev) =>
      prev.includes(day) ? (prev.length > 1 ? prev.filter((d) => d !== day) : prev) : [...prev, day]
    );
  };

  const handleAddRoutineToDays = (routine: RoutineOption) => {
    const additions: WeeklyPlanItem[] = addTargetDays.map((dow, idx) => ({
      id: generateUUID(),
      day_of_week: dow,
      order_index: (itemsByDay[dow]?.length || 0) + idx,
      item_type: 'routine',
      routine_id: routine.id,
      title: routine.name,
      subtitle: routine.notes || '',
      exercises: routine.exercises.map((ex, exIdx) => ({
        exercise_id: ex.exercise_id,
        exercise_name: ex.exercise_name,
        order_index: ex.order_index ?? exIdx,
        target_sets: ex.target_sets || 3,
        target_reps_min: ex.target_reps_min,
        target_reps_max: ex.target_reps_max,
      })),
      is_completed_this_week: false,
    }));
    savePlanMutation.mutate([...planItems, ...additions]);
    setIsAddModalOpen(false);
  };

  const handleAddProgramDayToDays = (prog: Program, dayNum: number, dayName: string, exercises: any[]) => {
    const additions: WeeklyPlanItem[] = addTargetDays.map((dow, idx) => ({
      id: generateUUID(),
      day_of_week: dow,
      order_index: (itemsByDay[dow]?.length || 0) + idx,
      item_type: 'program_day',
      program_id: prog.id,
      program_day_number: dayNum,
      title: dayName,
      subtitle: prog.name,
      exercises: (exercises || []).map((ex, exIdx) => ({
        exercise_id: ex.exercise_id,
        exercise_name: ex.exercise_name,
        order_index: ex.order_index ?? exIdx,
        target_sets: ex.target_sets || 3,
        target_reps_min: ex.target_reps_min,
        target_reps_max: ex.target_reps_max,
      })),
      is_completed_this_week: false,
    }));
    savePlanMutation.mutate([...planItems, ...additions]);
    setIsAddModalOpen(false);
  };

  const handleRemoveItem = (itemId: string) => {
    savePlanMutation.mutate(planItems.filter((i) => i.id !== itemId));
  };

  const handleDayPillClick = (day: number) => {
    if (swapSourceDay !== null) {
      if (swapSourceDay !== day) {
        savePlanMutation.mutate(swapPlanWeekdays(planItems, swapSourceDay, day));
        setSelectedDay(day);
      }
      setSwapSourceDay(null);
      return;
    }
    setSelectedDay(day);
  };

  const renderPlanItemCard = (item: WeeklyPlanItem, dayListLength: number) => {
    const isMoving = movingItemId === item.id;
    return (
      <div
        key={item.id}
        className={`rounded-[16px] border p-4 transition-all space-y-3 ${
          item.is_completed_this_week
            ? 'bg-[#ECFDF5]/60 border-[#A7F3D0]'
            : 'bg-[#F8F7FC] border-[#ECEAF6] hover:border-[#C4B5FD]'
        }`}
      >
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={() =>
                toggleCompleteMutation.mutate({
                  id: item.id,
                  completed: !item.is_completed_this_week,
                })
              }
              className="mt-0.5 shrink-0 cursor-pointer text-[#6D28D9] hover:scale-105 transition-transform"
              title={t('weeklyPlan.toggleDoneHint')}
            >
              {item.is_completed_this_week ? (
                <CheckCircle2 className="w-5 h-5 text-[#059669]" />
              ) : (
                <Circle className="w-5 h-5 text-[#94A3B8]" />
              )}
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-[#F0EFFE] text-[#6D28D9]">
                  #{item.order_index + 1}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white border border-[#ECEAF6] text-[#6B7280] truncate max-w-[180px]">
                  {item.item_type === 'program_day'
                    ? item.subtitle || t('weeklyPlan.programBadge')
                    : t('weeklyPlan.routineBadge')}
                </span>
                {item.is_completed_this_week && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#D1FAE5] text-[#047857]">
                    ✓ {t('weeklyPlan.doneBadge')}
                  </span>
                )}
              </div>

              <div className="text-[15px] font-bold text-[#1E1B4B] mt-1 leading-snug truncate">
                {item.title}
              </div>

              <div className="text-[12px] text-[#6B7280] mt-0.5">
                {t('workouts.exercisesCountShort', { count: item.exercises?.length || 0 })}
                {item.exercises?.length > 0 && (
                  <span className="text-[#94A3B8]">
                    {' · '}
                    {item.exercises
                      .slice(0, 3)
                      .map((e) => e.exercise_name)
                      .join(', ')}
                    {item.exercises.length > 3 ? ` +${item.exercises.length - 3}` : ''}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {dayListLength > 1 && (
              <>
                <button
                  type="button"
                  disabled={item.order_index <= 0}
                  onClick={() =>
                    savePlanMutation.mutate(movePlanItemWithinDay(planItems, item.id, 'up'))
                  }
                  className="p-1.5 rounded-[8px] border border-[#ECEAF6] bg-white text-[#6B7280] hover:text-[#1E1B4B] disabled:opacity-35 cursor-pointer"
                  title={t('routines.moveUp')}
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={item.order_index >= dayListLength - 1}
                  onClick={() =>
                    savePlanMutation.mutate(movePlanItemWithinDay(planItems, item.id, 'down'))
                  }
                  className="p-1.5 rounded-[8px] border border-[#ECEAF6] bg-white text-[#6B7280] hover:text-[#1E1B4B] disabled:opacity-35 cursor-pointer"
                  title={t('routines.moveDown')}
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setMovingItemId(isMoving ? null : item.id)}
              className={`p-1.5 rounded-[8px] border transition-colors cursor-pointer ${
                isMoving
                  ? 'bg-[#6D28D9] border-[#6D28D9] text-white'
                  : 'bg-white border-[#ECEAF6] text-[#6B7280] hover:text-[#6D28D9]'
              }`}
              title={t('weeklyPlan.moveToAnotherDay')}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => handleRemoveItem(item.id)}
              className="p-1.5 rounded-[8px] border border-[#ECEAF6] bg-white text-[#EF4444] hover:bg-[#FEF2F2] cursor-pointer"
              title={t('weeklyPlan.removeFromDay')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {isMoving && (
          <div className="pt-2 border-t border-[#ECEAF6] flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-[#6B7280] mr-1">
              {t('weeklyPlan.moveTargetLabel')}:
            </span>
            {weekdays.map((wd) => {
              const current = wd.day === item.day_of_week;
              return (
                <button
                  key={wd.day}
                  type="button"
                  disabled={current}
                  onClick={() => {
                    savePlanMutation.mutate(movePlanItemToWeekday(planItems, item.id, wd.day));
                    setMovingItemId(null);
                    setSelectedDay(wd.day);
                  }}
                  className={`h-7 px-2.5 rounded-[8px] text-[11px] font-bold transition-colors cursor-pointer ${
                    current
                      ? 'bg-[#6D28D9] text-white opacity-60 cursor-default'
                      : 'bg-white border border-[#DDD6FE] text-[#6D28D9] hover:bg-[#F0EFFE]'
                  }`}
                >
                  {wd.short}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2 pt-0.5">
          <Button
            variant="primary"
            size="sm"
            onClick={() => onStartPlanItem(item)}
            disabled={!item.exercises || item.exercises.length === 0}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {t('workouts.startShort')}
          </Button>
        </div>
      </div>
    );
  };

  const selectedDayMeta = weekdays.find((w) => w.day === selectedDay) || weekdays[0];
  const selectedDayItems = itemsByDay[selectedDay] || [];

  return (
    <>
      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#F0EFFE] text-[#6D28D9] border border-[#DDD6FE]">
                <CalendarDays className="w-3.5 h-3.5" />
                {t('weeklyPlan.eyebrow')}
              </span>
              {planItems.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
                  {t('weeklyPlan.weekProgress', {
                    done: completedTotal,
                    total: planItems.length,
                  })}
                </span>
              )}
            </div>
            <h2 className="text-[20px] sm:text-[22px] font-bold tracking-tight text-[#1E1B4B]">
              {t('weeklyPlan.title')}
            </h2>
            <p className="text-[13px] text-[#6B7280]">{t('weeklyPlan.subtitle')}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="inline-flex bg-[#F8F7FC] p-1 rounded-[12px] border border-[#ECEAF6]">
              <button
                type="button"
                onClick={() => setViewMode('day')}
                className={`h-8 px-3 rounded-[9px] text-xs font-semibold transition-colors cursor-pointer ${
                  viewMode === 'day' ? 'bg-white text-[#6D28D9] shadow-2xs' : 'text-[#6B7280]'
                }`}
              >
                {t('weeklyPlan.byDayView')}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('week')}
                className={`h-8 px-3 rounded-[9px] text-xs font-semibold transition-colors cursor-pointer ${
                  viewMode === 'week' ? 'bg-white text-[#6D28D9] shadow-2xs' : 'text-[#6B7280]'
                }`}
              >
                {t('weeklyPlan.fullWeekView')}
              </button>
            </div>

            {activeProgram && (activeProgram.days?.length || 0) > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  savePlanMutation.mutate(distributeProgramAcrossWeek(planItems, activeProgram))
                }
              >
                <Sparkles className="w-3.5 h-3.5 text-[#6D28D9]" />
                {t('weeklyPlan.autoFillSplit')}
              </Button>
            )}

            <Button
              variant={swapSourceDay !== null ? 'primary' : 'outline'}
              size="sm"
              onClick={() =>
                setSwapSourceDay((prev) => (prev === null ? selectedDay : null))
              }
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              {swapSourceDay !== null
                ? t('weeklyPlan.pickDayToSwap')
                : t('weeklyPlan.swapDaysBtn')}
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => openAddModalForDay(selectedDay)}
            >
              <Plus className="w-3.5 h-3.5" />
              {t('weeklyPlan.addWorkoutBtn')}
            </Button>
          </div>
        </div>

        {swapSourceDay !== null && (
          <div className="px-3.5 py-2.5 rounded-[12px] bg-[#F0EFFE] border border-[#C4B5FD] text-[12px] font-semibold text-[#5B21B6] flex items-center justify-between gap-2">
            <span>
              {t('weeklyPlan.swapBannerHint', {
                day: weekdays.find((w) => w.day === swapSourceDay)?.full || '',
              })}
            </span>
            <button
              type="button"
              onClick={() => setSwapSourceDay(null)}
              className="underline cursor-pointer shrink-0"
            >
              {t('common.cancel')}
            </button>
          </div>
        )}

        {/* 7-Day Selector Strip */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {weekdays.map((wd) => {
            const dayItems = itemsByDay[wd.day] || [];
            const isSelected = viewMode === 'day' && selectedDay === wd.day;
            const isToday = todayIso === wd.day;
            const isSwapSource = swapSourceDay === wd.day;
            const allDone =
              dayItems.length > 0 && dayItems.every((it) => it.is_completed_this_week);

            return (
              <button
                key={wd.day}
                type="button"
                onClick={() => handleDayPillClick(wd.day)}
                className={`py-2.5 px-1.5 rounded-[14px] border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                  isSwapSource
                    ? 'bg-[#4C1D95] border-[#4C1D95] text-white ring-2 ring-[#C4B5FD]'
                    : isSelected
                    ? 'bg-[#6D28D9] border-[#6D28D9] text-white shadow-xs'
                    : 'bg-[#F8F7FC] border-[#ECEAF6] text-[#1E1B4B] hover:border-[#C4B5FD]'
                }`}
              >
                <span className="text-[12px] font-extrabold leading-none">{wd.short}</span>
                {isToday && (
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider ${
                      isSelected || isSwapSource ? 'text-[#DDD6FE]' : 'text-[#6D28D9]'
                    }`}
                  >
                    {t('weeklyPlan.todayShort')}
                  </span>
                )}
                <span
                  className={`mt-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    dayItems.length === 0
                      ? isSelected
                        ? 'bg-white/15 text-white/75'
                        : 'text-[#94A3B8]'
                      : allDone
                      ? 'bg-[#10B981] text-white'
                      : isSelected
                      ? 'bg-white text-[#6D28D9]'
                      : 'bg-[#EDE9FE] text-[#6D28D9]'
                  }`}
                >
                  {dayItems.length === 0 ? '—' : allDone ? `✓ ${dayItems.length}` : dayItems.length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Day View vs Full Week Board */}
        {viewMode === 'day' ? (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[15px] font-bold text-[#1E1B4B]">
                {selectedDayMeta.full}
                {selectedDay === todayIso ? ` · ${t('weeklyPlan.todayShort')}` : ''}
              </div>
              <button
                type="button"
                onClick={() => openAddModalForDay(selectedDay)}
                className="text-xs font-bold text-[#6D28D9] hover:underline cursor-pointer"
              >
                + {t('weeklyPlan.addMoreToDay')}
              </button>
            </div>

            {selectedDayItems.length === 0 ? (
              <div className="rounded-[16px] border border-dashed border-[#DDD6FE] bg-[#F8F7FC] p-5 text-center space-y-3">
                <p className="text-[14px] font-semibold text-[#1E1B4B]">
                  {t('weeklyPlan.restOrEmptyTitle')}
                </p>
                <p className="text-[12px] text-[#6B7280]">
                  {t('weeklyPlan.restOrEmptyDesc')}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => openAddModalForDay(selectedDay)}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t('weeklyPlan.addExistingBtn')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCreateNewRoutineForDay(selectedDay)}
                  >
                    {t('workouts.newRoutineFigma')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {selectedDayItems.map((it) => renderPlanItemCard(it, selectedDayItems.length))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 pt-1">
            {weekdays.map((wd) => {
              const list = itemsByDay[wd.day] || [];
              return (
                <div
                  key={wd.day}
                  className="rounded-[16px] border border-[#ECEAF6] bg-white p-3.5 space-y-2.5 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[14px] font-extrabold text-[#1E1B4B]">
                        {wd.full}
                        {wd.day === todayIso ? ` · ${t('weeklyPlan.todayShort')}` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => openAddModalForDay(wd.day)}
                        className="w-7 h-7 rounded-[8px] bg-[#F0EFFE] text-[#6D28D9] flex items-center justify-center hover:bg-[#DDD6FE] cursor-pointer"
                        title={t('weeklyPlan.addWorkoutBtn')}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {list.length === 0 ? (
                      <div className="text-[12px] text-[#94A3B8] py-3 text-center border border-dashed border-[#ECEAF6] rounded-[12px]">
                        {t('weeklyPlan.restDayShort')}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {list.map((it) => renderPlanItemCard(it, list.length))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Add Workout / Program Day Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        size="lg"
        title={t('weeklyPlan.modalTitle')}
        subtitle={t('weeklyPlan.modalSubtitle')}
      >
        <div className="space-y-4">
          {/* Multi-weekday target selector */}
          <div className="space-y-2">
            <div className="text-[12px] font-bold uppercase tracking-wider text-[#6B7280]">
              {t('weeklyPlan.chooseDaysLabel')}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {weekdays.map((wd) => {
                const active = addTargetDays.includes(wd.day);
                return (
                  <button
                    key={wd.day}
                    type="button"
                    onClick={() => toggleTargetDay(wd.day)}
                    className={`h-10 rounded-[10px] border text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                      active
                        ? 'bg-[#6D28D9] border-[#6D28D9] text-white'
                        : 'bg-[#F8F7FC] border-[#ECEAF6] text-[#1E1B4B] hover:border-[#C4B5FD]'
                    }`}
                  >
                    {active && <Check className="w-3 h-3" />}
                    <span>{wd.short}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Source tabs */}
          <div className="flex items-center gap-2 border-b border-[#ECEAF6] pb-2">
            <button
              type="button"
              onClick={() => setAddSourceTab('routines')}
              className={`h-9 px-3.5 rounded-[10px] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                addSourceTab === 'routines'
                  ? 'bg-[#F0EFFE] text-[#6D28D9]'
                  : 'text-[#6B7280] hover:text-[#1E1B4B]'
              }`}
            >
              <Dumbbell className="w-3.5 h-3.5" />
              {t('workouts.myRoutines')} ({routines.length})
            </button>
            <button
              type="button"
              onClick={() => setAddSourceTab('programs')}
              className={`h-9 px-3.5 rounded-[10px] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                addSourceTab === 'programs'
                  ? 'bg-[#F0EFFE] text-[#6D28D9]'
                  : 'text-[#6B7280] hover:text-[#1E1B4B]'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5" />
              {t('nav.programs')} ({availablePrograms.length})
            </button>
          </div>

          {addSourceTab === 'routines' ? (
            routines.length === 0 ? (
              <div className="py-6 text-center space-y-3 bg-[#F8F7FC] rounded-[14px] border border-[#ECEAF6]">
                <p className="text-sm font-semibold text-[#1E1B4B]">
                  {t('workouts.emptyRoutinesTitle')}
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    onCreateNewRoutineForDay(addTargetDays[0] || selectedDay);
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t('workouts.newRoutineFigma')}
                </Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {routines.map((rot) => (
                  <div
                    key={rot.id}
                    className="p-3.5 rounded-[14px] border border-[#ECEAF6] bg-[#F8F7FC] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-[14px] font-bold text-[#1E1B4B] truncate">{rot.name}</div>
                      <div className="text-[12px] text-[#6B7280]">
                        {t('workouts.exercisesCountShort', { count: rot.exercises.length })}
                      </div>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleAddRoutineToDays(rot)}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {t('exercises.addShort')}
                    </Button>
                  </div>
                ))}
              </div>
            )
          ) : availablePrograms.length === 0 ? (
            <div className="py-6 text-center text-sm text-[#6B7280] bg-[#F8F7FC] rounded-[14px] border border-[#ECEAF6]">
              {t('programs.noActiveDesc')}
            </div>
          ) : (
            <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
              {availablePrograms.map((prog) => (
                <div
                  key={prog.id}
                  className="p-3.5 rounded-[16px] border border-[#ECEAF6] bg-[#F8F7FC] space-y-2.5"
                >
                  <div className="text-[14px] font-extrabold text-[#1E1B4B]">{prog.name}</div>
                  <div className="space-y-1.5">
                    {(prog.days || []).map((d, idx) => (
                      <div
                        key={`${prog.id}-${d.day_number || idx}`}
                        className="p-2.5 rounded-[12px] bg-white border border-[#ECEAF6] flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-[13px] font-bold text-[#1E1B4B] truncate">
                            {d.name}
                          </div>
                          <div className="text-[11px] text-[#6B7280]">
                            {t('workouts.exercisesCountShort', {
                              count: d.exercises?.length || 0,
                            })}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() =>
                            handleAddProgramDayToDays(
                              prog,
                              d.day_number || idx + 1,
                              d.name,
                              d.exercises || []
                            )
                          }
                        >
                          <Plus className="w-3 h-3" />
                          {t('exercises.addShort')}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};
