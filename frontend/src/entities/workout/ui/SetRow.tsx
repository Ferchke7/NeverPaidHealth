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
import { calculateE1RM, formatWeight, kgToLb, LB_TO_KG } from '../../../shared/lib/units.ts';
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
  isSelected?: boolean;
  showPlateMath?: boolean;
  onSelectSet?: () => void;
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
  isSelected = false,
  showPlateMath = false,
  onSelectSet,
  onOpenHistoryMenu,
  onUpdate,
  onDelete,
  onCompleteToggle,
}) => {
  const { t } = useTranslation();
  const unit = useAuthStore((s) => s.unitPreference);
  const e1rm = calculateE1RM(set.weightKg, set.reps);
  const usesPounds = unit === 'lb' && measurementType !== 'distance_duration';

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
  // Compute the 3 most recent performances for this set number
  const { recentRecords, isFallback } = useMemo(() => {
    return getLast3RecentForSet(allExerciseHistory, set.setNumber);
  }, [allExerciseHistory, set.setNumber]);

  // Only recorded performances belong in history; previous values remain input hints.
  const effectiveTopRecords = recentRecords;

  const previousText = useMemo(() => {
    if (hasPrevious) {
      return prevWeight > 0
        ? `${formatWeight(prevWeight, unit)} × ${prevReps}`
        : `${prevReps} reps`;
    }
    if (effectiveTopRecords.length > 0 && effectiveTopRecords[0].weightKg > 0) {
      return `${formatWeight(effectiveTopRecords[0].weightKg, unit)} × ${effectiveTopRecords[0].reps}`;
    }
    return '—';
  }, [hasPrevious, prevWeight, prevReps, unit, effectiveTopRecords]);

  // Plate math (e.g. 50kg -> (20+15кг), 25kg -> (20+2.5кг))
  const currentOrPrevWeight = set.weightKg > 0 ? set.weightKg : prevWeight;
  const plateText = useMemo(() => {
    if (measurementType !== 'weight_reps' || currentOrPrevWeight < 20) return null;
    if (currentOrPrevWeight === 20) return '(20кг)';
    const sideWeight = (currentOrPrevWeight - 20) / 2;
    return `(20+${sideWeight % 1 === 0 ? sideWeight.toFixed(0) : sideWeight.toFixed(1)}кг)`;
  }, [measurementType, currentOrPrevWeight]);

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
    <div
      onClick={() => onSelectSet?.()}
      className={`py-2.5 border-b border-[#ECEAF6] last:border-b-0 transition-colors ${
        isSelected ? 'bg-[#F5F3FF] -mx-2 px-2 rounded-[12px]' : ''
      }`}
    >
      {/* Top 4-Column Row: № | Вес, кг | Повторы | ✓ */}
      <div className="grid grid-cols-[28px_1fr_1fr_44px] gap-2.5 items-center">
        {/* 1. SET Type / Number Badge */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectSet?.();
              cycleSetType();
            }}
            className={`w-7 h-7 rounded-md font-semibold text-xs tabular-nums flex items-center justify-center transition-colors shrink-0 cursor-pointer border ${
              set.setType === 'warmup'
                ? 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]'
                : set.setType === 'drop'
                ? 'bg-[#ECFEFF] text-[#0891B2] border-[#A5F3FC]'
                : set.setType === 'failure'
                ? 'bg-[#FFF1F2] text-[#E11D48] border-[#FECDD3]'
                : set.completed
                ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
                : isSelected
                ? 'bg-[#F0EFFE] text-[#6D28D9] border-[#C4B5FD]'
                : 'bg-[#F8F7FC] text-[#1E1B4B] border-[#ECEAF6] hover:border-[#C4B5FD]'
            }`}
            title="Click to toggle set type: Normal (1,2...), Warmup (W), Drop Set (D), Failure (F)"
          >
            {setTypeLabels[set.setType]}
          </button>
        </div>

        {/* 2. WEIGHT Input */}
        <div>
          <input
            type="number"
            step="0.5"
            min="0"
            value={set.weightKg === 0 ? '' : usesPounds ? kgToLb(set.weightKg) : set.weightKg}
            placeholder={
              prevWeight > 0
                ? `${usesPounds ? kgToLb(prevWeight) : prevWeight}`
                : measurementType === 'distance_duration'
                ? 'km'
                : measurementType === 'bodyweight_reps'
                ? '+0'
                : '0'
            }
            onFocus={() => onSelectSet?.()}
            onChange={(e) => {
              const weight = Math.max(0, Number(e.target.value) || 0);
              onUpdate({ weightKg: usesPounds ? weight * LB_TO_KG : weight });
            }}
            className={`w-full h-11 bg-[#F8F7FC] border rounded-[10px] px-3 text-left text-sm font-semibold tabular-nums transition-colors focus:outline-none ${
              set.completed
                ? 'border-[#A7F3D0] bg-[#ECFDF5]/60 text-[#059669] focus:border-[#10B981]'
                : 'border-[#E2E0F0] text-[#1E1B4B] placeholder:text-[#94A3B8] focus:border-[#6D28D9]'
            }`}
          />
        </div>

        {/* 3. REPS Input */}
        <div>
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
            onFocus={() => onSelectSet?.()}
            onChange={(e) => onUpdate({ reps: parseInt(e.target.value, 10) || 0 })}
            className={`w-full h-11 bg-[#F8F7FC] border rounded-[10px] px-3 text-left text-sm font-semibold tabular-nums transition-colors focus:outline-none ${
              set.completed
                ? 'border-[#A7F3D0] bg-[#ECFDF5]/60 text-[#059669] focus:border-[#10B981]'
                : 'border-[#E2E0F0] text-[#1E1B4B] placeholder:text-[#94A3B8] focus:border-[#6D28D9]'
            }`}
          />
        </div>

        {/* 4. COMPLETE Checkbox (44x44 tap target, 22x22 visual square) */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectSet?.();
              if (!set.completed && set.weightKg === 0 && set.reps === 0 && hasPrevious) {
                onUpdate({
                  weightKg: prevWeight,
                  reps: prevReps > 0 ? prevReps : 10,
                });
              }
              onCompleteToggle();
            }}
            className="w-11 h-11 rounded-[10px] flex items-center justify-center cursor-pointer transition-colors hover:bg-[#F0EFFE]"
            title={set.completed ? 'Mark set incomplete' : 'Mark set complete (starts rest timer)'}
            aria-label={set.completed ? 'Mark set incomplete' : 'Mark set complete'}
          >
            <span
              className={`w-[22px] h-[22px] rounded-[6px] border flex items-center justify-center transition-colors ${
                set.completed
                  ? 'bg-[#10B981] border-[#10B981] text-white'
                  : 'bg-white border-[#CBD5E1] text-transparent hover:border-[#6D28D9]'
              }`}
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </span>
          </button>
        </div>
      </div>

      {/* Subtle Secondary Row: "Ранее: ..." + Plate/1RM + Delete */}
      <div className="flex items-center justify-between gap-2 mt-1.5 pl-[38px] pr-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectSet?.();
            setIsExpanded(!isExpanded);
          }}
          className="text-[11px] text-[#6B7280] hover:text-[#6D28D9] transition-colors flex items-center gap-1.5 min-w-0 truncate cursor-pointer"
          title={t('activeWorkout.historyHint')}
        >
          <span className="truncate">
            {t('activeWorkout.earlierPrefix', { value: previousText })}
          </span>
          {showPlateMath && plateText ? (
            <span className="text-[#6D28D9] font-medium shrink-0">· {plateText}</span>
          ) : !showPlateMath && e1rm !== null && e1rm > 0 && measurementType === 'weight_reps' && set.weightKg > 0 ? (
            <span className="text-[#94A3B8] shrink-0 hidden sm:inline">· 1RM {formatWeight(e1rm, unit)}</span>
          ) : null}
          {showExpanded ? (
            <ChevronUp className="w-3 h-3 text-[#6D28D9] shrink-0" />
          ) : (
            <ChevronDown className="w-3 h-3 text-[#94A3B8] shrink-0" />
          )}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 text-[#94A3B8] hover:text-[#E11D48] transition-colors cursor-pointer shrink-0 rounded-md hover:bg-[#FFF1F2]"
          title="Delete set"
          aria-label="Delete set"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Expanded Section: Last 3 Results */}
      {showExpanded && (
        <div className="mt-2 p-3 rounded-[14px] bg-[#F8F7FC] border border-[#ECEAF6] space-y-2.5">
          <div className="flex items-center justify-between border-b border-[#ECEAF6] pb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1E1B4B]">
              <History className="w-3.5 h-3.5 text-[#6D28D9] shrink-0" />
              <span className="truncate">
                {isFallback
                  ? t('activeWorkout.setRecordsFallbackTitle') || 'Последние результаты'
                  : t('activeWorkout.setRecordsTitle', { number: set.setNumber }) || `Последние 3 раза (Сет #${set.setNumber})`}
              </span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(false);
              }}
              className="p-1 text-[#6B7280] hover:text-[#1E1B4B] rounded-md hover:bg-white transition-colors cursor-pointer"
              title={t('common.close')}
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>

          {effectiveTopRecords.length === 0 ? (
            <div className="py-2 text-center text-[#94A3B8] text-xs">
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
                    className="p-2.5 rounded-[12px] bg-white border border-[#ECEAF6] flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-[#F0EFFE] border border-[#DDD6FE] text-[#6D28D9] text-[11px] font-semibold tabular-nums flex items-center justify-center shrink-0">
                        {rIdx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className="text-xs font-bold tabular-nums text-[#1E1B4B]">
                            {formatWeight(rec.weightKg, unit)} × {rec.reps}
                          </span>
                          {rec.e1rmKg > 0 && (
                            <span className="text-[10px] font-semibold tabular-nums text-[#059669] bg-[#ECFDF5] px-1.5 py-0.5 rounded border border-[#A7F3D0]">
                              1RM: {formatWeight(rec.e1rmKg, unit)}
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] text-[#6B7280] flex items-center gap-1 truncate mt-0.5">
                          <Calendar className="w-2.5 h-2.5 inline shrink-0" />
                          <span>{formatDate(rec.date)}</span>
                          {rec.workoutName && (
                            <>
                              <span>·</span>
                              <span className="truncate">{rec.workoutName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApply(rec, uniqueKey);
                      }}
                      className={`h-8 px-2.5 rounded-[8px] text-[11px] font-semibold transition-colors flex items-center gap-1 shrink-0 cursor-pointer border ${
                        isApplied
                          ? 'bg-[#10B981] text-white border-[#10B981]'
                          : 'bg-[#F8F7FC] hover:bg-[#F0EFFE] hover:text-[#6D28D9] text-[#1E1B4B] border-[#E2E0F0]'
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

          {onOpenHistoryMenu && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenHistoryMenu(set.setNumber);
              }}
              className="w-full h-9 px-3 rounded-[10px] bg-white hover:bg-[#F0EFFE] text-[#6D28D9] border border-[#DDD6FE] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <History className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t('activeWorkout.openHistoryMenu')}</span>
              <ExternalLink className="w-3 h-3 opacity-70 shrink-0" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
