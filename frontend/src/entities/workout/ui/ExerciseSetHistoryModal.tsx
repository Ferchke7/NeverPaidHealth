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
        <div className="w-9 h-9 rounded-[10px] bg-[#022c22] text-[#34d399] border border-[#064e3b] flex items-center justify-center">
          <Dumbbell className="w-4 h-4" />
        </div>
      }
      title={
        <div className="flex items-center gap-2">
          <span className="truncate max-w-[260px] sm:max-w-md">{exerciseName}</span>
        </div>
      }
      subtitle={
        <span className="text-xs text-[#a3a3a3] font-medium">
          {t('activeWorkout.historyModalTitle')}
        </span>
      }
      footer={
        <Button variant="outline" size="md" onClick={onClose}>
          {t('common.close')}
        </Button>
      }
    >
      <div className="space-y-4 text-[#fafafa]">
        {/* 1. All-time PR Stats Summary */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="flex flex-col items-center justify-center p-3 rounded-[12px] bg-[#0a0a0a] border border-[#262626] text-center">
            <span className="text-[10px] uppercase font-semibold text-[#a3a3a3] flex items-center gap-1 mb-1">
              <Trophy className="w-3 h-3 text-[#34d399]" />
              {t('activeWorkout.allTimePR')}
            </span>
            <span className="text-sm sm:text-base font-bold tabular-nums text-[#34d399]">
              {prSummary.best1RMKg > 0 ? `${formatWeight(prSummary.best1RMKg, unit)}` : '—'}
            </span>
            <span className="text-[10px] text-[#737373]">1RM</span>
          </div>

          <div className="flex flex-col items-center justify-center p-3 rounded-[12px] bg-[#0a0a0a] border border-[#262626] text-center">
            <span className="text-[10px] uppercase font-semibold text-[#a3a3a3] flex items-center gap-1 mb-1">
              <Flame className="w-3 h-3 text-[#34d399]" />
              {t('activeWorkout.bestWeight')}
            </span>
            <span className="text-sm sm:text-base font-bold tabular-nums text-[#fafafa]">
              {prSummary.bestWeightKg > 0
                ? `${formatWeight(prSummary.bestWeightKg, unit)} × ${prSummary.bestReps}`
                : '—'}
            </span>
            <span className="text-[10px] text-[#737373]">
              {prSummary.bestRecord?.reps ? `${prSummary.bestRecord.reps} reps` : 'max reps'}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center p-3 rounded-[12px] bg-[#0a0a0a] border border-[#262626] text-center">
            <span className="text-[10px] uppercase font-semibold text-[#a3a3a3] flex items-center gap-1 mb-1">
              <Sparkles className="w-3 h-3 text-[#34d399]" />
              {t('activeWorkout.totalCompleted')}
            </span>
            <span className="text-sm sm:text-base font-bold tabular-nums text-[#fafafa]">
              {prSummary.totalSets}
            </span>
            <span className="text-[10px] text-[#737373]">{t('summary.sets')}</span>
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
                  ? 'bg-[#022c22] text-[#34d399] border-[#064e3b]'
                  : 'bg-[#0a0a0a] text-[#a3a3a3] hover:text-[#fafafa] border-[#262626]'
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
                      ? 'bg-[#022c22] text-[#34d399] border-[#064e3b]'
                      : 'bg-[#0a0a0a] text-[#a3a3a3] hover:text-[#fafafa] border-[#262626]'
                  }`}
                >
                  {t('activeWorkout.setNumberTab', { number: num })} ({count})
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-[#a3a3a3] font-medium">
              {selectedSetFilter === null
                ? t('activeWorkout.allSetsTab')
                : t('activeWorkout.setNumberTab', { number: selectedSetFilter })}{' '}
              · {displayRecords.length}
            </span>

            <div className="flex items-center gap-1 bg-[#0a0a0a] p-1 rounded-[10px] border border-[#262626]">
              <button
                type="button"
                onClick={() => setSortBy('best')}
                className={`h-8 px-2.5 rounded-[8px] text-[11px] font-semibold transition-colors cursor-pointer ${
                  sortBy === 'best'
                    ? 'bg-[#022c22] text-[#34d399]'
                    : 'text-[#a3a3a3] hover:text-[#fafafa]'
                }`}
              >
                {t('activeWorkout.sortByBest')}
              </button>
              <button
                type="button"
                onClick={() => setSortBy('date')}
                className={`h-8 px-2.5 rounded-[8px] text-[11px] font-semibold transition-colors cursor-pointer ${
                  sortBy === 'date'
                    ? 'bg-[#022c22] text-[#34d399]'
                    : 'text-[#a3a3a3] hover:text-[#fafafa]'
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
            <div className="py-10 text-center text-[#737373] text-xs flex flex-col items-center justify-center gap-2 bg-[#0a0a0a] border border-[#262626] rounded-[12px]">
              <Dumbbell className="w-7 h-7 text-[#404040]" />
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
                  className={`p-3 rounded-[12px] border flex items-center justify-between gap-3 ${
                    isTop1
                      ? 'bg-[#0a0a0a] border-[#064e3b]'
                      : 'bg-[#0a0a0a] border-[#262626]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-md bg-[#171717] border border-[#262626] flex items-center justify-center font-semibold text-xs text-[#a3a3a3] tabular-nums shrink-0">
                      #{idx + 1}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-bold tabular-nums text-[#fafafa]">
                          {formatWeight(rec.weightKg, unit)} × {rec.reps}
                        </span>
                        {rec.e1rmKg > 0 && (
                          <span className="text-[10px] font-semibold tabular-nums text-[#34d399] bg-[#022c22] px-1.5 py-0.5 rounded border border-[#064e3b]">
                            1RM: {formatWeight(rec.e1rmKg, unit)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#a3a3a3] truncate">
                        <span>
                          {t('activeWorkout.setNumberTab', { number: rec.setNumber })}
                        </span>
                        <span>·</span>
                        <span className="truncate flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-[#737373] inline shrink-0" />
                          {formatDate(rec.date)}
                        </span>
                        {rec.workoutName && (
                          <>
                            <span>·</span>
                            <span className="truncate text-[#737373]">{rec.workoutName}</span>
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
                          ? 'bg-[#34d399] text-[#0a0a0a] border-[#34d399]'
                          : 'bg-[#171717] hover:bg-[#022c22] text-[#fafafa] hover:text-[#34d399] border-[#404040]'
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
