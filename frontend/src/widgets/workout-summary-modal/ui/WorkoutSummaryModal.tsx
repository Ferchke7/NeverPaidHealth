import React from 'react';
import { Trophy, Clock, Flame, Dumbbell, CheckCircle, X } from 'lucide-react';
import { Button } from '../../../shared/ui/button.tsx';
import { formatDuration } from '../../../shared/lib/dates.ts';
import { formatWeight } from '../../../shared/lib/units.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';

export interface FinishedWorkoutSummary {
  id: string;
  name: string;
  durationSeconds: number;
  totalVolumeKg: number;
  completedSetsCount: number;
  exerciseCount: number;
  prs?: {
    exerciseName: string;
    prType: string;
    value: string;
  }[];
}

interface WorkoutSummaryModalProps {
  summary: FinishedWorkoutSummary | null;
  onClose: () => void;
}

export const WorkoutSummaryModal: React.FC<WorkoutSummaryModalProps> = ({
  summary,
  onClose,
}) => {
  const unitPref = useAuthStore((s) => s.unitPreference);

  if (!summary) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-dark-900 border border-brand-500/30 w-full max-w-md rounded-2xl flex flex-col shadow-2xl overflow-hidden relative">
        {/* Glow accent */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-40 bg-brand-500/20 blur-3xl rounded-full pointer-events-none" />

        {/* Header */}
        <div className="p-6 text-center border-b border-dark-800 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-16 h-16 rounded-2xl bg-brand-500/20 border border-brand-500/40 text-brand-400 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-brand-500/10">
            <Trophy className="w-8 h-8 animate-bounce" />
          </div>

          <h2 className="text-2xl font-black tracking-tight text-white">Workout Complete!</h2>
          <p className="text-sm text-zinc-400 mt-1">{summary.name}</p>
        </div>

        {/* Stats Grid */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center text-blue-400 mb-1">
                <Clock className="w-4 h-4" />
              </div>
              <span className="text-xs text-zinc-400 block">Time</span>
              <span className="text-base font-black font-mono text-white">
                {formatDuration(summary.durationSeconds)}
              </span>
            </div>

            <div className="bg-dark-800 border border-dark-700 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center text-emerald-400 mb-1">
                <Flame className="w-4 h-4" />
              </div>
              <span className="text-xs text-zinc-400 block">Volume</span>
              <span className="text-base font-black font-mono text-white">
                {formatWeight(summary.totalVolumeKg, unitPref)}
              </span>
            </div>

            <div className="bg-dark-800 border border-dark-700 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center text-brand-400 mb-1">
                <Dumbbell className="w-4 h-4" />
              </div>
              <span className="text-xs text-zinc-400 block">Sets</span>
              <span className="text-base font-black font-mono text-white">
                {summary.completedSetsCount}
              </span>
            </div>
          </div>

          {/* PRs Section */}
          {summary.prs && summary.prs.length > 0 && (
            <div className="bg-brand-950/30 border border-brand-800/40 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-brand-400 font-bold text-xs uppercase tracking-wider">
                <Trophy className="w-4 h-4" />
                New Personal Records ({summary.prs.length})
              </div>
              <div className="space-y-1.5">
                {summary.prs.map((pr, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs bg-dark-900/60 p-2 rounded-lg"
                  >
                    <span className="text-zinc-200 font-medium">{pr.exerciseName}</span>
                    <span className="text-brand-400 font-bold font-mono">{pr.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 bg-dark-800/50 py-2.5 px-4 rounded-xl border border-dark-700">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Workout saved & progress metrics updated</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-dark-800 bg-dark-900/60 flex items-center gap-3">
          <Button
            variant="primary"
            className="w-full font-bold"
            onClick={onClose}
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};
