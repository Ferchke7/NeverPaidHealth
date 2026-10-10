import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Search,
  Calendar,
  Layers,
  Plus,
  ArrowRight,
  Check,
  Globe,
  Lock,
  Trash2,
  Edit3,
  Award,
  Users,
  Sparkles,
  Share2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Button } from '../../../shared/ui/button.tsx';
import { Card, Badge } from '../../../shared/ui/card.tsx';
import { Input } from '../../../shared/ui/input.tsx';
import { ExerciseThumbnail } from '../../../entities/exercise/ui/ExerciseThumbnail.tsx';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import {
  Program,
  ActiveProgramResponse,
  InstalledProgramItem,
  SplitType,
} from '../../../entities/program/model/types.ts';
import { ProgramEditorModal } from '../../../features/program-builder/ui/ProgramEditorModal.tsx';
import { ProgramDetailModal } from '../../../features/program-preview/ui/ProgramDetailModal.tsx';

interface ProgramsPageProps {
  onNavigateToWorkouts?: () => void;
}

export const ProgramsPage: React.FC<ProgramsPageProps> = ({ onNavigateToWorkouts }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'library' | 'community' | 'my_splits'>('library');
  const [selectedSplitType, setSelectedSplitType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [previewingProgram, setPreviewingProgram] = useState<Program | null>(null);

  // Split Category Pills
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

  // Fetch Active Program
  const { data: activeProgramData } = useQuery<ActiveProgramResponse>({
    queryKey: ['programs', 'active'],
    queryFn: () => apiClient<ActiveProgramResponse>('/programs/user/active'),
  });

  // Fetch Installed Programs
  const { data: installedPrograms = [] } = useQuery<InstalledProgramItem[]>({
    queryKey: ['programs', 'installed'],
    queryFn: () => apiClient<InstalledProgramItem[]>('/programs/user/installed'),
  });

  // Fetch Programs by Tab & Split Type
  const { data: programs = [], isLoading } = useQuery<Program[]>({
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

  const activeProgramId = activeProgramData?.program?.id || activeProgramData?.user_program?.program_id;
  const installedProgramIds = useMemo(() => {
    return new Set(installedPrograms.map((item) => item.program?.id || item.user_program?.program_id));
  }, [installedPrograms]);

  // Install / Set Active Mutation
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

  // Publish / Unpublish Mutation
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

  // Delete Program Mutation
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-brand-400" />
            <span>{t('programs.title')}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {t('programs.badge')}
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">{t('programs.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToWorkouts && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs flex items-center gap-1.5"
              onClick={onNavigateToWorkouts}
            >
              <span>{t('workouts.title')}</span>
              <ArrowRight className="w-3.5 h-3.5 text-brand-400" />
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            className="text-xs flex items-center gap-1.5 shadow-md shadow-brand-500/20"
            onClick={() => {
              setEditingProgram(null);
              setIsEditorOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
            <span>{t('programs.createSplit')}</span>
          </Button>
        </div>
      </div>

      {/* Main Tabs (Library / Community / My Splits) */}
      <div className="flex items-center gap-2 border-b border-dark-800 pb-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('library')}
          className={`text-xs px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
            activeTab === 'library'
              ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40 shadow-sm'
              : 'bg-dark-900/80 text-zinc-400 hover:text-zinc-200 hover:bg-dark-800'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>{t('programs.tabLibrary')}</span>
        </button>

        <button
          onClick={() => setActiveTab('community')}
          className={`text-xs px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
            activeTab === 'community'
              ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40 shadow-sm'
              : 'bg-dark-900/80 text-zinc-400 hover:text-zinc-200 hover:bg-dark-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>{t('programs.tabCommunity')}</span>
        </button>

        <button
          onClick={() => setActiveTab('my_splits')}
          className={`text-xs px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
            activeTab === 'my_splits'
              ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40 shadow-sm'
              : 'bg-dark-900/80 text-zinc-400 hover:text-zinc-200 hover:bg-dark-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{t('programs.tabMySplits')}</span>
        </button>
      </div>

      {/* Search & Category Filter Pills */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            placeholder={t('programs.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {splitCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedSplitType(cat.id)}
              className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                selectedSplitType === cat.id
                  ? 'bg-dark-700 text-brand-400 border border-brand-500/40 font-bold shadow-sm'
                  : 'bg-dark-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-dark-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Programs Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-52 bg-dark-800/60 rounded-2xl border border-dark-700/60 animate-pulse"
            />
          ))}
        </div>
      ) : programs.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-dark-800 rounded-2xl p-6 bg-dark-900/40">
          <BookOpen className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-zinc-300">
            {activeTab === 'my_splits' ? t('programs.noMySplits') : t('programs.noPrograms')}
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 mb-4">
            {activeTab === 'my_splits'
              ? t('programs.noMySplitsDesc')
              : t('programs.noProgramsDesc')}
          </p>
          <div className="flex items-center justify-center gap-2">
            {activeTab === 'my_splits' ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditingProgram(null);
                  setIsEditorOpen(true);
                }}
                className="text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                <span>{t('programs.createFirstSplit')}</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedSplitType('all');
                  setSearchQuery('');
                }}
                className="text-xs"
              >
                <span>{t('common.clearFilters')}</span>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {programs.map((prog) => {
            const isActive = activeProgramId === prog.id;
            const isInstalled = installedProgramIds.has(prog.id);
            const daysList = prog.days || [];
            const isAuthor = activeTab === 'my_splits';

            return (
              <Card
                key={prog.id}
                onClick={() => setPreviewingProgram(prog)}
                className="p-4 bg-dark-800/90 border border-dark-700/80 hover:border-brand-500/50 transition-all flex flex-col justify-between shadow-lg cursor-pointer group"
              >
                <div className="space-y-3">
                  {/* Card Header & Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="brand" size="sm">
                          {getSplitLabel(prog.split_type)}
                        </Badge>
                        <Badge variant="neutral" size="sm">
                          {getLevelLabel(prog.level)}
                        </Badge>
                        {isActive && (
                          <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            {t('programs.activeSplit')}
                          </span>
                        )}
                        {isAuthor && (
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                              prog.is_public
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                            }`}
                          >
                            {prog.is_public ? (
                              <>
                                <Globe className="w-2.5 h-2.5" />
                                {t('programs.public')}
                              </>
                            ) : (
                              <>
                                <Lock className="w-2.5 h-2.5" />
                                {t('programs.private')}
                              </>
                            )}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-white leading-snug group-hover:text-brand-400 transition-colors break-words mt-1.5">
                        {prog.name}
                      </h3>

                      <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                          {t('programs.daysPerWeekCount', { count: prog.days_per_week || daysList.length })}
                        </span>
                        <span>•</span>
                        <span>
                          {prog.author_name
                            ? t('programs.byAuthor', { author: prog.author_name })
                            : t('programs.officialSplit')}
                        </span>
                        {prog.installs_count > 0 && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-zinc-400">
                              <Users className="w-3 h-3 text-zinc-500" />
                              {prog.installs_count}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Author Controls */}
                    {isAuthor && (
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setEditingProgram(prog);
                            setIsEditorOpen(true);
                          }}
                          className="text-zinc-500 hover:text-brand-400 p-1.5 rounded-lg hover:bg-dark-700 transition-colors"
                          title={t('common.edit')}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            const confirmed = window.confirm(
                              t('programs.deleteConfirm', { name: prog.name })
                            );
                            if (confirmed) {
                              deleteProgramMutation.mutate(prog.id);
                            }
                          }}
                          className="text-zinc-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-dark-700 transition-colors"
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {prog.description && (
                    <p className="text-xs text-zinc-400 italic line-clamp-2">
                      "{prog.description}"
                    </p>
                  )}

                  {/* Split Days preview chips */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex flex-wrap gap-1.5">
                      {daysList.slice(0, 4).map((d, i) => (
                        <span
                          key={i}
                          className="text-[10px] bg-dark-900/90 border border-dark-700 text-zinc-300 px-2 py-0.5 rounded-lg flex items-center gap-1 font-mono"
                        >
                          <span className="text-brand-400 font-bold">#{d.day_number || i + 1}</span>
                          <span className="font-sans truncate max-w-[120px]">{d.name}</span>
                          <span className="text-zinc-500">({d.exercises?.length || 0})</span>
                        </span>
                      ))}
                      {daysList.length > 4 && (
                        <span className="text-[10px] bg-dark-900/90 border border-dark-700 text-zinc-500 px-2 py-0.5 rounded-lg font-mono">
                          +{daysList.length - 4} {t('programs.moreDays')}
                        </span>
                      )}
                    </div>

                    {/* Exercise Thumbnails Row */}
                    <div className="flex items-center gap-1.5 overflow-hidden pt-1">
                      {daysList[0]?.exercises?.slice(0, 4).map((ex, i) => (
                        <div key={i} className="relative group/thumb" title={ex.exercise_name}>
                          <ExerciseThumbnail
                            exerciseName={ex.exercise_name}
                            size="sm"
                            className="rounded-lg border-dark-700 hover:border-brand-400 transition-colors"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div
                  className="mt-4 pt-3 border-t border-dark-700/60 flex items-center justify-between gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1.5">
                    {isAuthor ? (
                      <button
                        onClick={() =>
                          togglePublishMutation.mutate({
                            programId: prog.id,
                            isPublic: !prog.is_public,
                          })
                        }
                        className={`text-xs px-2.5 py-1.5 rounded-xl border font-semibold flex items-center gap-1.5 transition-all ${
                          prog.is_public
                            ? 'bg-dark-900 border-dark-700 text-zinc-400 hover:text-white hover:bg-dark-700'
                            : 'bg-brand-500/10 border-brand-500/30 text-brand-400 hover:bg-brand-500/20'
                        }`}
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>{prog.is_public ? t('programs.unpublish') : t('programs.publish')}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setPreviewingProgram(prog)}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-dark-900 hover:bg-dark-700 text-zinc-300 border border-dark-700 transition-all flex items-center gap-1.5 shadow-sm"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{t('programs.viewSplit')}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isActive ? (
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
                        <Check className="w-3.5 h-3.5" />
                        <span>{t('programs.active')}</span>
                      </span>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        isLoading={installMutation.isPending}
                        className="text-xs font-bold flex items-center justify-center gap-1.5 px-3.5 shadow-sm"
                        onClick={() => installMutation.mutate({ programId: prog.id, setActive: true })}
                      >
                        <Award className="w-3.5 h-3.5 fill-current" />
                        <span>{isInstalled ? t('programs.setActive') : t('programs.installAndSet')}</span>
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Program Detail Preview Modal */}
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
      />

      {/* Program Editor / Creator Modal */}
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
