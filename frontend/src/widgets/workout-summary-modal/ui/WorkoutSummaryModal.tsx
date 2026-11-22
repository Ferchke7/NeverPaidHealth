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
      ? `${(summary.totalVolumeKg / 1000).toFixed(2).replace('.', ',')} ${t('summary.tons')}`
      : formatWeight(summary.totalVolumeKg, unitPref);

  const subtitleLabel = `${summary.name} · ${summary.exerciseCount} ${t('summary.exercisesShort')} · ${summary.completedSetsCount} ${t('summary.setsShort')}`;

  return (
    <Modal
      isOpen={!!summary}
      onClose={onClose}
      size="md"
      title={t('summary.wellDoneTitle')}
      subtitle={subtitleLabel}
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
        {/* Figma E-Wallet Receipt Header Card */}
        <div className="relative overflow-hidden rounded-[22px] border border-[#ECEAF6] bg-white royal-card-shadow">
          <div className="royal-hero-gradient px-5 pt-5 pb-10 text-center">
            <div className="text-[28px] font-extrabold tracking-tight text-white tabular-nums">
              {formattedCompactVolume}
            </div>
          </div>

          <div className="-mt-6 px-5 pb-5">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#10B981] text-white flex items-center justify-center ring-4 ring-white shadow-md">
              <CheckCircle className="w-6 h-6 stroke-[2.5]" />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-[#F8F7FC] border border-[#ECEAF6] rounded-[14px] p-3.5 text-center">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] block">
                  {t('summary.totalVolume')}
                </span>
                <span className="text-xl font-bold tabular-nums text-[#1E1B4B] block mt-1">
                  {formattedCompactVolume}
                </span>
                <span className="text-[11px] text-[#94A3B8] block mt-1">
                  {t('summary.exactVolume', { volume: formatWeight(summary.totalVolumeKg, unitPref) })}
                </span>
              </div>

              <div className="bg-[#F8F7FC] border border-[#ECEAF6] rounded-[14px] p-3.5 text-center">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] block">
                  {t('summary.time')}
                </span>
                <span className="text-xl font-bold tabular-nums text-[#1E1B4B] block mt-1">
                  {formatDuration(summary.durationSeconds)}
                </span>
                <span className="text-[11px] text-[#94A3B8] block mt-1">
                  {t('summary.sets')}: {summary.completedSetsCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Exercise Breakdown Rows */}
        {summary.exercises && summary.exercises.length > 0 && (
          <div className="bg-[#F8F7FC] border border-[#ECEAF6] rounded-[16px] px-4 py-1 divide-y divide-[#ECEAF6]">
            {summary.exercises.map((ex, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-[#1E1B4B] truncate">
                  {ex.exerciseName}
                </span>
                <span className="text-xs font-medium text-[#6B7280] tabular-nums shrink-0">
                  {ex.setsCount} · {formatWeight(ex.volumeKg, unitPref)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* PRs Section */}
        {summary.prs && summary.prs.length > 0 && (
          <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-[16px] p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-[#059669] font-bold text-xs uppercase tracking-wider">
              <Trophy className="w-4 h-4" />
              {t('summary.newPRs', { count: summary.prs.length })}
            </div>
            <div className="space-y-1.5">
              {summary.prs.map((pr, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs bg-white p-2.5 rounded-[12px] border border-[#D1FAE5]"
                >
                  <span className="text-[#1E1B4B] font-semibold">{pr.exerciseName}</span>
                  <span className="text-[#059669] font-bold tabular-nums">{pr.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-[#059669] bg-[#ECFDF5] py-2.5 px-3.5 rounded-[12px] border border-[#A7F3D0]">
            <CheckCircle className="w-4 h-4 text-[#10B981] shrink-0" />
            <span>{t('summary.autoSavedBadge')}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#6B7280] bg-[#F8F7FC] py-2.5 px-3.5 rounded-[12px] border border-[#ECEAF6]">
            <CheckCircle className="w-4 h-4 text-[#6D28D9] shrink-0" />
            <span>{t('summary.savedStats')}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};
