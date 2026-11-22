import React, { useState } from 'react';
import {
  Play,
  HelpCircle,
  Edit3,
  Check,
  Users,
  Award,
  MessageCircle,
  CheckCircle2,
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
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { applyProgramOverride } from '../../../entities/program/model/programWorkoutSync.ts';

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
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [quickComment, setQuickComment] = useState('');
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

  // Fetch comments count for this program
  const { data: rawComments } = useQuery<any[]>({
    queryKey: ['program-comments', program?.id],
    queryFn: () => apiClient<any[]>(`/programs/${program?.id}/comments`),
    enabled: isOpen && !!program?.id,
  });
  const comments = Array.isArray(rawComments) ? rawComments : [];

  const quickCommentMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!program || !text.trim()) return;
      try {
        return await apiClient(`/programs/${program.id}/comments`, {
          method: 'POST',
          body: JSON.stringify({
            content: text.trim(),
            parent_id: null,
            author_name: user?.display_name || 'Атлет',
            avatar_url: user?.avatar_url || '',
          }),
        });
      } catch {
        const key = `np_program_comments_${program.id}`;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        const created = {
          id: `local-${Date.now()}`,
          program_id: program.id,
          user_id: user?.id || 'local-user',
          author_name: user?.display_name || 'Атлет',
          avatar_url: user?.avatar_url || '',
          parent_id: null,
          content: text.trim(),
          upvotes: 0,
          has_upvoted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: false,
        };
        localStorage.setItem(key, JSON.stringify([...existing, created]));
        return created;
      }
    },
    onSuccess: () => {
      setQuickComment('');
      void queryClient.invalidateQueries({ queryKey: ['program-comments', program?.id] });
      void queryClient.invalidateQueries({ queryKey: ['programs'] });
    },
  });

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

  const effectiveProgram = applyProgramOverride(program) || program;
  const days: ProgramDay[] = effectiveProgram.days || [];
  const currentDay: ProgramDay | undefined = days[selectedDayIndex] || days[0];

  const handleStartDayWorkout = async (day: ProgramDay) => {
    onClose();
    await startWorkout({
      name: `${effectiveProgram.name} - ${day.name}`,
      programId: effectiveProgram.id,
      programDayNumber: day.day_number || selectedDayIndex + 1,
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
        isOpen={isOpen && !isCommentsOpen && !inspectingExercise && !selectedAthlete}
        onClose={onClose}
        size="xl"
        title={
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[#1E1B4B]">{program.name}</span>
            <Badge variant="brand" size="sm">
              {getSplitLabel(program.split_type)}
            </Badge>
            <Badge variant="neutral" size="sm">
              {getLevelLabel(program.level)}
            </Badge>
            {isActiveProgram && (
              <span className="bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Check className="w-3 h-3" />
                {t('programs.activeSplit')}
              </span>
            )}
          </div>
        }
        subtitle={
          <div className="flex items-center gap-2 text-xs text-[#6B7280] mt-1 flex-wrap">
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
                className="flex items-center gap-1.5 font-semibold text-[#1E1B4B] hover:text-[#6D28D9] transition-colors group cursor-pointer"
                title={t('profile.subtitle')}
              >
                <AthleteAvatar
                  name={program.author_name}
                  avatarUrl={program.author_avatar_url}
                  size="xs"
                  className="ring-1 ring-[#DDD6FE] group-hover:ring-[#6D28D9] transition-all"
                />
                <span className="hover:underline">{program.author_name}</span>
              </button>
            ) : (
              <span>{t('programs.officialSplit')}</span>
            )}
            <span>•</span>
            <span>{t('programs.daysPerWeekCount', { count: program.days_per_week || days.length })}</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-[#6D28D9] font-semibold">
              <Users className="w-3 h-3" />
              {program.installs_count || 0}
            </span>
          </div>
        }
        footer={
          <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              {onEditProgram && (
                <Button
                  variant="outline"
                  size="sm"
                  className="font-semibold text-xs flex items-center justify-center gap-1.5"
                  onClick={() => {
                    onClose();
                    onEditProgram(program);
                  }}
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#6D28D9]" />
                  <span>{t('common.edit')}</span>
                </Button>
              )}

              {!isActiveProgram && (
                <Button
                  variant="outline"
                  size="sm"
                  isLoading={installMutation.isPending}
                  className="font-semibold text-xs flex items-center justify-center gap-1.5 border-[#DDD6FE] text-[#6D28D9] hover:bg-[#F0EFFE]"
                  onClick={() => installMutation.mutate({ setActive: true })}
                >
                  <Award className="w-3.5 h-3.5 text-[#6D28D9]" />
                  <span>{isInstalled ? t('programs.setActiveProgram') : t('programs.installAndSetActive')}</span>
                </Button>
              )}
            </div>

            {currentDay && (
              <Button
                variant="primary"
                size="sm"
                className="font-bold text-xs flex items-center justify-center gap-2"
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
          {isActiveProgram && (
            <div className="flex items-center gap-2 bg-[#ECFDF5] border border-[#A7F3D0] text-[#059669] px-3.5 py-2.5 rounded-[12px] text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#10B981]" />
              <span>{t('programs.personalCopyAutoSave')}</span>
            </div>
          )}

          {program.description && (
            <div className="bg-[#F8F7FC] p-3.5 rounded-[12px] border border-[#ECEAF6] text-[13px] text-[#6B7280]">
              <p>{program.description}</p>
            </div>
          )}

          {/* Days Tabs Header */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[#6B7280]">
                {t('programs.splitDaysOverview')}
              </span>
              <span className="text-[12px] text-[#6B7280] font-mono">
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
                    className={`h-[42px] px-3.5 rounded-[12px] text-[13px] font-semibold transition-colors whitespace-nowrap flex items-center gap-2 cursor-pointer border ${
                      isSelected
                        ? 'bg-[#6D28D9] text-white border-[#6D28D9]'
                        : 'bg-[#F8F7FC] text-[#6B7280] hover:text-[#1E1B4B] border-[#ECEAF6]'
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
            <div className="bg-[#F8F7FC] border border-[#ECEAF6] p-4 rounded-[16px] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#ECEAF6] pb-3">
                <div>
                  <h4 className="text-[15px] font-bold text-[#1E1B4B]">
                    {t('programs.dayShort')} {selectedDayIndex + 1} · {currentDay.name}
                  </h4>
                  {currentDay.notes && (
                    <p className="text-[12px] text-[#6B7280] mt-0.5">{currentDay.notes}</p>
                  )}
                </div>

                <div className="text-[12px] font-semibold text-[#6D28D9]">
                  {currentDay.exercises?.length || 0} {t('programs.exercises')}
                </div>
              </div>

              <div className="divide-y divide-[#ECEAF6]">
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
                            className="rounded-[12px] border border-[#ECEAF6]"
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
                          <div className="text-[14px] font-semibold text-[#1E1B4B] group-hover:text-[#6D28D9] transition-colors truncate">
                            {targetSets} × {exName}
                          </div>
                          <div className="text-[12px] text-[#6B7280] mt-0.5">
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
                  <div className="text-center py-6 text-[13px] text-[#6B7280]">
                    {t('programs.noExercisesInDay')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Discussion & Installs Bar (Zero Likes!) */}
          <div className="bg-[#F8F7FC] border border-[#ECEAF6] p-4 rounded-[16px] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="h-9 px-3 rounded-[10px] bg-white border border-[#ECEAF6] text-xs font-semibold text-[#1E1B4B] inline-flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#6D28D9]" />
                  <span>
                    {program.installs_count || 0} {t('programs.installsCount')}
                  </span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCommentsOpen(true)}
                >
                  <MessageCircle className="w-4 h-4 text-[#6D28D9]" />
                  <span>
                    {comments.length} {t('programs.commentsCount')}
                  </span>
                </Button>
              </div>

              {isActiveProgram ? (
                <span className="text-[12px] font-semibold text-[#059669] bg-[#ECFDF5] border border-[#A7F3D0] px-3 py-1.5 rounded-[10px]">
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

            <div className="space-y-2.5 pt-2 border-t border-[#ECEAF6]">
              {comments.slice(0, 3).map((c: any) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setIsCommentsOpen(true)}
                  className="text-[12px] text-[#6B7280] hover:text-[#1E1B4B] text-left truncate block w-full cursor-pointer"
                >
                  <strong className="text-[#1E1B4B]">@{c.author_name || 'Атлет'}:</strong>{' '}
                  {c.content}
                </button>
              ))}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (quickComment.trim()) {
                    quickCommentMutation.mutate(quickComment);
                  }
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={quickComment}
                  onChange={(e) => setQuickComment(e.target.value)}
                  placeholder={t('programs.commentPlaceholder') || 'Оставить комментарий...'}
                  className="flex-1 h-[40px] bg-white border border-[#E2E0F0] focus:border-[#6D28D9] focus:outline-none rounded-[12px] px-3.5 text-[13px] text-[#1E1B4B] placeholder:text-[#94A3B8]"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={!quickComment.trim() || quickCommentMutation.isPending}
                  isLoading={quickCommentMutation.isPending}
                >
                  {t('common.save')}
                </Button>
              </form>

              <button
                type="button"
                onClick={() => setIsCommentsOpen(true)}
                className="w-full text-left text-[12px] text-[#6D28D9] hover:underline font-semibold cursor-pointer pt-0.5"
              >
                {comments.length > 0
                  ? `${t('programs.commentsCount')} (${comments.length}) →`
                  : `${t('programs.commentsCount')} →`}
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
