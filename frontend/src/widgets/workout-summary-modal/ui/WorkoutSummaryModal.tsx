import React from 'react';
import { Trophy, CheckCircle } from 'lucide-react';
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
  exercises?: {
    exerciseName: string;
    setsCount: number;
    volumeKg: number;
  }[];
  prs?: {
    exerciseName: string;
    prType: string;
    value: string;
  }[];
}

interface WorkoutSummaryModalProps {
  summary: FinishedWorkoutSummary | null;
  onClose: () => void;
  onViewHistory?: () => void;
}

export const WorkoutSummaryModal: React.FC<WorkoutSummaryModalProps> = ({
  summary,
  onClose,
  onViewHistory,
}) => {
  const { t } = useTranslation();
  const unitPref = useAuthStore((s) => s.unitPreference);

  if (!summary) return null;

  const formattedCompactVolume =
    unitPref !== 'lb' && summary.totalVolumeKg >= 1000
      ? `${(summary.totalVolumeKg / 1000).toFixed(2).replace('.', ',')} т`
      : formatWeight(summary.totalVolumeKg, unitPref);

  return (
    <Modal
      isOpen={!!summary}
      onClose={onClose}
      size="md"
      title={t('summary.wellDoneTitle')}
      subtitle={`${summary.name} · ${summary.exerciseCount} · ${summary.completedSetsCount}`}
      footer={
        <div className="flex flex-wrap items-center gap-2.5 w-full">
          <Button variant="primary" size="md" className="flex-1" onClick={onClose}>
            {t('summary.done')}
          </Button>
          {onViewHistory && (
            <Button variant="outline" size="md" className="flex-1" onClick={onViewHistory}>
              {t('summary.viewHistory')}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#34d399]">
          {t('summary.finishEyebrow')}
        </div>

        {/* 2 Primary KPI Blocks (1:1 Figma 15 State Card 02) */}
        <div className="grid grid-cols-2 gap-3 pb-3 border-b border-[#262626]">
          <div className="bg-[#0a0a0a] border border-[#262626] rounded-[12px] p-3.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#a3a3a3] block">
              {t('summary.totalVolume')}
            </span>
            <span className="text-2xl font-bold tabular-nums text-[#fafafa] block mt-1">
              {formattedCompactVolume}
            </span>
            <span className="text-[11px] text-[#737373] block mt-1">
              {t('summary.exactVolume', { volume: formatWeight(summary.totalVolumeKg, unitPref) })}
            </span>
          </div>

          <div className="bg-[#0a0a0a] border border-[#262626] rounded-[12px] p-3.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#a3a3a3] block">
              {t('summary.time')}
            </span>
            <span className="text-2xl font-bold tabular-nums text-[#fafafa] block mt-1">
              {formatDuration(summary.durationSeconds)}
            </span>
            <span className="text-[11px] text-[#737373] block mt-1">
              {t('summary.sets')}: {summary.completedSetsCount}
            </span>
          </div>
        </div>

        {/* Exercise Breakdown Rows */}
        {summary.exercises && summary.exercises.length > 0 && (
          <div className="divide-y divide-[#262626]">
            {summary.exercises.map((ex, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-[#fafafa] truncate">
                  {ex.exerciseName}
                </span>
                <span className="text-xs text-[#a3a3a3] tabular-nums shrink-0">
                  {ex.setsCount} · {formatWeight(ex.volumeKg, unitPref)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* PRs Section */}
        {summary.prs && summary.prs.length > 0 && (
          <div className="bg-[#0a0a0a] border border-[#064e3b] rounded-[12px] p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-[#34d399] font-semibold text-xs uppercase tracking-wider">
              <Trophy className="w-4 h-4" />
              {t('summary.newPRs', { count: summary.prs.length })}
            </div>
            <div className="space-y-1.5">
              {summary.prs.map((pr, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs bg-[#171717] p-2.5 rounded-[10px] border border-[#262626]"
                >
                  <span className="text-[#fafafa] font-medium">{pr.exerciseName}</span>
                  <span className="text-[#34d399] font-semibold tabular-nums">{pr.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-[#a3a3a3] bg-[#0a0a0a] py-2.5 px-3.5 rounded-[12px] border border-[#262626]">
          <CheckCircle className="w-4 h-4 text-[#34d399] shrink-0" />
          <span>{t('summary.savedStats')}</span>
        </div>
      </div>
    </Modal>
  );
};
