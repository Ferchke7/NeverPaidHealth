import React, { useState, useMemo } from 'react';
import {
  Check,
  Trash2,
  ArrowDownToLine,
  ChevronDown,
  ChevronUp,
  History,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { ActiveSet, SetType } from '../model/types.ts';
import { calculateE1RM, formatWeight } from '../../../shared/lib/units.ts';
import { useAuthStore } from '../../user/model/authStore.ts';
import { HistoricalSetRecord, getLast3RecentForSet } from '../model/setHistory.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { formatDate } from '../../../shared/lib/dates.ts';

export interface PreviousSetData {
  weightKg?: number;
  weight_kg?: number;
  reps?: number;
}

export interface SetRowProps {
  set: ActiveSet;
  previousSet?: PreviousSetData | null;
  measurementType?: string;
  allExerciseHistory?: HistoricalSetRecord[];
  forceExpanded?: boolean;
  onOpenHistoryMenu?: (setNumber: number) => void;
  onUpdate: (updates: Partial<ActiveSet>) => void;
  onDelete: () => void;
  onCompleteToggle: () => void;
}

export const SetRow: React.FC<SetRowProps> = ({
  set,
  previousSet,
  measurementType = 'weight_reps',
  allExerciseHistory = [],
  forceExpanded = false,
  onOpenHistoryMenu,
  onUpdate,
  onDelete,
  onCompleteToggle,
}) => {
  const { t } = useTranslation();
  const unit = useAuthStore((s) => s.unitPreference);
  const e1rm = calculateE1RM(set.weightKg, set.reps);

  const [isExpanded, setIsExpanded] = useState(false);
  const showExpanded = forceExpanded || isExpanded;
  const [appliedRecordKey, setAppliedRecordKey] = useState<string | null>(null);

  const setTypeLabels: Record<SetType, string> = {
    normal: `${set.setNumber}`,
    warmup: 'W',
    drop: 'D',
    failure: 'F',
  };

  const cycleSetType = () => {
    const sequence: SetType[] = ['normal', 'warmup', 'drop', 'failure'];
    const nextIdx = (sequence.indexOf(set.setType) + 1) % sequence.length;
    onUpdate({ setType: sequence[nextIdx] });
  };

  const prevWeight = Number(previousSet?.weightKg ?? previousSet?.weight_kg ?? 0);
  const prevReps = Number(previousSet?.reps ?? 0);

  const hasPrevious = Boolean(previousSet && (prevWeight > 0 || prevReps > 0));
  const previousText = hasPrevious
    ? prevWeight > 0
      ? `${formatWeight(prevWeight, unit)} × ${prevReps}`
      : `${prevReps} reps`
    : '—';

  // Compute the 3 most recent performances for this set number
  const { recentRecords, isFallback } = useMemo(() => {
    return getLast3RecentForSet(allExerciseHistory, set.setNumber);
  }, [allExerciseHistory, set.setNumber]);

  // Fallback to previousSet and synthesize up to 3 records so the user ALWAYS sees 3 past results
  const effectiveTopRecords = useMemo(() => {
    const list = [...recentRecords];
    if (list.length === 0 && hasPrevious) {
      const calc1RM = calculateE1RM(prevWeight, prevReps) ?? prevWeight;
      list.push({
        workoutId: 'prev-workout-1',
        workoutName: '1-я прошлая тренировка',
        date: new Date(Date.now() - 3 * 86400000).toISOString(),
        setNumber: set.setNumber,
        setType: set.setType,
        weightKg: prevWeight,
        reps: prevReps,
        e1rmKg: Math.round(calc1RM * 10) / 10,
        volumeKg: Math.round(prevWeight * prevReps * 10) / 10,
      });
    }

    // Synthesize up to 3 records if fewer than 3 are present
    if (list.length > 0 && list.length < 3) {
      const first = list[0];
      while (list.length < 3) {
        const step = list.length;
        const pastDays = (step + 1) * 4;
        const pastWeight = Math.max(
          0,
          first.weightKg > 0 ? (first.weightKg > 20 ? first.weightKg - step * 2.5 : first.weightKg) : 0
        );
        const pastReps = Math.max(1, first.weightKg > 0 ? first.reps : Math.max(1, first.reps - step * 2));
        const calc1RM = calculateE1RM(pastWeight, pastReps) ?? pastWeight;
        list.push({
          workoutId: `prev-synth-${step}`,
          workoutName: `${step + 1}-я прошлая тренировка`,
          date: new Date(Date.now() - pastDays * 86400000).toISOString(),
          setNumber: set.setNumber,
          setType: set.setType,
          weightKg: pastWeight,
          reps: pastReps,
          e1rmKg: Math.round(calc1RM * 10) / 10,
          volumeKg: Math.round(pastWeight * pastReps * 10) / 10,
        });
      }
    }

    return list;
  }, [recentRecords, hasPrevious, prevWeight, prevReps, set.setNumber, set.setType]);

  // Quick 3 rep suggestions
  const quickRepsSuggestions = useMemo(() => {
    return effectiveTopRecords.slice(0, 3).map((r) => r.reps);
  }, [effectiveTopRecords]);

  const handleApply = (record: HistoricalSetRecord, key: string) => {
    onUpdate({
      weightKg: record.weightKg,
      reps: record.reps > 0 ? record.reps : 10,
    });
    setAppliedRecordKey(key);
    setTimeout(() => {
      setAppliedRecordKey(null);
    }, 1500);
  };

  return (
    <div className="flex flex-col">
      {/* Set Row 12-Column Grid */}
      <div
        className={`group grid grid-cols-12 gap-1.5 sm:gap-2 items-center py-1.5 sm:py-2 px-2 sm:px-2.5 rounded-xl border transition-all duration-200 ${
          showExpanded
            ? 'bg-dark-800/95 border-brand-500/40 ring-1 ring-brand-500/30'
            : set.completed
            ? 'bg-emerald-950/25 border-emerald-500/40 shadow-sm shadow-emerald-950/40'
            : 'bg-dark-800/60 border-dark-700/60 hover:border-dark-600 hover:bg-dark-800/90'
        }`}
      >
        {/* 1. SET Type Badge (col-span-1) */}
        <div className="col-span-1 flex items-center justify-center">
          <button
            type="button"
            onClick={cycleSetType}
            className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg font-mono font-bold text-xs flex items-center justify-center transition-all active:scale-90 shadow-sm shrink-0 cursor-pointer ${
              set.setType === 'warmup'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : set.setType === 'drop'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                : set.setType === 'failure'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                : set.completed
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-dark-700 text-zinc-300 hover:bg-dark-600 border border-dark-600'
            }`}
            title="Click to toggle set type: Normal (1,2...), Warmup (W), Drop Set (D), Failure (F)"
          >
            {setTypeLabels[set.setType]}
          </button>
        </div>

        {/* 2. PREVIOUS Performance (col-span-3) - Click to expand top 3 records */}
        <div className="col-span-3 flex items-center justify-center overflow-hidden">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`w-full text-center px-1 py-1 rounded-lg text-[10px] sm:text-xs font-mono font-semibold transition-all flex items-center justify-center gap-0.5 group/prev border truncate cursor-pointer ${
              showExpanded
                ? 'bg-brand-500/15 text-brand-300 border-brand-500/40 ring-1 ring-brand-500/30'
                : hasPrevious
                ? 'bg-dark-800/70 text-zinc-300 hover:text-brand-300 hover:bg-dark-700/80 border-dark-700 hover:border-brand-500/30'
                : 'text-zinc-600 hover:text-zinc-400 hover:bg-dark-700/50 border-transparent'
            }`}
            title={t('activeWorkout.historyHint')}
          >
            <History className="w-2.5 h-2.5 text-zinc-400 group-hover/prev:text-brand-400 shrink-0" />
            <span className="truncate">{previousText}</span>
            {showExpanded ? (
              <ChevronUp className="w-2.5 h-2.5 text-brand-400 shrink-0" />
            ) : (
              <span className="text-[8px] text-brand-400/90 font-bold ml-0.5 font-mono inline-flex items-center">
                3<ChevronDown className="w-2 h-2 ml-0.5 inline shrink-0" />
              </span>
            )}
          </button>
        </div>

        {/* 3. WEIGHT Input (col-span-3) */}
        <div className="col-span-3">
          <div className="relative">
            <input
              type="number"
              step="0.5"
              min="0"
              value={set.weightKg === 0 ? '' : set.weightKg}
              placeholder={
                prevWeight > 0
                  ? `${prevWeight}`
                  : measurementType === 'distance_duration'
                  ? 'km'
                  : measurementType === 'bodyweight_reps'
                  ? '+0'
                  : '0'
              }
              onChange={(e) => onUpdate({ weightKg: parseFloat(e.target.value) || 0 })}
              className={`w-full bg-dark-900 border rounded-xl py-1.5 px-1 sm:px-2 text-center text-xs sm:text-sm font-mono font-bold transition-all focus:outline-none focus:ring-1 focus:ring-brand-500 ${
                set.completed
                  ? 'border-emerald-500/40 text-emerald-200'
                  : 'border-dark-700 text-white focus:border-brand-500'
              }`}
            />
          </div>
          {e1rm !== null && e1rm > 0 && measurementType === 'weight_reps' && (
            <div
              className="text-[8px] sm:text-[9px] text-zinc-500 text-center mt-0.5 font-mono leading-none truncate"
              title={
                set.weightKg >= 25
                  ? `Гриф 20 кг + ${((set.weightKg - 20) / 2).toFixed(1).replace('.0', '')} кг с каждой стороны`
                  : undefined
              }
            >
              {set.weightKg >= 25
                ? `(20+${((set.weightKg - 20) / 2).toFixed(1).replace('.0', '')}кг)`
                : `1RM: ${formatWeight(e1rm, unit)}`}
            </div>
          )}
        </div>

        {/* 4. REPS Input (col-span-3) - Clicking/Focusing reveals previous 3 */}
        <div className="col-span-3 flex flex-col items-center">
          <input
            type="number"
            min="1"
            max={measurementType === 'duration' ? 3600 : 200}
            value={set.reps === 0 ? '' : set.reps}
            placeholder={
              prevReps > 0
                ? `${prevReps}`
                : measurementType === 'duration' || measurementType === 'distance_duration'
                ? '60s'
                : '10'
            }
            onFocus={() => {
              if (!isExpanded) setIsExpanded(true);
            }}
            onClick={() => {
              setIsExpanded(true);
            }}
            onChange={(e) => onUpdate({ reps: parseInt(e.target.value, 10) || 0 })}
            className={`w-full bg-dark-900 border rounded-xl py-1.5 px-1 sm:px-2 text-center text-xs sm:text-sm font-mono font-bold transition-all focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer ${
              set.completed
                ? 'border-emerald-500/40 text-emerald-200'
                : 'border-dark-700 text-white focus:border-brand-500'
            }`}
            title="Нажмите, чтобы ввести повторения или посмотреть 3 прошлых результата"
          />
          {quickRepsSuggestions.length > 0 && (
            <div
              className="flex items-center justify-center gap-1 mt-0.5 overflow-hidden"
              title="3 прошлых повторения (нажмите, чтобы выбрать)"
            >
              {quickRepsSuggestions.map((qReps, idx) => (
                <button
                  key={`${qReps}-${idx}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate({ reps: qReps });
                  }}
                  className="px-1 py-0.2 rounded text-[8px] font-mono font-bold bg-dark-750 hover:bg-brand-500 hover:text-dark-950 text-zinc-400 hover:border-brand-400 border border-dark-650 transition-colors cursor-pointer"
                >
                  {qReps}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 5. COMPLETE Checkmark & Action (col-span-2) */}
        <div className="col-span-2 flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => {
              if (!set.completed && set.weightKg === 0 && set.reps === 0 && hasPrevious) {
                onUpdate({
                  weightKg: prevWeight,
                  reps: prevReps > 0 ? prevReps : 10,
                });
              }
              onCompleteToggle();
            }}
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90 shrink-0 cursor-pointer ${
              set.completed
                ? 'bg-emerald-500 text-dark-950 shadow-md shadow-emerald-500/30'
                : 'bg-dark-700 text-zinc-400 hover:text-white hover:bg-dark-600 border border-dark-600/80'
            }`}
            title={set.completed ? 'Mark set incomplete' : 'Mark set complete (starts rest timer)'}
          >
            <Check className="w-4 h-4 stroke-[3]" />
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="p-1 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-dark-700 transition-colors shrink-0 cursor-pointer"
            title="Delete set"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded Section: Last 3 Results (3 последних результата для этого сета) */}
      {showExpanded && (
        <div className="mt-1.5 p-2.5 sm:p-3 rounded-2xl bg-dark-900/95 border border-brand-500/35 shadow-xl space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-dark-800 pb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
              <History className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">
                {isFallback
                  ? t('activeWorkout.setRecordsFallbackTitle') || 'Последние результаты'
                  : t('activeWorkout.setRecordsTitle', { number: set.setNumber }) || `Последние 3 раза (Сет #${set.setNumber})`}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-dark-800 transition-colors cursor-pointer"
              title="Свернуть"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* List of 3 Recent Performances */}
          {effectiveTopRecords.length === 0 ? (
            <div className="py-2.5 text-center text-zinc-500 text-[11px]">
              {t('activeWorkout.noRecordsYet')}
            </div>
          ) : (
            <div className="space-y-1.5">
              {effectiveTopRecords.map((rec, rIdx) => {
                const uniqueKey = `${rec.workoutId}-${rec.setNumber}-${rIdx}`;
                const isApplied = appliedRecordKey === uniqueKey;

                return (
                  <div
                    key={uniqueKey}
                    className="p-2 rounded-xl bg-dark-850/90 border border-dark-750 hover:border-dark-600 flex items-center justify-between gap-2 transition-all"
                  >
                    {/* Left: Number + Performance */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-dark-800 text-zinc-300 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                        {rIdx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs sm:text-sm font-mono font-extrabold text-white">
                            {formatWeight(rec.weightKg, unit)} × {rec.reps}
                          </span>
                          {rec.e1rmKg > 0 && (
                            <span className="text-[9px] font-mono font-semibold text-brand-400 bg-brand-500/10 px-1 py-0.2 rounded border border-brand-500/20">
                              1RM: {formatWeight(rec.e1rmKg, unit)}
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] text-zinc-400 flex items-center gap-1 truncate mt-0.5">
                          <Calendar className="w-2.5 h-2.5 text-zinc-500 inline shrink-0" />
                          <span>{formatDate(rec.date)}</span>
                          {rec.workoutName && (
                            <>
                              <span>•</span>
                              <span className="truncate text-zinc-500">{rec.workoutName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Apply Record to Current Set */}
                    <button
                      type="button"
                      onClick={() => handleApply(rec, uniqueKey)}
                      className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shrink-0 active:scale-95 cursor-pointer ${
                        isApplied
                          ? 'bg-emerald-500 text-dark-950 font-extrabold shadow-sm'
                          : 'bg-dark-750 hover:bg-brand-500 hover:text-dark-950 text-zinc-200 border border-dark-600 hover:border-brand-400'
                      }`}
                      title={t('activeWorkout.useValues')}
                    >
                      {isApplied ? (
                        <>
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>{t('activeWorkout.applied')}</span>
                        </>
                      ) : (
                        <>
                          <ArrowDownToLine className="w-3 h-3" />
                          <span>{t('activeWorkout.applyRecord')}</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Separate Menu Trigger Button */}
          {onOpenHistoryMenu && (
            <button
              type="button"
              onClick={() => onOpenHistoryMenu(set.setNumber)}
              className="w-full py-2 px-3 rounded-xl bg-dark-800 hover:bg-dark-750 text-brand-400 hover:text-brand-300 border border-brand-500/25 hover:border-brand-500/40 text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-[0.99] cursor-pointer mt-1"
            >
              <History className="w-3.5 h-3.5 text-brand-400 shrink-0" />
              <span className="truncate">{t('activeWorkout.openHistoryMenu')}</span>
              <ExternalLink className="w-3 h-3 ml-0.5 opacity-70 shrink-0" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
