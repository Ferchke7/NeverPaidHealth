import React from 'react';
import { Trophy, Clock, Flame, Dumbbell, CheckCircle } from 'lucide-react';
import { Button } from '../../../shared/ui/button.tsx';
import { Modal } from '../../../shared/ui/modal.tsx';
import { formatDuration } from '../../../shared/lib/dates.ts';
import { formatWeight } from '../../../shared/lib/units.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

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
  const { t } = useTranslation();
  const unitPref = useAuthStore((s) => s.unitPreference);

  if (!summary) return null;

  return (
    <Modal
      isOpen={!!summary}
      onClose={onClose}
      size="md"
      icon={
        <div className="w-10 h-10 rounded-2xl bg-brand-500/20 border border-brand-500/40 text-brand-400 flex items-center justify-center shadow-lg shadow-brand-500/10">
          <Trophy className="w-5 h-5" />
        </div>
      }
      title={t('summary.workoutFinished')}
      subtitle={summary.name}
      footer={
        <Button
          variant="primary"
          className="w-full font-bold shadow-lg shadow-brand-500/20"
          onClick={onClose}
        >
          {t('summary.awesome')}
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-dark-900 border border-dark-750 rounded-2xl p-3 text-center">
            <div className="flex items-center justify-center text-blue-400 mb-1">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-[11px] text-zinc-400 block">{t('summary.time')}</span>
            <span className="text-sm font-black font-mono text-white">
              {formatDuration(summary.durationSeconds)}
            </span>
          </div>

          <div className="bg-dark-900 border border-dark-750 rounded-2xl p-3 text-center">
            <div className="flex items-center justify-center text-emerald-400 mb-1">
              <Flame className="w-4 h-4" />
            </div>
            <span className="text-[11px] text-zinc-400 block">{t('summary.totalVolume')}</span>
            <span className="text-sm font-black font-mono text-white">
              {formatWeight(summary.totalVolumeKg, unitPref)}
            </span>
          </div>

          <div className="bg-dark-900 border border-dark-750 rounded-2xl p-3 text-center">
            <div className="flex items-center justify-center text-brand-400 mb-1">
              <Dumbbell className="w-4 h-4" />
            </div>
            <span className="text-[11px] text-zinc-400 block">{t('summary.sets')}</span>
            <span className="text-sm font-black font-mono text-white">
              {summary.completedSetsCount}
            </span>
          </div>
        </div>

        {/* PRs Section */}
        {summary.prs && summary.prs.length > 0 && (
          <div className="bg-brand-950/30 border border-brand-800/40 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-brand-400 font-bold text-xs uppercase tracking-wider">
              <Trophy className="w-4 h-4" />
              {t('summary.newPRs', { count: summary.prs.length })}
            </div>
            <div className="space-y-1.5">
              {summary.prs.map((pr, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs bg-dark-900/80 p-2 rounded-xl border border-dark-800"
                >
                  <span className="text-zinc-200 font-medium">{pr.exerciseName}</span>
                  <span className="text-brand-400 font-bold font-mono">{pr.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 bg-dark-900/60 py-2.5 px-4 rounded-2xl border border-dark-750">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{t('summary.savedStats')}</span>
        </div>
      </div>
    </Modal>
  );
};
