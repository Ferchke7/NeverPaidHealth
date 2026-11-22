import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Dumbbell,
  LineChart,
  LogOut,
  Sparkles,
  Utensils,
  ListTodo,
  MessageSquarePlus,
  BookOpen,
  Layers,
  History,
  Scale,
  User as UserIcon,
  X,
  Menu,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { useActiveWorkoutStore } from '../../../entities/workout/model/activeWorkoutStore.ts';
import { ActiveProgramResponse } from '../../../entities/program/model/types.ts';
import { AthleteAvatar } from '../../../entities/user/ui/AthleteAvatar.tsx';
import { LanguageSwitchToggle } from '../../../features/switch-language/ui/LanguageSwitchToggle.tsx';
import { PWAInstallBanner } from '../../../features/pwa-install/ui/PWAInstallBanner.tsx';
import { PWAInstallButton } from '../../../features/pwa-install/ui/PWAInstallButton.tsx';
import { FeedbackModal } from '../../../features/feedback/ui/FeedbackModal.tsx';
import { Button } from '../../../shared/ui/button.tsx';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

export type NavTab =
  | 'workouts'
  | 'programs'
  | 'exercises'
  | 'todo'
  | 'nutrition'
  | 'coach'
  | 'progress'
  | 'history'
  | 'body'
  | 'profile';

interface DashboardLayoutProps {
  activeTab?: NavTab;
  onSelectTab?: (tab: NavTab) => void;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  activeTab: explicitActiveTab,
  onSelectTab,
  children,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const activeWorkout = useActiveWorkoutStore((s) => s.workout);
  const openWorkoutSheet = useActiveWorkoutStore((s) => s.openSheet);
  const { t, language } = useTranslation();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { data: activeProgramData } = useQuery<ActiveProgramResponse>({
    queryKey: ['programs', 'active'],
    queryFn: () => apiClient<ActiveProgramResponse>('/programs/user/active'),
    staleTime: 60_000,
  });

  const pathSegment = location.pathname.replace(/^\//, '').split('/')[0] as NavTab;
  const currentTab: NavTab = explicitActiveTab || pathSegment || 'workouts';
  const isCoachView = currentTab === 'coach';

  const handleNavClick = (tabId: NavTab) => {
    setIsMobileMenuOpen(false);
    useActiveWorkoutStore.getState().closeSheet();
    if (onSelectTab) {
      onSelectTab(tabId);
    }
    navigate(`/${tabId}`);
  };

  const sidebarGroups: {
    title: string;
    items: { id: NavTab; label: string; icon: React.ReactNode }[];
  }[] = [
    {
      title: t('nav.groupTraining'),
      items: [
        { id: 'workouts', label: t('nav.workouts'), icon: <Dumbbell className="w-4 h-4 shrink-0" /> },
        { id: 'programs', label: t('nav.programs'), icon: <BookOpen className="w-4 h-4 shrink-0" /> },
        { id: 'exercises', label: t('exercises.title') || t('nav.exercises'), icon: <Layers className="w-4 h-4 shrink-0" /> },
      ],
    },
    {
      title: t('nav.groupDaily'),
      items: [
        { id: 'todo', label: t('nav.planDay'), icon: <ListTodo className="w-4 h-4 shrink-0" /> },
        { id: 'nutrition', label: t('nav.nutrition'), icon: <Utensils className="w-4 h-4 shrink-0" /> },
        { id: 'coach', label: t('nav.coach'), icon: <Sparkles className="w-4 h-4 shrink-0" /> },
      ],
    },
    {
      title: t('nav.groupAnalytics'),
      items: [
        { id: 'progress', label: t('nav.progress'), icon: <LineChart className="w-4 h-4 shrink-0" /> },
        { id: 'history', label: t('history.title') || t('nav.history'), icon: <History className="w-4 h-4 shrink-0" /> },
        { id: 'body', label: t('nav.bodyMetrics'), icon: <Scale className="w-4 h-4 shrink-0" /> },
      ],
    },
  ];

  const mobileDrawerItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'workouts', label: t('nav.workouts'), icon: <Dumbbell className="w-4 h-4" /> },
    { id: 'programs', label: t('nav.programs'), icon: <BookOpen className="w-4 h-4" /> },
    { id: 'exercises', label: t('exercises.title') || t('nav.exercises'), icon: <Layers className="w-4 h-4" /> },
    { id: 'history', label: t('history.title') || t('nav.history'), icon: <History className="w-4 h-4" /> },
    { id: 'progress', label: t('nav.progress'), icon: <LineChart className="w-4 h-4" /> },
    { id: 'body', label: t('nav.bodyMetrics'), icon: <Scale className="w-4 h-4" /> },
    { id: 'nutrition', label: t('nav.nutrition'), icon: <Utensils className="w-4 h-4" /> },
    { id: 'todo', label: t('nav.planDay'), icon: <ListTodo className="w-4 h-4" /> },
    { id: 'coach', label: t('nav.coach'), icon: <Sparkles className="w-4 h-4" /> },
    { id: 'profile', label: t('nav.profile'), icon: <UserIcon className="w-4 h-4" /> },
  ];

  const sectionTitleMap: Record<NavTab, string> = {
    workouts: t('nav.workouts'),
    programs: t('nav.programs'),
    exercises: t('exercises.title') || t('nav.exercises'),
    todo: t('nav.planDay'),
    nutrition: t('nav.nutrition'),
    coach: t('nav.coach'),
    progress: t('nav.progress'),
    history: t('history.title') || t('nav.history'),
    body: t('nav.bodyMetrics'),
    profile: t('nav.profile'),
  };

  const displayName = user?.display_name || user?.email?.split('@')[0] || 'duda.uz';
  const activeProg = activeProgramData?.program;

  return (
    <div
      className={
        isCoachView
          ? 'h-[100dvh] max-h-[100dvh] w-full flex flex-col lg:flex-row bg-[#F4F3FA] text-[#130F26] selection:bg-[#7C3AED] selection:text-white overflow-hidden'
          : 'min-h-[100dvh] w-full flex flex-col lg:flex-row bg-[#F4F3FA] text-[#130F26] selection:bg-[#7C3AED] selection:text-white'
      }
    >
      {/* Desktop Left Royal Violet Sidebar (252px Clean White Rail matching Figma 13–18) */}
      <aside className="hidden lg:flex flex-col justify-between w-[252px] shrink-0 bg-[#FFFFFF] border-r border-[#ECEAF6] p-5 sticky top-0 h-[100dvh] overflow-y-auto">
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => handleNavClick('workouts')}
            className="w-full min-h-[44px] flex items-center gap-3 text-left px-1 py-1 hover:opacity-85 transition-opacity cursor-pointer"
          >
            <div className="w-10 h-10 rounded-[14px] violet-btn-gradient flex items-center justify-center text-white shadow-[0_8px_18px_rgba(109,40,217,0.22)] shrink-0">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[19px] font-bold tracking-tight text-[#130F26] leading-tight">
                duda.uz
              </div>
              <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#7C3AED]">
                GYM & STRENGTH PRO
              </div>
            </div>
          </button>

          {/* Active Split / Live Workout Quick Banner in Sidebar */}
          {(activeWorkout || activeProg) && (
            <button
              type="button"
              onClick={() => {
                if (activeWorkout) openWorkoutSheet();
                else handleNavClick('workouts');
              }}
              className="w-full text-left royal-hero-gradient rounded-[18px] p-3.5 text-white space-y-1 shadow-[0_10px_24px_rgba(59,12,163,0.22)] hover:opacity-95 transition-opacity cursor-pointer"
            >
              <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.06em] text-[#DDD6FE]">
                <span>{activeWorkout ? '● LIVE WORKOUT' : '⚡ PERSONAL SPLIT'}</span>
                {activeWorkout ? (
                  <span className="text-[#6EE7B7]">ACTIVE</span>
                ) : (
                  <span className="text-[#6EE7B7]">AUTO-SAVE</span>
                )}
              </div>
              <div className="text-[13px] font-bold truncate">
                {activeWorkout ? activeWorkout.name : activeProg?.name}
              </div>
              <div className="text-[11px] text-[#DDD6FE] truncate">
                {activeWorkout
                  ? `${activeWorkout.exercises.length} ${t('summary.exercisesShort')}`
                  : `${activeProg?.days_per_week || activeProg?.days?.length || 0} ${t('programs.daysShort')}`}
              </div>
            </button>
          )}

          <nav className="space-y-4" aria-label="Primary Navigation">
            {sidebarGroups.map((group) => (
              <div key={group.title} className="space-y-1">
                <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#8F8AA8]">
                  {group.title}
                </div>
                {group.items.map((item) => {
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full h-[42px] px-3 rounded-[14px] flex items-center gap-2.5 text-[13px] font-semibold transition-all cursor-pointer ${
                        isActive
                          ? 'violet-btn-gradient text-white shadow-[0_6px_16px_rgba(109,40,217,0.22)]'
                          : 'text-[#5A5575] hover:text-[#130F26] hover:bg-[#F8F7FC]'
                      }`}
                    >
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Sidebar Bottom Profile & Utilities */}
        <div className="pt-4 border-t border-[#ECEAF6] space-y-2.5">
          <button
            type="button"
            onClick={() => handleNavClick('profile')}
            className={`w-full p-2.5 rounded-[16px] flex items-center gap-2.5 text-left transition-all cursor-pointer border ${
              currentTab === 'profile'
                ? 'bg-[#F4F1FE] border-[#C4B5FD]'
                : 'bg-[#F8F7FC] border-[#ECEAF6] hover:border-[#DDD6FE]'
            }`}
          >
            <AthleteAvatar name={displayName} avatarUrl={user?.avatar_url} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-bold text-[#130F26] truncate">{displayName}</div>
              <div className="text-[10px] font-semibold text-[#7C3AED] truncate">
                {t('nav.profile')} · {language.toUpperCase()}
              </div>
            </div>
          </button>

          <div className="flex items-center justify-between gap-1 px-1">
            <button
              type="button"
              onClick={() => setIsFeedbackOpen(true)}
              className="flex-1 h-[38px] px-2.5 flex items-center justify-center gap-1.5 rounded-[12px] text-[12px] font-semibold text-[#5A5575] hover:text-[#6D28D9] hover:bg-[#F4F1FE] transition-colors cursor-pointer"
              title={t('nav.feedbackTitle') || 'Feedback'}
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              <span className="truncate">{t('nav.feedback') || 'Feedback'}</span>
            </button>
            <button
              type="button"
              onClick={logout}
              className="h-[38px] w-[38px] flex items-center justify-center rounded-[12px] text-[#8F8AA8] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title={t('nav.logout')}
              aria-label={t('nav.logout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Top Royal Header (< lg) */}
      <header className="lg:hidden sticky top-0 z-40 royal-hero-gradient px-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-2.5 flex items-center justify-between shrink-0 text-white shadow-[0_8px_22px_rgba(27,5,82,0.18)]">
        <button
          type="button"
          onClick={() => handleNavClick('workouts')}
          className="min-h-[40px] flex items-center gap-2.5 text-left cursor-pointer"
        >
          <div className="w-8 h-8 rounded-[10px] bg-white/15 flex items-center justify-center text-white">
            <Dumbbell className="w-4 h-4" />
          </div>
          <span className="text-[18px] font-bold tracking-tight text-white">duda.uz</span>
        </button>

        <div className="flex items-center gap-2">
          {activeWorkout && (
            <button
              type="button"
              onClick={openWorkoutSheet}
              className="h-[34px] px-3 rounded-full bg-[#10B981] text-white text-[11px] font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>LIVE</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="h-[38px] px-3 rounded-[12px] bg-white/15 hover:bg-white/25 text-[13px] font-semibold text-white flex items-center gap-1.5 cursor-pointer"
          >
            <Menu className="w-4 h-4" />
            <span>{t('nav.menu')}</span>
          </button>
        </div>
      </header>

      {/* Mobile Full Sections Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-[#F4F3FA] flex flex-col p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] overflow-y-auto">
          <div className="flex items-center justify-between pb-4">
            <span className="text-[20px] font-bold tracking-tight text-[#130F26]">
              {t('nav.allSections')}
            </span>
            <Button
              isIconOnly
              size="md"
              variant="outline"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label={t('common.close')}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="bg-[#FFFFFF] border border-[#ECEAF6] rounded-[22px] p-3 grid grid-cols-2 gap-2.5 shadow-[0_10px_28px_rgba(27,5,82,0.06)]">
            {mobileDrawerItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`min-h-[48px] px-3.5 rounded-[14px] border text-[13px] font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                    isActive
                      ? 'violet-btn-gradient border-transparent text-white shadow-[0_6px_14px_rgba(109,40,217,0.22)]'
                      : 'bg-[#F8F7FC] border-[#ECEAF6] text-[#130F26] hover:bg-[#F4F1FE]'
                  }`}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 bg-[#FFFFFF] border border-[#ECEAF6] rounded-[22px] p-4 space-y-3 shadow-[0_10px_28px_rgba(27,5,82,0.06)]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-[#130F26] truncate">{displayName}</span>
              <LanguageSwitchToggle variant="header" />
            </div>
            <PWAInstallButton variant="card" />
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsFeedbackOpen(true);
                }}
              >
                {t('nav.feedback') || 'Feedback'}
              </Button>
              <Button variant="danger" size="md" onClick={logout}>
                {t('nav.logout')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {/* Desktop Top Utility Bar */}
        <div className="hidden lg:flex items-center justify-between gap-4 px-8 pt-5 pb-1 w-full max-w-[1260px] shrink-0">
          <div className="text-[13px] font-semibold text-[#8F8AA8]">
            duda.uz  /  <span className="text-[#130F26] font-bold">{sectionTitleMap[currentTab]}</span>
          </div>

          <div className="flex items-center gap-2.5 text-[13px] text-[#5A5575]">
            <PWAInstallButton className="hidden xl:flex" />
            <LanguageSwitchToggle variant="header" />
            <button
              type="button"
              onClick={() => setIsFeedbackOpen(true)}
              className="min-h-[40px] px-3 inline-flex items-center rounded-[12px] bg-[#FFFFFF] border border-[#ECEAF6] text-[12px] font-semibold text-[#5A5575] hover:text-[#6D28D9] hover:border-[#C4B5FD] transition-colors cursor-pointer"
            >
              {t('nav.feedback') || 'Feedback'}
            </button>
          </div>
        </div>

        {/* Main Workspace Canvas */}
        <main
          className={
            isCoachView
              ? 'flex-1 min-h-0 w-full max-w-[1260px] px-4 sm:px-6 lg:px-8 py-2 lg:py-4 flex flex-col overflow-hidden relative'
              : 'flex-1 w-full max-w-[1260px] px-4 sm:px-6 lg:px-8 pt-3 lg:pt-4 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] lg:pb-12'
          }
        >
          {!isCoachView && <PWAInstallBanner />}
          {children}
        </main>
      </div>

      {/* Bottom Mobile Floating Navigation Bar with Elevated Center Violet FAB (Figma 01..12) */}
      <nav
        className={`${
          isCoachView ? 'shrink-0' : 'fixed bottom-0 left-0 right-0'
        } z-40 bg-[#FFFFFF]/95 backdrop-blur-md border-t border-[#ECEAF6] rounded-t-[24px] shadow-[0_-8px_28px_rgba(27,5,82,0.08)] lg:hidden flex items-center justify-around px-2 pt-1.5 pb-[calc(0.45rem+env(safe-area-inset-bottom,0px))]`}
        aria-label="Mobile Navigation"
      >
        {[
          { id: 'workouts' as NavTab, label: t('nav.workouts'), icon: <Dumbbell className="w-[18px] h-[18px]" /> },
          { id: 'progress' as NavTab, label: t('nav.progress'), icon: <LineChart className="w-[18px] h-[18px]" /> },
        ].map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] py-1 flex-1 min-w-0 transition-colors cursor-pointer ${
                isActive ? 'text-[#7C3AED]' : 'text-[#8F8AA8] hover:text-[#130F26]'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-bold tracking-tight truncate max-w-full">
                {item.label}
              </span>
            </button>
          );
        })}

        {/* Elevated Center Royal Violet Action Button */}
        <div className="flex items-center justify-center px-2 -mt-5">
          <button
            type="button"
            onClick={() => {
              if (activeWorkout) openWorkoutSheet();
              else handleNavClick('programs');
            }}
            aria-label={activeWorkout ? t('activeWorkout.sessionHeading') : t('nav.programs')}
            className="w-12 h-12 rounded-full violet-btn-gradient text-white flex items-center justify-center shadow-[0_10px_24px_rgba(109,40,217,0.38)] ring-4 ring-[#FFFFFF] active:scale-95 transition-transform cursor-pointer"
          >
            {activeWorkout ? <Dumbbell className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
          </button>
        </div>

        {[
          { id: 'todo' as NavTab, label: t('nav.planShort'), icon: <ListTodo className="w-[18px] h-[18px]" /> },
          { id: 'profile' as NavTab, label: t('nav.profile'), icon: <UserIcon className="w-[18px] h-[18px]" /> },
        ].map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] py-1 flex-1 min-w-0 transition-colors cursor-pointer ${
                isActive ? 'text-[#7C3AED]' : 'text-[#8F8AA8] hover:text-[#130F26]'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-bold tracking-tight truncate max-w-full">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
      />
    </div>
  );
};

export default DashboardLayout;
