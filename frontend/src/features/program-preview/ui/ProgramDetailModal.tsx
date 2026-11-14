import React, { useState } from 'react';
import {
  Play,
  HelpCircle,
  Edit3,
  Check,
  Users,
  Award,
  MessageCircle,
  Heart,
} from 'lucide-react';
import { Button } from '../../../shared/ui/button.tsx';
import { Modal } from '../../../shared/ui/modal.tsx';
import { Badge } from '../../../shared/ui/card.tsx';
import { ExerciseThumbnail } from '../../../entities/exercise/ui/ExerciseThumbnail.tsx';
import { ExerciseInfoModal } from '../../exercise-detail/ui/ExerciseInfoModal.tsx';
import { getExerciseVisual } from '../../../shared/lib/exerciseImages.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { Program, ProgramDay } from '../../../entities/program/model/types.ts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';

import { useStartWorkout } from '../../start-workout/model/useStartWorkout.ts';
import { InstagramCommentsModal } from './InstagramCommentsModal.tsx';
import { AthleteAvatar } from '../../../entities/user/ui/AthleteAvatar.tsx';
import { AthleteProfileModal } from '../../../entities/user/ui/AthleteProfileModal.tsx';

interface ProgramDetailModalProps {
  isOpen: boolean;
  program: Program | null;
  onClose: () => void;
  isActiveProgram?: boolean;
  isInstalled?: boolean;
  onEditProgram?: (program: Program) => void;
  onProgramInstalled?: () => void;
  onSelectProgram?: (program: Program) => void;
}

export const ProgramDetailModal: React.FC<ProgramDetailModalProps> = ({
  isOpen,
  program,
  onClose,
  isActiveProgram = false,
  isInstalled = false,
  onEditProgram,
  onProgramInstalled,
  onSelectProgram,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [inspectingExercise, setInspectingExercise] = useState<{
    name: string;
    muscle?: string;
  } | null>(null);
  const [selectedAthlete, setSelectedAthlete] = useState<{
    id: string;
    name?: string;
    avatar?: string;
  } | null>(null);

  const startWorkout = useStartWorkout();

  // Fetch program like status
  const { data: likeStatus } = useQuery<{ has_liked: boolean }>({
    queryKey: ['program-like-status', program?.id],
    queryFn: () => apiClient<{ has_liked: boolean }>(`/programs/${program?.id}/like`),
    enabled: isOpen && !!program?.id,
  });
  const hasLiked = likeStatus?.has_liked ?? false;

  const toggleLikeMutation = useMutation({
    mutationFn: async () => {
      if (!program) return;
      return apiClient<{ likes_count: number; has_liked: boolean }>(`/programs/${program.id}/like`, {
        method: 'POST',
      });
    },
    onSuccess: (res) => {
      if (res && program) {
        program.likes_count = res.likes_count;
      }
      void queryClient.invalidateQueries({ queryKey: ['program-like-status', program?.id] });
      void queryClient.invalidateQueries({ queryKey: ['programs'] });
    },
  });

  // Fetch comments count for this program
  const { data: rawComments } = useQuery<any[]>({
    queryKey: ['program-comments', program?.id],
    queryFn: () => apiClient<any[]>(`/programs/${program?.id}/comments`),
    enabled: isOpen && !!program?.id,
  });
  const comments = Array.isArray(rawComments) ? rawComments : [];

  const installMutation = useMutation({
    mutationFn: async ({ setActive }: { setActive: boolean }) => {
      if (!program) return;
      return apiClient(`/programs/${program.id}/install`, {
        method: 'POST',
        body: JSON.stringify({ set_active: setActive }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['programs'] });
      void queryClient.invalidateQueries({ queryKey: ['programs', 'active'] });
      void queryClient.invalidateQueries({ queryKey: ['programs', 'installed'] });
      if (onProgramInstalled) {
        onProgramInstalled();
      }
    },
  });

  if (!isOpen || !program) return null;

  const days: ProgramDay[] = program.days || [];
  const currentDay: ProgramDay | undefined = days[selectedDayIndex] || days[0];

  const handleStartDayWorkout = async (day: ProgramDay) => {
    onClose();
    await startWorkout({
      name: `${program.name} - ${day.name}`,
      exercises: day.exercises,
    });
  };

  const getSplitLabel = (type: string) => {
    switch (type) {
      case 'ppl':
        return t('programs.splitPpl');
      case 'upper_lower':
        return t('programs.splitUpperLower');
      case 'full_body':
        return t('programs.splitFullBody');
      case 'bro_split':
        return t('programs.splitBroSplit');
      default:
        return t('programs.splitCustom');
    }
  };

  const getLevelLabel = (lvl: string) => {
    switch (lvl) {
      case 'beginner':
        return t('programs.levelBeginner');
      case 'advanced':
        return t('programs.levelAdvanced');
      default:
        return t('programs.levelIntermediate');
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="xl"
        title={
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold text-white">{program.name}</span>
            <Badge variant="brand" size="sm">
              {getSplitLabel(program.split_type)}
            </Badge>
            <Badge variant="neutral" size="sm">
              {getLevelLabel(program.level)}
            </Badge>
            {isActiveProgram && (
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Check className="w-3 h-3" />
                {t('programs.activeSplit')}
              </span>
            )}
          </div>
        }
        subtitle={
          <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1 flex-wrap">
            {program.author_name ? (
              <button
                type="button"
                onClick={() =>
                  setSelectedAthlete({
                    id: program.user_id || '',
                    name: program.author_name,
                    avatar: program.author_avatar_url,
                  })
                }
                className="flex items-center gap-1.5 font-semibold text-zinc-300 hover:text-brand-400 transition-colors group cursor-pointer"
                title="Посмотреть профиль автора"
              >
                <AthleteAvatar
                  name={program.author_name}
                  avatarUrl={program.author_avatar_url}
                  size="xs"
                  className="ring-1 ring-zinc-700 group-hover:ring-brand-500 transition-all"
                />
                <span className="hover:underline">{program.author_name}</span>
              </button>
            ) : (
              <span>{t('programs.officialSplit')}</span>
            )}
            <span>•</span>
            <span>{t('programs.daysPerWeekCount', { count: program.days_per_week || days.length })}</span>
            {program.installs_count > 0 && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1 text-zinc-400">
                  <Users className="w-3 h-3 text-zinc-500" />
                  {program.installs_count}
                </span>
              </>
            )}
          </div>
        }
        footer={
          <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              {onEditProgram && (
                <Button
                  variant="outline"
                  size="sm"
                  className="font-bold text-xs flex items-center justify-center gap-1.5"
                  onClick={() => {
                    onClose();
                    onEditProgram(program);
                  }}
                >
                  <Edit3 className="w-3.5 h-3.5 text-brand-400" />
                  <span>{t('common.edit')}</span>
                </Button>
              )}

              {!isActiveProgram && (
                <Button
                  variant="outline"
                  size="sm"
                  isLoading={installMutation.isPending}
                  className="font-bold text-xs flex items-center justify-center gap-1.5 border-brand-500/30 text-brand-400 hover:bg-brand-500/10"
                  onClick={() => installMutation.mutate({ setActive: true })}
                >
                  <Award className="w-3.5 h-3.5 text-brand-400" />
                  <span>{isInstalled ? t('programs.setActiveProgram') : t('programs.installAndSetActive')}</span>
                </Button>
              )}
            </div>

            {currentDay && (
              <Button
                variant="primary"
                size="sm"
                className="font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20"
                onClick={() => handleStartDayWorkout(currentDay)}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>
                  {t('programs.startDayWorkout', {
                    day: currentDay.name || `${t('programs.dayShort')} ${selectedDayIndex + 1}`,
                  })}
                </span>
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {program.description && (
            <div className="bg-[#0a0a0a] p-3.5 rounded-[10px] border border-[#262626] text-[13px] text-[#a3a3a3]">
              <p>{program.description}</p>
            </div>
          )}

          {/* Days Tabs Header */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
                {t('programs.splitDaysOverview')}
              </span>
              <span className="text-[12px] text-[#a3a3a3] font-mono">
                {days.length} {t('programs.daysCount')}
              </span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {days.map((d, idx) => {
                const isSelected = idx === selectedDayIndex;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedDayIndex(idx)}
                    className={`h-[44px] px-3.5 rounded-[10px] text-[13px] font-medium transition-colors whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-[#022c22] text-[#34d399]'
                        : 'bg-[#0a0a0a] text-[#a3a3a3] hover:text-[#fafafa] border border-[#404040]'
                    }`}
                  >
                    <span>#{idx + 1}</span>
                    <span className="truncate max-w-[140px]">{d.name}</span>
                    <span className="text-[11px] opacity-75">
                      ({d.exercises?.length || 0})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current Day Exercise List */}
          {currentDay && (
            <div className="bg-[#0a0a0a] border border-[#404040] p-4 rounded-[14px] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#262626] pb-3">
                <div>
                  <h4 className="text-[15px] font-semibold text-[#fafafa]">
                    {t('programs.dayShort')} {selectedDayIndex + 1} · {currentDay.name}
                  </h4>
                  {currentDay.notes && (
                    <p className="text-[12px] text-[#a3a3a3] mt-0.5">{currentDay.notes}</p>
                  )}
                </div>

                <div className="text-[12px] text-[#a3a3a3]">
                  {currentDay.exercises?.length || 0} {t('programs.exercises')}
                </div>
              </div>

              <div className="divide-y divide-[#262626]">
                {currentDay.exercises && currentDay.exercises.length > 0 ? (
                  currentDay.exercises.map((ex, exIdx) => {
                    const exName = ex.exercise_name || 'Exercise';
                    const targetSets = ex.target_sets || 3;
                    const visual = getExerciseVisual(exName);
                    const primaryMuscle = visual.primaryMuscles[0] || 'Strength';

                    return (
                      <div
                        key={ex.exercise_id || exIdx}
                        className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 group"
                      >
                        <button
                          type="button"
                          className="cursor-pointer shrink-0"
                          onClick={() =>
                            setInspectingExercise({
                              name: exName,
                              muscle: primaryMuscle,
                            })
                          }
                          title={t('routines.viewTechnique')}
                        >
                          <ExerciseThumbnail
                            exerciseName={exName}
                            fallbackMuscle={primaryMuscle}
                            size="md"
                            className="rounded-[10px] border border-[#404040]"
                          />
                        </button>

                        <button
                          type="button"
                          className="flex-1 min-w-0 text-left cursor-pointer"
                          onClick={() =>
                            setInspectingExercise({
                              name: exName,
                              muscle: primaryMuscle,
                            })
                          }
                        >
                          <div className="text-[14px] font-medium text-[#fafafa] group-hover:text-[#34d399] transition-colors truncate">
                            {targetSets} × {exName}
                          </div>
                          <div className="text-[12px] text-[#a3a3a3] mt-0.5">
                            {primaryMuscle}
                            {ex.target_reps_min
                              ? ` · ${ex.target_reps_min}${
                                  ex.target_reps_max && ex.target_reps_max !== ex.target_reps_min
                                    ? `–${ex.target_reps_max}`
                                    : ''
                                } ${t('activeWorkout.reps')}`
                              : ''}
                          </div>
                        </button>

                        <Button
                          isIconOnly
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setInspectingExercise({
                              name: exName,
                              muscle: primaryMuscle,
                            })
                          }
                          title={t('routines.techniqueTooltip')}
                          aria-label={t('routines.techniqueTooltip')}
                        >
                          <HelpCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-6 text-[13px] text-[#a3a3a3]">
                    {t('programs.noExercisesInDay')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Discussion & Likes Bar (Screen 14 Discussion) */}
          <div className="bg-[#0a0a0a] border border-[#404040] p-4 rounded-[14px] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant={hasLiked ? 'flat' : 'outline'}
                  size="sm"
                  onClick={() => toggleLikeMutation.mutate()}
                >
                  <Heart
                    className={`w-4 h-4 ${
                      hasLiked ? 'fill-[#34d399] text-[#34d399]' : ''
                    }`}
                  />
                  <span>{program.likes_count || 0}</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCommentsOpen(true)}
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{comments.length}</span>
                </Button>
              </div>

              {isActiveProgram ? (
                <span className="text-[12px] font-medium text-[#34d399] bg-[#022c22] px-3 py-1.5 rounded-[8px]">
                  {t('programs.active')}
                </span>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => installMutation.mutate({ setActive: true })}
                  disabled={installMutation.isPending}
                >
                  {isInstalled ? t('programs.setActive') : t('programs.installShort')}
                </Button>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t border-[#262626]">
              {comments[0] && (
                <button
                  type="button"
                  onClick={() => setIsCommentsOpen(true)}
                  className="text-[12px] text-[#a3a3a3] hover:text-[#fafafa] text-left truncate block w-full cursor-pointer"
                >
                  <strong className="text-[#fafafa]">@{comments[0].author_name}:</strong>{' '}
                  {comments[0].content}
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsCommentsOpen(true)}
                className="w-full h-[40px] bg-[#171717] border border-[#404040] hover:border-[#525252] rounded-[10px] px-3.5 text-[13px] text-[#a3a3a3] flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>
                  {comments.length > 0
                    ? `Посмотреть все комментарии (${comments.length})...`
                    : 'Оставить первый комментарий...'}
                </span>
                <span className="text-[#34d399] font-medium text-[12px]">Открыть</span>
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Instagram Comments Sheet Modal (Separate popup like Instagram) */}
      <InstagramCommentsModal
        isOpen={isCommentsOpen}
        onClose={() => setIsCommentsOpen(false)}
        programId={program.id}
        programTitle={program.name}
        programAuthorId={program.user_id}
        onOpenAthlete={(athleteId, name, avatar) =>
          setSelectedAthlete({ id: athleteId, name, avatar })
        }
      />

      {/* Inspect Exercise Technique Modal */}
      {inspectingExercise && (
        <ExerciseInfoModal
          isOpen={true}
          onClose={() => setInspectingExercise(null)}
          exerciseName={inspectingExercise.name}
          fallbackMuscle={inspectingExercise.muscle}
        />
      )}

      {/* Athlete Profile Modal */}
      {selectedAthlete && (
        <AthleteProfileModal
          isOpen={!!selectedAthlete}
          onClose={() => setSelectedAthlete(null)}
          athleteId={selectedAthlete.id}
          fallbackName={selectedAthlete.name}
          fallbackAvatar={selectedAthlete.avatar}
          onSelectProgram={onSelectProgram}
        />
      )}
    </>
  );
};
