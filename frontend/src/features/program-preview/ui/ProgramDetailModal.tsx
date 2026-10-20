import React, { useState } from 'react';
import {
  Play,
  HelpCircle,
  Edit3,
  Calendar,
  Layers,
  Check,
  Users,
  Award,
  Sparkles,
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
import { InstagramCommentsSection } from './InstagramCommentsSection.tsx';
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

  const scrollToComments = () => {
    const el = document.getElementById('program-comments-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
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
          {/* Program Description */}
          {program.description && (
            <div className="bg-dark-800/80 p-3 rounded-xl border border-dark-700/80 text-xs text-zinc-300 italic flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
              <p className="not-italic">{program.description}</p>
            </div>
          )}

          {/* Instagram-Style Social Action Bar */}
          <div className="bg-dark-900/90 border border-dark-750 p-3 rounded-2xl space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Heart / Like button */}
                <button
                  type="button"
                  onClick={() => toggleLikeMutation.mutate()}
                  className="flex items-center gap-1.5 text-xs font-bold transition-transform active:scale-125 cursor-pointer group"
                  title="Нравится"
                >
                  <Heart
                    className={`w-5 h-5 transition-colors ${
                      hasLiked
                        ? 'fill-rose-500 text-rose-500'
                        : 'text-zinc-400 group-hover:text-rose-400'
                    }`}
                  />
                  <span
                    className={`font-mono text-xs ${
                      hasLiked ? 'text-rose-400 font-bold' : 'text-zinc-300'
                    }`}
                  >
                    {program.likes_count || 0}
                  </span>
                </button>

                {/* Comment button (Scrolls down to comments) */}
                <button
                  type="button"
                  onClick={scrollToComments}
                  className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer group"
                  title="Перейти к комментариям"
                >
                  <MessageCircle className="w-5 h-5 text-zinc-400 group-hover:text-brand-400 transition-colors" />
                  <span className="font-mono text-xs text-zinc-300">
                    {comments.length}
                  </span>
                </button>
              </div>

              {/* Install badge or button on right */}
              {isActiveProgram ? (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Активен
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => installMutation.mutate({ setActive: true })}
                  disabled={installMutation.isPending}
                  className="text-[11px] font-bold text-brand-400 hover:text-brand-300 bg-brand-500/10 border border-brand-500/30 px-2.5 py-0.5 rounded-full transition-all cursor-pointer flex items-center gap-1"
                >
                  <Award className="w-3 h-3" />
                  <span>{isInstalled ? 'Активировать' : 'Установить'}</span>
                </button>
              )}
            </div>

            {/* Instagram Social Preview */}
            <div className="text-xs space-y-1 pt-1.5 border-t border-dark-800/80">
              <div className="text-zinc-400 font-medium text-[11px]">
                {program.likes_count > 0 ? (
                  <span>
                    Отметок «Нравится»: <strong className="text-white font-mono">{program.likes_count}</strong>
                  </span>
                ) : (
                  <span className="text-zinc-500">Поставьте первый лайк программе</span>
                )}
              </div>

              <div className="flex items-center justify-between text-xs pt-0.5">
                <button
                  type="button"
                  onClick={scrollToComments}
                  className="text-zinc-500 hover:text-zinc-300 font-medium transition-colors cursor-pointer text-left"
                >
                  {comments.length > 0
                    ? `Посмотреть все комментарии (${comments.length}) снизу...`
                    : 'Оставить первый комментарий снизу...'}
                </button>

                {comments[0] && (
                  <span className="text-[11px] text-zinc-400 truncate max-w-[180px] hidden sm:inline">
                    <strong className="text-zinc-300">@{comments[0].author_name}:</strong> {comments[0].content}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Days Tabs Header */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-brand-400" />
                <span>{t('programs.splitDaysOverview')}</span>
              </span>
              <span className="text-xs text-zinc-500 font-mono">
                {days.length} {t('programs.daysCount')}
              </span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {days.map((d, idx) => {
                const isSelected = idx === selectedDayIndex;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedDayIndex(idx)}
                    className={`text-xs px-3.5 py-2 rounded-xl font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                      isSelected
                        ? 'bg-dark-700 text-brand-400 border border-brand-500/50 font-bold shadow-md'
                        : 'bg-dark-900 text-zinc-400 hover:text-zinc-200 hover:bg-dark-800 border border-dark-800'
                    }`}
                  >
                    <span className="font-mono text-brand-400">#{idx + 1}</span>
                    <span className="truncate max-w-[140px]">{d.name}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      ({d.exercises?.length || 0})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current Day Exercise List */}
          {currentDay && (
            <div className="bg-dark-900/90 border border-dark-750 p-4 rounded-2xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-dark-800 pb-2.5">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="text-brand-400 font-mono">Day {selectedDayIndex + 1}:</span>
                    <span>{currentDay.name}</span>
                  </h4>
                  {currentDay.notes && (
                    <p className="text-xs text-zinc-400 mt-0.5 italic">"{currentDay.notes}"</p>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-zinc-500" />
                    {currentDay.exercises?.length || 0} {t('programs.exercises')}
                  </span>
                </div>
              </div>

              <div className="space-y-2 divide-y divide-dark-800">
                {currentDay.exercises && currentDay.exercises.length > 0 ? (
                  currentDay.exercises.map((ex, exIdx) => {
                    const exName = ex.exercise_name || 'Exercise';
                    const targetSets = ex.target_sets || 3;
                    const visual = getExerciseVisual(exName);
                    const primaryMuscle = visual.primaryMuscles[0] || 'Strength';

                    return (
                      <div
                        key={ex.exercise_id || exIdx}
                        className="pt-2.5 first:pt-0 flex items-center justify-between gap-3 group"
                      >
                        <div
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
                            className="rounded-xl border border-dark-700/80 group-hover:border-brand-500/60 transition-colors shadow-sm"
                          />
                        </div>

                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() =>
                            setInspectingExercise({
                              name: exName,
                              muscle: primaryMuscle,
                            })
                          }
                        >
                          <div className="text-sm font-bold text-zinc-100 group-hover:text-brand-400 transition-colors truncate">
                            <span className="text-brand-400 font-extrabold mr-1.5">
                              {targetSets} ×
                            </span>
                            <span>{exName}</span>
                          </div>
                          <div className="text-xs text-zinc-400 capitalize mt-0.5 flex items-center gap-2">
                            <span className="text-zinc-300 font-medium">{primaryMuscle}</span>
                            {ex.target_reps_min && (
                              <>
                                <span className="text-zinc-600">•</span>
                                <span className="text-zinc-400 font-mono text-[11px]">
                                  {ex.target_reps_min}
                                  {ex.target_reps_max && ex.target_reps_max !== ex.target_reps_min
                                    ? `-${ex.target_reps_max}`
                                    : ''}{' '}
                                  {t('activeWorkout.reps')}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setInspectingExercise({
                              name: exName,
                              muscle: primaryMuscle,
                            })
                          }
                          className="w-8 h-8 rounded-xl border border-dark-700 text-zinc-400 hover:text-white hover:border-dark-600 hover:bg-dark-800 flex items-center justify-center transition-all shrink-0 cursor-pointer"
                          title={t('routines.techniqueTooltip')}
                        >
                          <HelpCircle className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-6 text-xs text-zinc-500">
                    {t('programs.noExercisesInDay')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Instagram Comments Section Directly Embedded at the Bottom */}
          <InstagramCommentsSection
            programId={program.id}
            programAuthorId={program.user_id}
            onOpenAthlete={(athleteId, name, avatar) =>
              setSelectedAthlete({ id: athleteId, name, avatar })
            }
          />
        </div>
      </Modal>

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
