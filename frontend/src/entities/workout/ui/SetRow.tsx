import React from 'react';
import { Check, Trash2, ArrowDownToLine } from 'lucide-react';
import { ActiveSet, SetType } from '../model/types.ts';
import { calculateE1RM, formatWeight } from '../../../shared/lib/units.ts';
import { useAuthStore } from '../../user/model/authStore.ts';

export interface PreviousSetData {
  weightKg: number;
  reps: number;
}

interface SetRowProps {
  set: ActiveSet;
  previousSet?: PreviousSetData | null;
  onUpdate: (updates: Partial<ActiveSet>) => void;
  onDelete: () => void;
  onCompleteToggle: () => void;
}

export const SetRow: React.FC<SetRowProps> = ({
  set,
  previousSet,
  onUpdate,
  onDelete,
  onCompleteToggle,
}) => {
  const unit = useAuthStore((s) => s.unitPreference);
  const e1rm = calculateE1RM(set.weightKg, set.reps);

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

  const handleCopyPrevious = () => {
    if (!previousSet) return;
    onUpdate({
      weightKg: Number(previousSet.weightKg) || 0,
      reps: Number(previousSet.reps) || 10,
    });
  };

  const hasPrevious = Boolean(
    previousSet && (Number(previousSet.weightKg) > 0 || Number(previousSet.reps) > 0)
  );
  const previousText = hasPrevious && previousSet
    ? `${formatWeight(Number(previousSet.weightKg) || 0, unit)} × ${Number(previousSet.reps) || 0}`
    : '—';

  return (
    <div
      className={`group grid grid-cols-12 gap-1.5 sm:gap-2 items-center py-1.5 sm:py-2 px-2 sm:px-2.5 rounded-xl border transition-all duration-200 ${
        set.completed
          ? 'bg-emerald-950/25 border-emerald-500/40 shadow-sm shadow-emerald-950/40'
          : 'bg-dark-800/60 border-dark-700/60 hover:border-dark-600 hover:bg-dark-800/90'
      }`}
    >
      {/* 1. SET Type Badge (col-span-2) */}
      <div className="col-span-2 flex items-center justify-center">
        <button
          type="button"
          onClick={cycleSetType}
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg font-mono font-bold text-xs flex items-center justify-center transition-all active:scale-90 shadow-sm shrink-0 ${
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

      {/* 2. PREVIOUS Performance (col-span-3) */}
      <div className="col-span-3 flex items-center justify-center overflow-hidden">
        {hasPrevious ? (
          <button
            type="button"
            onClick={handleCopyPrevious}
            className="w-full text-center px-1.5 py-1 rounded-lg text-[11px] sm:text-xs font-mono font-semibold text-zinc-400 hover:text-brand-300 hover:bg-dark-700/70 transition-all flex items-center justify-center gap-1 group/prev border border-transparent hover:border-brand-500/30 truncate"
            title="Click to auto-fill previous weight and reps"
          >
            <span className="truncate">{previousText}</span>
            <ArrowDownToLine className="w-2.5 h-2.5 text-zinc-500 group-hover/prev:text-brand-400 shrink-0 hidden sm:inline" />
          </button>
        ) : (
          <span className="text-xs font-mono text-zinc-600 text-center select-none">—</span>
        )}
      </div>

      {/* 3. WEIGHT Input (col-span-3) */}
      <div className="col-span-3">
        <div className="relative">
          <input
            type="number"
            step="0.5"
            min="0"
            value={set.weightKg === 0 ? '' : set.weightKg}
            placeholder={previousSet && previousSet.weightKg > 0 ? `${previousSet.weightKg}` : '0'}
            onChange={(e) => onUpdate({ weightKg: parseFloat(e.target.value) || 0 })}
            className={`w-full bg-dark-900 border rounded-xl py-1.5 px-1 sm:px-2 text-center text-xs sm:text-sm font-mono font-bold transition-all focus:outline-none focus:ring-1 focus:ring-brand-500 ${
              set.completed
                ? 'border-emerald-500/40 text-emerald-200'
                : 'border-dark-700 text-white focus:border-brand-500'
            }`}
          />
        </div>
        {e1rm !== null && e1rm > 0 && (
          <div className="text-[8px] sm:text-[9px] text-zinc-500 text-center mt-0.5 font-mono leading-none truncate">
            1RM: {formatWeight(e1rm, unit)}
          </div>
        )}
      </div>

      {/* 4. REPS Input (col-span-2) */}
      <div className="col-span-2">
        <input
          type="number"
          min="1"
          max="200"
          value={set.reps === 0 ? '' : set.reps}
          placeholder={previousSet && previousSet.reps > 0 ? `${previousSet.reps}` : '10'}
          onChange={(e) => onUpdate({ reps: parseInt(e.target.value, 10) || 0 })}
          className={`w-full bg-dark-900 border rounded-xl py-1.5 px-1 text-center text-xs sm:text-sm font-mono font-bold transition-all focus:outline-none focus:ring-1 focus:ring-brand-500 ${
            set.completed
              ? 'border-emerald-500/40 text-emerald-200'
              : 'border-dark-700 text-white focus:border-brand-500'
          }`}
        />
      </div>

      {/* 5. COMPLETE Checkmark & Action (col-span-2) */}
      <div className="col-span-2 flex items-center justify-center gap-1">
        <button
          type="button"
          onClick={onCompleteToggle}
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all duration-200 active:scale-90 shrink-0 ${
            set.completed
              ? 'bg-emerald-500 text-dark-950 shadow-md shadow-emerald-500/30'
              : 'bg-dark-700 text-zinc-500 hover:text-white hover:bg-dark-600 border border-dark-600/70'
          }`}
          title={set.completed ? 'Mark set incomplete' : 'Mark set complete (starts rest timer)'}
        >
          <Check className="w-4 h-4 stroke-[3]" />
        </button>

        {/* Delete button (clean, never overlaps checkmark) */}
        <button
          type="button"
          onClick={onDelete}
          className="p-1 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-dark-700 transition-colors shrink-0"
          title="Delete set"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
