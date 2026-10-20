import React from 'react';
import {
  Dumbbell,
  Award,
  Calendar,
  Layers,
  Heart,
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
  const isEnabled = isOpen && !!athleteId && athleteId !== '00000000-0000-0000-0000-000000000000';

  const { data: profile } = useQuery<AthleteProfile>({
    queryKey: ['athlete-profile', athleteId],
    queryFn: async () => {
      try {
        return await apiClient<AthleteProfile>(`/athletes/${athleteId}`);
      } catch (err) {
        // Fallback to basic public profile if training athlete stats 404
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

  const displayName = profile?.display_name || fallbackName || 'Атлет';
  const avatarUrl = profile?.avatar_url || fallbackAvatar || '';
  const workoutsDone = profile?.workouts_done ?? 0;
  const totalVolumeKg = profile?.total_volume_kg ?? 0;
  const memberSince = profile?.member_since ? new Date(profile.member_since) : null;
  const publicPrograms = profile?.public_programs ?? [];

  const formatVolume = (kg: number) => {
    if (kg >= 1000000) {
      return `${(kg / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} т`;
    }
    if (kg >= 1000) {
      return `${Math.round(kg).toLocaleString('ru-RU')} кг`;
    }
    return `${Math.round(kg)} кг`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-brand-400" />
          <span className="font-extrabold text-white">Профиль атлета</span>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Athlete Header Card */}
        <div className="bg-gradient-to-b from-dark-800 to-dark-900 border border-dark-750 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4 text-center sm:text-left">
          <div className="flex justify-center sm:justify-start">
            <div className="p-1 rounded-full bg-dark-700/80 ring-2 ring-brand-500/30 shadow-md">
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
            <p className="text-xs text-zinc-400 flex items-center justify-center sm:justify-start gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span>
                {memberSince
                  ? `С нами с ${memberSince.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}`
                  : 'Участник сообщества'}
              </span>
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-dark-900/90 border border-dark-750 p-3 rounded-xl text-center space-y-0.5">
            <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 flex items-center justify-center gap-1">
              <Dumbbell className="w-3 h-3 text-brand-400" />
              <span>Тренировки</span>
            </div>
            <div className="text-lg font-mono font-extrabold text-white">
              {workoutsDone}
            </div>
          </div>

          <div className="bg-dark-900/90 border border-dark-750 p-3 rounded-xl text-center space-y-0.5">
            <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 flex items-center justify-center gap-1">
              <Award className="w-3 h-3 text-brand-400" />
              <span>Тоннаж</span>
            </div>
            <div className="text-sm sm:text-base font-mono font-extrabold text-brand-400 truncate">
              {formatVolume(totalVolumeKg)}
            </div>
          </div>

          <div className="bg-dark-900/90 border border-dark-750 p-3 rounded-xl text-center space-y-0.5">
            <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 flex items-center justify-center gap-1">
              <Layers className="w-3 h-3 text-brand-400" />
              <span>Сплиты</span>
            </div>
            <div className="text-lg font-mono font-extrabold text-white">
              {publicPrograms.length}
            </div>
          </div>
        </div>

        {/* Public Programs Section */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-300">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-zinc-400">
              <Layers className="w-3.5 h-3.5 text-brand-400" />
              <span>Публичные программы атлета ({publicPrograms.length})</span>
            </span>
          </div>

          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
            {publicPrograms.length === 0 ? (
              <div className="text-center py-6 bg-dark-900/50 border border-dashed border-dark-800 rounded-xl text-xs text-zinc-500">
                У атлета пока нет опубликованных программ
              </div>
            ) : (
              publicPrograms.map((prog) => (
                <div
                  key={prog.id}
                  className="bg-dark-900/80 border border-dark-750 hover:border-brand-500/40 p-3 rounded-xl transition-all space-y-2 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-white group-hover:text-brand-400 transition-colors truncate">
                          {prog.name}
                        </span>
                        <Badge variant="brand" size="sm">
                          {prog.split_type}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                        <span>{prog.days_per_week || prog.days?.length || 0} дн/нед</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                          <span>{prog.likes_count || 0}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-zinc-500" />
                          <span>{prog.installs_count || 0}</span>
                        </span>
                      </div>
                    </div>

                    {onSelectProgram && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs font-bold shrink-0 flex items-center gap-1 border-brand-500/30 text-brand-400 hover:bg-brand-500/10"
                        onClick={() => {
                          onClose();
                          onSelectProgram(prog);
                        }}
                      >
                        <span>Открыть</span>
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
