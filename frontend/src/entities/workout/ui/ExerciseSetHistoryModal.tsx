import React, { useState, useMemo } from 'react';
import { Trophy, Calendar, Dumbbell, ArrowDownToLine, Flame, Check, Sparkles } from 'lucide-react';
import { Modal } from '../../../shared/ui/modal.tsx';
import { Button } from '../../../shared/ui/button.tsx';
import { HistoricalSetRecord, getAllTimeExercisePR } from '../model/setHistory.ts';
import { formatWeight } from '../../../shared/lib/units.ts';
import { useAuthStore } from '../../user/model/authStore.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { formatDate } from '../../../shared/lib/dates.ts';

interface ExerciseSetHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  exerciseName: string;
  initialSetNumber?: number;
  history: HistoricalSetRecord[];
  onApplyValues?: (weightKg: number, reps: number) => void;
}

export const ExerciseSetHistoryModal: React.FC<ExerciseSetHistoryModalProps> = ({
  isOpen,
  onClose,
  exerciseName,
  initialSetNumber,
  history,
  onApplyValues,
}) => {
  const { t } = useTranslation();
  const unit = useAuthStore((s) => s.unitPreference);

  // Selected set filter: null means "All sets"
  const [selectedSetFilter, setSelectedSetFilter] = useState<number | null>(
    initialSetNumber !== undefined ? initialSetNumber : null
  );

  // Sort: 'date' (most recent sessions first) or 'best' (1RM)
  const [sortBy, setSortBy] = useState<'best' | 'date'>('date');
  const [appliedId, setAppliedId] = useState<string | null>(null);

  // PR Summary
  const prSummary = useMemo(() => getAllTimeExercisePR(history), [history]);

  // Unique set numbers present in the history
  const availableSetNumbers = useMemo(() => {
    const setNums = new Set<number>();
    history.forEach((r) => setNums.add(r.setNumber));
    return Array.from(setNums).sort((a, b) => a - b);
  }, [history]);

  // Filtered and sorted records
  const displayRecords = useMemo(() => {
    let list = selectedSetFilter === null
      ? [...history]
      : history.filter((r) => r.setNumber === selectedSetFilter);

    if (sortBy === 'best') {
      list.sort((a, b) => {
        if (b.e1rmKg !== a.e1rmKg) return b.e1rmKg - a.e1rmKg;
        if (b.weightKg !== a.weightKg) return b.weightKg - a.weightKg;
        if (b.reps !== a.reps) return b.reps - a.reps;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
    } else {
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    return list;
  }, [history, selectedSetFilter, sortBy]);

  const handleApply = (record: HistoricalSetRecord, uniqueKey: string) => {
    if (onApplyValues) {
      onApplyValues(record.weightKg, record.reps);
      setAppliedId(uniqueKey);
      setTimeout(() => {
        setAppliedId(null);
        onClose();
      }, 350);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      icon={
        <div className="w-9 h-9 rounded-[12px] bg-[#F0EFFE] text-[#6D28D9] border border-[#DDD6FE] flex items-center justify-center">
          <Dumbbell className="w-4 h-4" />
        </div>
      }
      title={
        <div className="flex items-center gap-2">
          <span className="truncate max-w-[260px] sm:max-w-md text-[#1E1B4B]">{exerciseName}</span>
        </div>
      }
      subtitle={
        <span className="text-xs text-[#6B7280] font-medium">
          {t('activeWorkout.historyModalTitle')}
        </span>
      }
      footer={
        <Button variant="outline" size="md" onClick={onClose}>
          {t('common.close')}
        </Button>
      }
    >
      <div className="space-y-4 text-[#1E1B4B]">
        {/* 1. All-time PR Stats Summary */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="flex flex-col items-center justify-center p-3 rounded-[14px] bg-[#F8F7FC] border border-[#ECEAF6] text-center">
            <span className="text-[10px] uppercase font-semibold text-[#6B7280] flex items-center gap-1 mb-1">
              <Trophy className="w-3 h-3 text-[#10B981]" />
              {t('activeWorkout.allTimePR')}
            </span>
            <span className="text-sm sm:text-base font-bold tabular-nums text-[#6D28D9]">
              {prSummary.best1RMKg > 0 ? `${formatWeight(prSummary.best1RMKg, unit)}` : '—'}
            </span>
            <span className="text-[10px] text-[#94A3B8]">1RM</span>
          </div>

          <div className="flex flex-col items-center justify-center p-3 rounded-[14px] bg-[#F8F7FC] border border-[#ECEAF6] text-center">
            <span className="text-[10px] uppercase font-semibold text-[#6B7280] flex items-center gap-1 mb-1">
              <Flame className="w-3 h-3 text-[#6D28D9]" />
              {t('activeWorkout.bestWeight')}
            </span>
            <span className="text-sm sm:text-base font-bold tabular-nums text-[#1E1B4B]">
              {prSummary.bestWeightKg > 0
                ? `${formatWeight(prSummary.bestWeightKg, unit)} × ${prSummary.bestReps}`
                : '—'}
            </span>
            <span className="text-[10px] text-[#94A3B8]">
              {prSummary.bestRecord?.reps ? `${prSummary.bestRecord.reps} ${t('common.reps')}` : 'max reps'}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center p-3 rounded-[14px] bg-[#F8F7FC] border border-[#ECEAF6] text-center">
            <span className="text-[10px] uppercase font-semibold text-[#6B7280] flex items-center gap-1 mb-1">
              <Sparkles className="w-3 h-3 text-[#0891B2]" />
              {t('activeWorkout.totalCompleted')}
            </span>
            <span className="text-sm sm:text-base font-bold tabular-nums text-[#1E1B4B]">
              {prSummary.totalSets}
            </span>
            <span className="text-[10px] text-[#94A3B8]">{t('summary.sets')}</span>
          </div>
        </div>

        {/* 2. Set Filter Tabs & Sort Controls */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedSetFilter(null)}
              className={`h-9 px-3 rounded-[10px] text-xs font-semibold transition-colors shrink-0 cursor-pointer border ${
                selectedSetFilter === null
                  ? 'bg-[#6D28D9] text-white border-[#6D28D9]'
                  : 'bg-[#F8F7FC] text-[#6B7280] hover:text-[#1E1B4B] border-[#ECEAF6]'
              }`}
            >
              {t('activeWorkout.allSetsTab')} ({history.length})
            </button>

            {availableSetNumbers.map((num) => {
              const count = history.filter((r) => r.setNumber === num).length;
              const isSelected = selectedSetFilter === num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => setSelectedSetFilter(num)}
                  className={`h-9 px-3 rounded-[10px] text-xs font-semibold transition-colors shrink-0 cursor-pointer border ${
                    isSelected
                      ? 'bg-[#6D28D9] text-white border-[#6D28D9]'
                      : 'bg-[#F8F7FC] text-[#6B7280] hover:text-[#1E1B4B] border-[#ECEAF6]'
                  }`}
                >
                  {t('activeWorkout.setNumberTab', { number: num })} ({count})
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-[#6B7280] font-medium">
              {selectedSetFilter === null
                ? t('activeWorkout.allSetsTab')
                : t('activeWorkout.setNumberTab', { number: selectedSetFilter })}{' '}
              · {displayRecords.length}
            </span>

            <div className="flex items-center gap-1 bg-[#F4F3FA] p-1 rounded-[10px] border border-[#ECEAF6]">
              <button
                type="button"
                onClick={() => setSortBy('best')}
                className={`h-8 px-2.5 rounded-[8px] text-[11px] font-semibold transition-colors cursor-pointer ${
                  sortBy === 'best'
                    ? 'bg-white text-[#6D28D9] shadow-xs'
                    : 'text-[#6B7280] hover:text-[#1E1B4B]'
                }`}
              >
                {t('activeWorkout.sortByBest')}
              </button>
              <button
                type="button"
                onClick={() => setSortBy('date')}
                className={`h-8 px-2.5 rounded-[8px] text-[11px] font-semibold transition-colors cursor-pointer ${
                  sortBy === 'date'
                    ? 'bg-white text-[#6D28D9] shadow-xs'
                    : 'text-[#6B7280] hover:text-[#1E1B4B]'
                }`}
              >
                {t('activeWorkout.sortByDate')}
              </button>
            </div>
          </div>
        </div>

        {/* 3. Scrollable List of Historical Sets */}
        <div className="max-h-[46vh] sm:max-h-[50vh] overflow-y-auto space-y-2 pr-1">
          {displayRecords.length === 0 ? (
            <div className="py-10 text-center text-[#94A3B8] text-xs flex flex-col items-center justify-center gap-2 bg-[#F8F7FC] border border-[#ECEAF6] rounded-[14px]">
              <Dumbbell className="w-7 h-7 text-[#C4B5FD]" />
              <span>{t('activeWorkout.noHistoryFound')}</span>
            </div>
          ) : (
            displayRecords.map((rec, idx) => {
              const uniqueKey = `${rec.workoutId}-${rec.setNumber}-${idx}`;
              const isApplied = appliedId === uniqueKey;
              const isTop1 = sortBy === 'best' && idx === 0;

              return (
                <div
                  key={uniqueKey}
                  className={`p-3 rounded-[14px] border flex items-center justify-between gap-3 ${
                    isTop1
                      ? 'bg-[#F5F3FF] border-[#DDD6FE]'
                      : 'bg-[#F8F7FC] border-[#ECEAF6]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-white border border-[#ECEAF6] flex items-center justify-center font-semibold text-xs text-[#6B7280] tabular-nums shrink-0">
                      #{idx + 1}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-bold tabular-nums text-[#1E1B4B]">
                          {formatWeight(rec.weightKg, unit)} × {rec.reps}
                        </span>
                        {rec.e1rmKg > 0 && (
                          <span className="text-[10px] font-semibold tabular-nums text-[#10B981] bg-[#ECFDF5] px-1.5 py-0.5 rounded border border-[#A7F3D0]">
                            1RM: {formatWeight(rec.e1rmKg, unit)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#6B7280] truncate">
                        <span>
                          {t('activeWorkout.setNumberTab', { number: rec.setNumber })}
                        </span>
                        <span>·</span>
                        <span className="truncate flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-[#94A3B8] inline shrink-0" />
                          {formatDate(rec.date)}
                        </span>
                        {rec.workoutName && (
                          <>
                            <span>·</span>
                            <span className="truncate text-[#94A3B8]">{rec.workoutName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {onApplyValues && (
                    <button
                      type="button"
                      onClick={() => handleApply(rec, uniqueKey)}
                      className={`h-9 px-3 rounded-[10px] text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer border ${
                        isApplied
                          ? 'bg-[#10B981] text-white border-[#10B981]'
                          : 'bg-white hover:bg-[#F0EFFE] text-[#1E1B4B] hover:text-[#6D28D9] border-[#E2E0F0]'
                      }`}
                      title={t('activeWorkout.useValues')}
                    >
                      {isApplied ? (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>{t('activeWorkout.applied')}</span>
                        </>
                      ) : (
                        <>
                          <ArrowDownToLine className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{t('activeWorkout.applyRecord')}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};
