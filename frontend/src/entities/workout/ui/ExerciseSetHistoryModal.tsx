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
      icon={<Dumbbell className="w-5 h-5 text-brand-400" />}
      title={
        <div className="flex items-center gap-2">
          <span className="truncate max-w-[260px] sm:max-w-md">{exerciseName}</span>
        </div>
      }
      subtitle={
        <span className="text-xs text-zinc-400 font-medium">
          {t('activeWorkout.historyModalTitle')}
        </span>
      }
    >
      <div className="space-y-4 text-zinc-200">
        {/* 1. All-time PR Stats Summary */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-dark-900 border border-dark-700/60 shadow-inner">
          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-dark-800/60 border border-amber-500/20 text-center">
            <span className="text-[10px] uppercase font-bold text-amber-400/90 flex items-center gap-1 mb-0.5">
              <Trophy className="w-3 h-3 text-amber-400" />
              {t('activeWorkout.allTimePR')}
            </span>
            <span className="text-sm sm:text-base font-mono font-extrabold text-amber-300">
              {prSummary.best1RMKg > 0 ? `${formatWeight(prSummary.best1RMKg, unit)}` : '—'}
            </span>
            <span className="text-[9px] text-zinc-500 font-mono">1RM</span>
          </div>

          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-dark-800/60 border border-emerald-500/20 text-center">
            <span className="text-[10px] uppercase font-bold text-emerald-400/90 flex items-center gap-1 mb-0.5">
              <Flame className="w-3 h-3 text-emerald-400" />
              {t('activeWorkout.bestWeight')}
            </span>
            <span className="text-sm sm:text-base font-mono font-extrabold text-emerald-300">
              {prSummary.bestWeightKg > 0
                ? `${formatWeight(prSummary.bestWeightKg, unit)} × ${prSummary.bestReps}`
                : '—'}
            </span>
            <span className="text-[9px] text-zinc-500 font-mono">
              {prSummary.bestRecord?.reps ? `${prSummary.bestRecord.reps} reps` : 'max reps'}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-dark-800/60 border border-sky-500/20 text-center">
            <span className="text-[10px] uppercase font-bold text-sky-400/90 flex items-center gap-1 mb-0.5">
              <Sparkles className="w-3 h-3 text-sky-400" />
              {t('activeWorkout.totalCompleted')}
            </span>
            <span className="text-sm sm:text-base font-mono font-extrabold text-sky-300">
              {prSummary.totalSets}
            </span>
            <span className="text-[9px] text-zinc-500 font-mono">подходов</span>
          </div>
        </div>

        {/* 2. Set Filter Tabs & Sort Controls */}
        <div className="space-y-2">
          {/* Set Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedSetFilter(null)}
              className={`py-1 px-3 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedSetFilter === null
                  ? 'bg-brand-500 text-dark-950 shadow-sm shadow-brand-500/30'
                  : 'bg-dark-800 text-zinc-400 hover:text-zinc-200 hover:bg-dark-700 border border-dark-700/60'
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
                  className={`py-1 px-3 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-brand-500 text-dark-950 shadow-sm shadow-brand-500/30'
                      : 'bg-dark-800 text-zinc-400 hover:text-zinc-200 hover:bg-dark-700 border border-dark-700/60'
                  }`}
                >
                  {t('activeWorkout.setNumberTab', { number: num })} ({count})
                </button>
              );
            })}
          </div>

          {/* Sort By Selector */}
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-zinc-400 font-semibold text-[11px]">
              {selectedSetFilter === null
                ? t('activeWorkout.allSetsTab')
                : t('activeWorkout.setNumberTab', { number: selectedSetFilter })}{' '}
              • {displayRecords.length} записей
            </span>

            <div className="flex items-center gap-1 bg-dark-900 p-0.5 rounded-xl border border-dark-700/60">
              <button
                type="button"
                onClick={() => setSortBy('best')}
                className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  sortBy === 'best'
                    ? 'bg-dark-700 text-brand-300 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t('activeWorkout.sortByBest')}
              </button>
              <button
                type="button"
                onClick={() => setSortBy('date')}
                className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  sortBy === 'date'
                    ? 'bg-dark-700 text-brand-300 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t('activeWorkout.sortByDate')}
              </button>
            </div>
          </div>
        </div>

        {/* 3. Scrollable List of Historical Sets */}
        <div className="max-h-[46vh] sm:max-h-[50vh] overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-dark-700">
          {displayRecords.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs flex flex-col items-center justify-center gap-2">
              <Dumbbell className="w-8 h-8 opacity-40" />
              <span>{t('activeWorkout.noHistoryFound')}</span>
            </div>
          ) : (
            displayRecords.map((rec, idx) => {
              const uniqueKey = `${rec.workoutId}-${rec.setNumber}-${idx}`;
              const isApplied = appliedId === uniqueKey;
              const isTop1 = sortBy === 'best' && idx === 0;
              const isTop2 = sortBy === 'best' && idx === 1;
              const isTop3 = sortBy === 'best' && idx === 2;

              return (
                <div
                  key={uniqueKey}
                  className={`p-3 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3 ${
                    isTop1
                      ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400/60'
                      : isTop2
                      ? 'bg-dark-800/90 border-zinc-600/50 hover:border-zinc-500'
                      : isTop3
                      ? 'bg-amber-950/10 border-amber-700/30 hover:border-amber-600/50'
                      : 'bg-dark-850 border-dark-750 hover:border-dark-600 hover:bg-dark-800'
                  }`}
                >
                  {/* Left Column: Rank + Performance */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Rank / Medal Badge */}
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 select-none">
                      {isTop1 ? (
                        <span className="text-base" title="Top 1">🥇</span>
                      ) : isTop2 ? (
                        <span className="text-base" title="Top 2">🥈</span>
                      ) : isTop3 ? (
                        <span className="text-base" title="Top 3">🥉</span>
                      ) : (
                        <span className="text-zinc-500 font-mono text-xs">#{idx + 1}</span>
                      )}
                    </div>

                    {/* Weight & Reps + Details */}
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm sm:text-base font-mono font-extrabold text-white">
                          {formatWeight(rec.weightKg, unit)} × {rec.reps}
                        </span>
                        {rec.e1rmKg > 0 && (
                          <span className="text-[10px] font-mono font-semibold text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded-md border border-brand-500/20">
                            1RM: {formatWeight(rec.e1rmKg, unit)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-400 truncate">
                        <span className="font-semibold text-zinc-300">
                          {t('activeWorkout.setNumberTab', { number: rec.setNumber })}
                        </span>
                        <span>•</span>
                        <span className="truncate flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-zinc-500 inline shrink-0" />
                          {formatDate(rec.date)}
                        </span>
                        {rec.workoutName && (
                          <>
                            <span>•</span>
                            <span className="truncate text-zinc-500">{rec.workoutName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Apply Button */}
                  {onApplyValues && (
                    <button
                      type="button"
                      onClick={() => handleApply(rec, uniqueKey)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer ${
                        isApplied
                          ? 'bg-emerald-500 text-dark-950 font-extrabold shadow-md'
                          : 'bg-dark-750 hover:bg-brand-500 hover:text-dark-950 text-zinc-300 border border-dark-600 hover:border-brand-400'
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

        {/* 4. Modal Footer */}
        <div className="pt-2 flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </Modal>
  );
};
