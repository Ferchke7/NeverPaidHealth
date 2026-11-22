import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Button } from '../../../shared/ui/button.tsx';
import { Card } from '../../../shared/ui/card.tsx';
import { Input } from '../../../shared/ui/input.tsx';
import { EmptyStateCard, LoadingStateCard } from '../../../shared/ui/SystemState.tsx';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { usePageSEO } from '../../../shared/lib/seo/usePageSEO.ts';
import {
  Program,
  ActiveProgramResponse,
  InstalledProgramItem,
  SplitType,
} from '../../../entities/program/model/types.ts';
import { ProgramEditorModal } from '../../../features/program-builder/ui/ProgramEditorModal.tsx';
import { ProgramDetailModal } from '../../../features/program-preview/ui/ProgramDetailModal.tsx';
import { InstagramCommentsModal } from '../../../features/program-preview/ui/InstagramCommentsModal.tsx';
import { AthleteProfileModal } from '../../../entities/user/ui/AthleteProfileModal.tsx';
import { useStartWorkout } from '../../../features/start-workout/model/useStartWorkout.ts';
import { applyProgramOverride } from '../../../entities/program/model/programWorkoutSync.ts';

interface ProgramsPageProps {
  onNavigateToWorkouts?: () => void;
  embedded?: boolean;
}

export const ProgramsPage: React.FC<ProgramsPageProps> = ({
  embedded = false,
}) => {
  usePageSEO({ pageKey: 'programs', canonicalPath: '/programs' });
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const startWorkout = useStartWorkout();

  const [activeTab, setActiveTab] = useState<'library' | 'community' | 'my_splits'>('library');
  const [selectedSplitType, setSelectedSplitType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [previewingProgram, setPreviewingProgram] = useState<Program | null>(null);
  const [commentingProgram, setCommentingProgram] = useState<Program | null>(null);
  const [selectedAthlete, setSelectedAthlete] = useState<{
    id: string;
    name?: string;
    avatar?: string;
  } | null>(null);

  const splitCategories = useMemo(
    () => [
      { id: 'all', label: t('programs.filterAll') },
      { id: 'ppl', label: t('programs.splitPpl') },
      { id: 'upper_lower', label: t('programs.splitUpperLower') },
      { id: 'full_body', label: t('programs.splitFullBody') },
      { id: 'bro_split', label: t('programs.splitBroSplit') },
      { id: 'custom', label: t('programs.splitCustom') },
    ],
    [t]
  );

  const { data: activeProgramData } = useQuery<ActiveProgramResponse>({
    queryKey: ['programs', 'active'],
    queryFn: () => apiClient<ActiveProgramResponse>('/programs/user/active'),
  });

  const { data: rawInstalledPrograms } = useQuery<InstalledProgramItem[]>({
    queryKey: ['programs', 'installed'],
    queryFn: () => apiClient<InstalledProgramItem[]>('/programs/user/installed'),
  });
  const installedPrograms = Array.isArray(rawInstalledPrograms) ? rawInstalledPrograms : [];

  const { data: rawPrograms, isLoading } = useQuery<Program[]>({
    queryKey: ['programs', activeTab, selectedSplitType, searchQuery],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('tab', activeTab);
      if (selectedSplitType !== 'all') {
        params.set('split_type', selectedSplitType);
      }
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }
      return apiClient<Program[]>(`/programs?${params.toString()}`);
    },
  });
  const activeProgram = useMemo(
    () => applyProgramOverride(activeProgramData?.program),
    [activeProgramData?.program]
  );
  const activeProgramId = activeProgram?.id || activeProgramData?.user_program?.program_id;
  const installedProgramIds = useMemo(() => {
    return new Set(
      installedPrograms.map((item) => item.program?.id || item.user_program?.program_id)
    );
  }, [installedPrograms]);

  const installedProgramNames = useMemo(() => {
    const names = new Set<string>();
    if (activeProgram?.name) names.add(activeProgram.name.toLowerCase().trim());
    for (const item of installedPrograms) {
      if (item.program?.name) names.add(item.program.name.toLowerCase().trim());
    }
    return names;
  }, [activeProgram, installedPrograms]);

  const programs = useMemo(() => {
    const list = Array.isArray(rawPrograms) ? rawPrograms : [];
    return list.map((p) => {
      const isUserInstalled =
        p.id === activeProgramId ||
        installedProgramIds.has(p.id) ||
        (p.name && installedProgramNames.has(p.name.toLowerCase().trim()));
      return applyProgramOverride(p, Boolean(isUserInstalled)) || p;
    });
  }, [rawPrograms, activeProgramId, installedProgramIds, installedProgramNames]);

  const installMutation = useMutation({
    mutationFn: async ({ programId, setActive }: { programId: string; setActive: boolean }) => {
      return apiClient(`/programs/${programId}/install`, {
        method: 'POST',
        body: JSON.stringify({ set_active: setActive }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['programs'] });
      void queryClient.invalidateQueries({ queryKey: ['programs', 'active'] });
      void queryClient.invalidateQueries({ queryKey: ['programs', 'installed'] });
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: async ({ programId, isPublic }: { programId: string; isPublic: boolean }) => {
      return apiClient(`/programs/${programId}/publish`, {
        method: 'POST',
        body: JSON.stringify({ is_public: isPublic }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['programs'] });
    },
  });

  const deleteProgramMutation = useMutation({
    mutationFn: async (programId: string) => {
      return apiClient(`/programs/${programId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['programs'] });
      void queryClient.invalidateQueries({ queryKey: ['programs', 'active'] });
      void queryClient.invalidateQueries({ queryKey: ['programs', 'installed'] });
    },
  });

  const getSplitLabel = (type: SplitType | string) => {
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

  const programTabs = useMemo(
    () => [
      { id: 'library' as const, label: t('programs.tabLibrary') },
      { id: 'community' as const, label: t('programs.tabCommunity') },
      { id: 'my_splits' as const, label: t('programs.tabMySplits') },
    ],
    [t]
  );

  return (
    <div className="space-y-6">
      {/* Royal Violet Header */}
      {!embedded && (
        <div className="royal-hero-gradient rounded-[24px] p-5 sm:p-7 text-white royal-card-shadow">
          <h1 className="text-[26px] sm:text-[32px] font-extrabold tracking-tight text-white">
            {t('programs.title')}
          </h1>
          <p className="text-[13px] sm:text-[14px] text-white/80 mt-1">{t('programs.subtitle')}</p>
        </div>
      )}

      {/* Pill Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-white p-1.5 rounded-[16px] border border-[#ECEAF6] royal-card-shadow w-fit max-w-full">
        {programTabs.map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`h-[40px] px-4 rounded-[12px] text-[13px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-[#6D28D9] text-white shadow-xs'
                  : 'text-[#6B7280] hover:text-[#1E1B4B] hover:bg-[#F8F7FC]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search + Primary CTA */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="flex-1 min-w-0">
          <Input
            placeholder={t('programs.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => {
            setEditingProgram(null);
            setIsEditorOpen(true);
          }}
          className="shrink-0"
        >
          {t('programs.createSplit')}
        </Button>
      </div>

      {/* Split Category Filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {splitCategories.map((cat) => {
          const isSelected = selectedSplitType === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedSplitType(cat.id)}
              className={`min-h-[40px] px-3.5 rounded-[10px] text-[13px] font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
                isSelected
                  ? 'bg-[#F0EFFE] text-[#6D28D9] border-[#DDD6FE]'
                  : 'bg-white text-[#6B7280] border-[#ECEAF6] hover:text-[#1E1B4B]'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Active Program Highlight Card (Indigo Split Card + Auto-Save Pill) */}
      {!embedded && activeProgram && (
        <div className="indigo-card-gradient rounded-[22px] p-5 sm:p-6 space-y-4 text-white royal-card-shadow">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#C4B5FD]">
                {t('programs.followingBanner')}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#10B981]/20 text-[#6EE7B7] border border-[#10B981]/30">
                ✓ {t('programs.personalCopyAutoSave')}
              </span>
            </div>
            <h2 className="text-[20px] sm:text-[22px] font-bold tracking-tight text-white">
              {activeProgram.name}
            </h2>
            <p className="text-[13px] text-white/80">
              {getSplitLabel(activeProgram.split_type)} ·{' '}
              {t('programs.daysPerWeekCount', {
                count: activeProgram.days_per_week || activeProgram.days?.length || 1,
              })}{' '}
              · {getLevelLabel(activeProgram.level)}
              {activeProgram.days && activeProgram.days.length > 0
                ? ` · ${t('workouts.dayOf', {
                    day: 1,
                    total: activeProgram.days.length,
                  })}`
                : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {activeProgram.days?.[0] && (
              <button
                type="button"
                onClick={() =>
                  startWorkout({
                    name: `${activeProgram.name} - ${activeProgram.days[0].name}`,
                    programId: activeProgram.id,
                    programDayNumber: activeProgram.days[0].day_number || 1,
                    exercises: activeProgram.days[0].exercises,
                  })
                }
                className="min-h-[42px] px-4 rounded-[12px] bg-white text-[#1B1145] hover:bg-[#F5F3FF] font-bold text-sm transition-colors cursor-pointer"
              >
                {t('programs.continueBtn')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setPreviewingProgram(activeProgram)}
              className="min-h-[42px] px-4 rounded-[12px] bg-white/15 hover:bg-white/25 text-white border border-white/25 font-semibold text-sm transition-colors cursor-pointer"
            >
              {t('programs.detailsBtn')}
            </button>
            <button
              type="button"
              onClick={() => setCommentingProgram(activeProgram)}
              className="min-h-[42px] px-4 rounded-[12px] bg-white/15 hover:bg-white/25 text-white border border-white/25 font-semibold text-sm transition-colors cursor-pointer"
            >
              💬 {t('programs.commentsCount')} ({activeProgram.comments_count || 0})
            </button>
          </div>
        </div>
      )}

      {/* Programs List */}
      <section className="space-y-4">
        <h2 className="text-[20px] font-bold tracking-tight text-[#1E1B4B]">
          {activeTab === 'community'
            ? t('programs.tabCommunity')
            : activeTab === 'my_splits'
              ? t('programs.tabMySplits')
              : t('programs.pickRhythm')}
        </h2>

        {isLoading ? (
          <LoadingStateCard title={t('common.loading')} />
        ) : programs.length === 0 ? (
          <EmptyStateCard
            title={
              activeTab === 'my_splits' ? t('programs.noMySplits') : t('programs.noPrograms')
            }
            description={
              activeTab === 'my_splits'
                ? t('programs.noMySplitsDesc')
                : t('programs.noProgramsDesc')
            }
            actionLabel={
              activeTab === 'my_splits'
                ? t('programs.createFirstSplit')
                : t('common.clearFilters')
            }
            onAction={() => {
              if (activeTab === 'my_splits') {
                setEditingProgram(null);
                setIsEditorOpen(true);
              } else {
                setSelectedSplitType('all');
                setSearchQuery('');
              }
            }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {programs.map((prog) => {
              const isActive = activeProgramId === prog.id;
              const isInstalled = installedProgramIds.has(prog.id);
              const daysList = prog.days || [];
              const isAuthor = activeTab === 'my_splits';

              return (
                <Card
                  key={prog.id}
                  onClick={() => setPreviewingProgram(prog)}
                  className="p-5 flex flex-col justify-between gap-4 hover:border-[#C4B5FD] transition-all cursor-pointer"
                >
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <div className="text-[12px] font-bold text-[#6D28D9]">
                        {getSplitLabel(prog.split_type)} ·{' '}
                        {t('programs.daysPerWeekCount', {
                          count: prog.days_per_week || daysList.length,
                        })}{' '}
                        · {getLevelLabel(prog.level)}
                      </div>

                      <h3 className="text-[18px] font-bold text-[#1E1B4B] leading-snug break-words">
                        {prog.name}
                      </h3>

                      {prog.description && (
                        <p className="text-[13px] text-[#6B7280] leading-relaxed line-clamp-2">
                          {prog.description}
                        </p>
                      )}
                    </div>

                    <div className="border-t border-[#ECEAF6]" />

                    {/* Days overview */}
                    <div className="text-[13px] font-medium text-[#1E1B4B] leading-relaxed">
                      {daysList.length > 0
                        ? daysList.map((d) => d.name).join(' / ')
                        : t('programs.draftEmptyHint')}
                    </div>

                    {/* Author & Gym Social Info (Zero Likes — Installs & Comments Only!) */}
                    <div
                      className="flex flex-wrap items-center gap-3 text-[12px] text-[#6B7280]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {prog.author_name && (
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedAthlete({
                              id: prog.user_id || '',
                              name: prog.author_name,
                              avatar: prog.author_avatar_url,
                            })
                          }
                          className="min-h-[34px] inline-flex items-center font-semibold text-[#1E1B4B] hover:text-[#6D28D9] transition-colors cursor-pointer"
                        >
                          {prog.author_name}
                        </button>
                      )}
                      <span className="min-h-[34px] inline-flex items-center gap-1 font-medium text-[#6B7280]">
                        <span>👥 {prog.installs_count || 0}</span>
                        <span className="hidden sm:inline">{t('programs.installsCount')}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setCommentingProgram(prog)}
                        className="min-h-[34px] inline-flex items-center gap-1 text-[#6D28D9] hover:text-[#4C1D95] transition-colors cursor-pointer font-semibold"
                      >
                        <span>
                          💬 {prog.comments_count || 0} {t('programs.commentsCount')}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div
                    className="flex flex-wrap items-center gap-2 pt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isAuthor ? (
                      <>
                        {!isActive && (
                          <Button
                            variant="primary"
                            size="md"
                            isLoading={installMutation.isPending}
                            onClick={() =>
                              installMutation.mutate({ programId: prog.id, setActive: true })
                            }
                          >
                            {t('programs.setActive')}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="md"
                          onClick={() => {
                            setEditingProgram(prog);
                            setIsEditorOpen(true);
                          }}
                        >
                          {t('workouts.editShort')}
                        </Button>
                        <Button
                          variant="outline"
                          size="md"
                          onClick={() =>
                            togglePublishMutation.mutate({
                              programId: prog.id,
                              isPublic: !prog.is_public,
                            })
                          }
                        >
                          {prog.is_public ? t('programs.unpublish') : t('programs.publish')}
                        </Button>
                        <Button
                          variant="outline"
                          size="md"
                          onClick={() => {
                            const confirmed = window.confirm(
                              t('programs.deleteConfirm', { name: prog.name })
                            );
                            if (confirmed) {
                              deleteProgramMutation.mutate(prog.id);
                            }
                          }}
                        >
                          {t('common.delete')}
                        </Button>
                      </>
                    ) : (
                      <>
                        {isActive || isInstalled ? (
                          <Button
                            variant="outline"
                            size="md"
                            disabled={isActive}
                            isLoading={installMutation.isPending}
                            onClick={() =>
                              installMutation.mutate({ programId: prog.id, setActive: true })
                            }
                          >
                            {isActive
                              ? t('programs.installedShort')
                              : t('programs.setActive')}
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="md"
                            isLoading={installMutation.isPending}
                            onClick={() =>
                              installMutation.mutate({ programId: prog.id, setActive: true })
                            }
                          >
                            {t('programs.installShort')}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="md"
                          onClick={() => setPreviewingProgram(prog)}
                        >
                          {t('programs.detailsBtn')}
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <ProgramDetailModal
        isOpen={Boolean(previewingProgram)}
        program={previewingProgram}
        isActiveProgram={activeProgramId === previewingProgram?.id}
        isInstalled={previewingProgram ? installedProgramIds.has(previewingProgram.id) : false}
        onClose={() => setPreviewingProgram(null)}
        onEditProgram={(p) => {
          setPreviewingProgram(null);
          setEditingProgram(p);
          setIsEditorOpen(true);
        }}
        onSelectProgram={(p) => {
          setPreviewingProgram(p);
        }}
      />

      {commentingProgram && (
        <InstagramCommentsModal
          isOpen={Boolean(commentingProgram)}
          onClose={() => setCommentingProgram(null)}
          programId={commentingProgram.id}
          programTitle={commentingProgram.name}
          programAuthorId={commentingProgram.user_id}
          onOpenAthlete={(athleteId, name, avatar) => {
            setCommentingProgram(null);
            setSelectedAthlete({ id: athleteId, name, avatar });
          }}
        />
      )}

      {selectedAthlete && (
        <AthleteProfileModal
          isOpen={!!selectedAthlete}
          athleteId={selectedAthlete.id}
          fallbackName={selectedAthlete.name}
          fallbackAvatar={selectedAthlete.avatar}
          onClose={() => setSelectedAthlete(null)}
          onSelectProgram={(p) => {
            setSelectedAthlete(null);
            setPreviewingProgram(p);
          }}
        />
      )}

      <ProgramEditorModal
        isOpen={isEditorOpen}
        initialProgram={editingProgram}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingProgram(null);
        }}
      />
    </div>
  );
};

export default ProgramsPage;
