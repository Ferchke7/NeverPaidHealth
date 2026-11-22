import React from 'react';
import {
  Dumbbell,
  Award,
  Calendar,
  Layers,
  MessageCircle,
  Users,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Modal } from '../../../shared/ui/modal.tsx';
import { Badge } from '../../../shared/ui/card.tsx';
import { Button } from '../../../shared/ui/button.tsx';
import { AthleteAvatar } from './AthleteAvatar.tsx';
import { AthleteProfile, Program } from '../../program/model/types.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

interface AthleteProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  athleteId: string | null;
  fallbackName?: string;
  fallbackAvatar?: string;
  onSelectProgram?: (program: Program) => void;
}

export const AthleteProfileModal: React.FC<AthleteProfileModalProps> = ({
  isOpen,
  onClose,
  athleteId,
  fallbackName,
  fallbackAvatar,
  onSelectProgram,
}) => {
  const { t } = useTranslation();
  const isEnabled =
    isOpen && !!athleteId && athleteId !== '00000000-0000-0000-0000-000000000000';

  const { data: profile } = useQuery<AthleteProfile>({
    queryKey: ['athlete-profile', athleteId],
    queryFn: async () => {
      try {
        return await apiClient<AthleteProfile>(`/athletes/${athleteId}`);
      } catch {
        const userRes = await apiClient<{
          id: string;
          display_name: string;
          avatar_url: string;
          created_at: string;
        }>(`/profile/${athleteId}`);
        return {
          id: userRes.id,
          display_name: userRes.display_name,
          avatar_url: userRes.avatar_url,
          workouts_done: 0,
          total_volume_kg: 0,
          member_since: userRes.created_at,
          public_programs: [],
        };
      }
    },
    enabled: isEnabled,
  });

  if (!isOpen || !athleteId) return null;

  const displayName = profile?.display_name || fallbackName || t('profile.athleteFallback') || 'Атлет';
  const avatarUrl = profile?.avatar_url || fallbackAvatar || '';
  const workoutsDone = profile?.workouts_done ?? 0;
  const totalVolumeKg = profile?.total_volume_kg ?? 0;
  const memberSince = profile?.member_since ? new Date(profile.member_since) : null;
  const publicPrograms = profile?.public_programs ?? [];

  const formatVolume = (kg: number) => {
    if (kg >= 1000) {
      return `${(kg / 1000).toFixed(1)} ${t('summary.tons')}`;
    }
    return `${Math.round(kg)} ${t('common.kg')}`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#6D28D9]" />
          <span className="font-bold text-[#1E1B4B]">{displayName}</span>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Royal Violet Athlete Header Card */}
        <div className="royal-hero-gradient p-5 rounded-[20px] text-white flex flex-col sm:flex-row sm:items-center gap-4 text-center sm:text-left shadow-sm">
          <div className="flex justify-center sm:justify-start">
            <div className="p-1 rounded-full bg-white/20 ring-2 ring-white/40 shadow-md">
              <AthleteAvatar
                name={displayName}
                avatarUrl={avatarUrl}
                size="xl"
                className="w-16 h-16 sm:w-20 sm:h-20"
              />
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <h3 className="text-base sm:text-lg font-extrabold text-white truncate">
              {displayName}
            </h3>
            <p className="text-xs text-white/80 flex items-center justify-center sm:justify-start gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-white/75 shrink-0" />
              <span>
                {memberSince
                  ? memberSince.toLocaleDateString([], { month: 'long', year: 'numeric' })
                  : 'duda.uz'}
              </span>
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-[#F8F7FC] border border-[#ECEAF6] p-3 rounded-[14px] text-center space-y-0.5">
            <div className="text-[10px] uppercase font-bold tracking-wider text-[#6B7280] flex items-center justify-center gap-1">
              <Dumbbell className="w-3 h-3 text-[#6D28D9]" />
              <span>{t('nav.workouts')}</span>
            </div>
            <div className="text-lg font-bold tabular-nums text-[#1E1B4B]">{workoutsDone}</div>
          </div>

          <div className="bg-[#F8F7FC] border border-[#ECEAF6] p-3 rounded-[14px] text-center space-y-0.5">
            <div className="text-[10px] uppercase font-bold tracking-wider text-[#6B7280] flex items-center justify-center gap-1">
              <Award className="w-3 h-3 text-[#6D28D9]" />
              <span>{t('summary.totalVolume')}</span>
            </div>
            <div className="text-sm sm:text-base font-bold tabular-nums text-[#6D28D9] truncate">
              {formatVolume(totalVolumeKg)}
            </div>
          </div>

          <div className="bg-[#F8F7FC] border border-[#ECEAF6] p-3 rounded-[14px] text-center space-y-0.5">
            <div className="text-[10px] uppercase font-bold tracking-wider text-[#6B7280] flex items-center justify-center gap-1">
              <Layers className="w-3 h-3 text-[#6D28D9]" />
              <span>{t('nav.programs')}</span>
            </div>
            <div className="text-lg font-bold tabular-nums text-[#1E1B4B]">
              {publicPrograms.length}
            </div>
          </div>
        </div>

        {/* Public Programs Section */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs font-bold text-[#6B7280]">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <Layers className="w-3.5 h-3.5 text-[#6D28D9]" />
              <span>
                {t('nav.programs')} ({publicPrograms.length})
              </span>
            </span>
          </div>

          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
            {publicPrograms.length === 0 ? (
              <div className="text-center py-6 bg-[#F8F7FC] border border-dashed border-[#DDD6FE] rounded-[14px] text-xs text-[#6B7280]">
                {t('programs.emptyState')}
              </div>
            ) : (
              publicPrograms.map((prog) => (
                <div
                  key={prog.id}
                  className="bg-[#F8F7FC] border border-[#ECEAF6] hover:border-[#C4B5FD] p-3.5 rounded-[14px] transition-all space-y-2 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-[#1E1B4B] group-hover:text-[#6D28D9] transition-colors truncate">
                          {prog.name}
                        </span>
                        <Badge variant="brand" size="sm">
                          {prog.split_type}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2.5 text-[11px] text-[#6B7280] font-medium">
                        <span>
                          {t('programs.daysPerWeek', {
                            days: prog.days_per_week || prog.days?.length || 0,
                          })}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-[#6D28D9]" />
                          <span>{prog.installs_count || 0}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3 text-[#0891B2]" />
                          <span>{prog.comments_count || 0}</span>
                        </span>
                      </div>
                    </div>

                    {onSelectProgram && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs font-semibold shrink-0 flex items-center gap-1"
                        onClick={() => {
                          onClose();
                          onSelectProgram(prog);
                        }}
                      >
                        <span>{t('workouts.openProgram')}</span>
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
