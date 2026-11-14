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
} from 'lucide-react';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { useActiveWorkoutStore } from '../../../entities/workout/model/activeWorkoutStore.ts';
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
  const { t, language } = useTranslation();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  // Sidebar groups matching Figma 01..16 1-to-1
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

  // Mobile Menu Drawer full list matching Screen 16
  const mobileDrawerItems: { id: NavTab; label: string }[] = [
    { id: 'workouts', label: t('nav.workouts') },
    { id: 'programs', label: t('nav.programs') },
    { id: 'exercises', label: t('exercises.title') || t('nav.exercises') },
    { id: 'history', label: t('history.title') || t('nav.history') },
    { id: 'progress', label: t('nav.progress') },
    { id: 'body', label: t('nav.bodyMetrics') },
    { id: 'nutrition', label: t('nav.nutrition') },
    { id: 'todo', label: t('nav.todo') },
    { id: 'coach', label: t('nav.coach') },
    { id: 'profile', label: t('nav.profile') },
  ];

  // Mobile Bottom Nav 5 core tabs matching Screen 01..16 Mobile
  const mobileBottomItems: {
    id: NavTab;
    label: string;
    icon: React.ReactNode;
  }[] = [
    { id: 'workouts', label: t('nav.workouts'), icon: <Dumbbell className="w-4 h-4" /> },
    { id: 'todo', label: t('nav.todo') === 'Todo' ? 'План' : t('nav.todo'), icon: <ListTodo className="w-4 h-4" /> },
    { id: 'nutrition', label: t('nav.nutrition'), icon: <Utensils className="w-4 h-4" /> },
    { id: 'coach', label: t('nav.coach'), icon: <Sparkles className="w-4 h-4" /> },
    { id: 'progress', label: t('nav.progress'), icon: <LineChart className="w-4 h-4" /> },
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

  return (
    <div
      className={
        isCoachView
          ? 'h-[100dvh] max-h-[100dvh] w-full flex flex-col lg:flex-row bg-[#0a0a0a] text-[#fafafa] selection:bg-[#34d399] selection:text-[#0a0a0a] overflow-hidden'
          : 'min-h-[100dvh] w-full flex flex-col lg:flex-row bg-[#0a0a0a] text-[#fafafa] selection:bg-[#34d399] selection:text-[#0a0a0a]'
      }
    >
      {/* Desktop Left Sidebar (216px Obsidian Column) */}
      <aside className="hidden lg:flex flex-col justify-between w-[216px] shrink-0 bg-[#0a0a0a] border-r border-[#262626] p-4 sticky top-0 h-[100dvh] overflow-y-auto">
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => handleNavClick('workouts')}
            className="w-full min-h-[44px] flex items-center text-left px-2 py-1 text-[22px] font-bold tracking-tight text-[#fafafa] hover:opacity-85 transition-opacity cursor-pointer"
          >
            duda.uz
          </button>

          <nav className="space-y-5" aria-label="Primary Navigation">
            {sidebarGroups.map((group) => (
              <div key={group.title} className="space-y-1">
                <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#a3a3a3]">
                  {group.title}
                </div>
                {group.items.map((item) => {
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full h-[44px] px-2.5 rounded-[8px] flex items-center gap-2.5 text-[14px] font-medium transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#022c22] text-[#34d399]'
                          : 'text-[#a3a3a3] hover:text-[#fafafa] hover:bg-[#171717]'
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
        <div className="pt-4 border-t border-[#262626] space-y-2">
          <button
            type="button"
            onClick={() => handleNavClick('profile')}
            className={`w-full h-[44px] px-2.5 rounded-[8px] flex items-center gap-2.5 text-[14px] font-medium transition-colors cursor-pointer ${
              currentTab === 'profile'
                ? 'bg-[#022c22] text-[#34d399]'
                : 'text-[#a3a3a3] hover:text-[#fafafa] hover:bg-[#171717]'
            }`}
          >
            <UserIcon className="w-4 h-4 shrink-0" />
            <span className="truncate">{t('nav.profile')}</span>
          </button>

          <div className="px-2.5 pt-1 flex items-center justify-between gap-2 text-[12px] text-[#a3a3a3]">
            <span className="truncate">
              {displayName} · {language.toUpperCase()}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setIsFeedbackOpen(true)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[8px] text-[#a3a3a3] hover:text-[#fafafa] hover:bg-[#171717] transition-colors cursor-pointer"
                title={t('nav.feedbackTitle') || 'Feedback'}
                aria-label={t('nav.feedbackTitle') || 'Feedback'}
              >
                <MessageSquarePlus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={logout}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[8px] text-[#a3a3a3] hover:text-red-400 hover:bg-[#171717] transition-colors cursor-pointer"
                title={t('nav.logout')}
                aria-label={t('nav.logout')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Top Header (< lg) */}
      <header className="lg:hidden sticky top-0 z-40 bg-[#0a0a0a] px-4 pt-[calc(0.875rem+env(safe-area-inset-top,0px))] pb-2 flex items-center justify-between shrink-0 border-b border-[#262626]">
        <button
          type="button"
          onClick={() => handleNavClick('workouts')}
          className="min-h-[44px] flex items-center text-[20px] font-bold tracking-tight text-[#fafafa] cursor-pointer"
        >
          duda.uz
        </button>

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className="h-[44px] px-3 rounded-[10px] text-[14px] font-medium text-[#fafafa] hover:bg-[#171717] flex items-center cursor-pointer"
        >
          {t('nav.menu')}
        </button>
      </header>

      {/* Mobile Full Sections Drawer (Screen 16) */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-[#0a0a0a] flex flex-col p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] overflow-y-auto">
          <div className="flex items-center justify-between pb-4">
            <span className="text-[20px] font-bold tracking-tight text-[#fafafa]">
              {t('nav.allSections')}
            </span>
            <Button
              isIconOnly
              size="md"
              variant="ghost"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label={t('common.close')}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="bg-[#171717] border border-[#404040] rounded-[14px] p-4 space-y-2">
            {mobileDrawerItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full h-[44px] px-4 rounded-[10px] border text-[14px] font-medium flex items-center justify-center transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#022c22] border-[#022c22] text-[#34d399]'
                      : 'bg-[#0a0a0a] border-[#404040] text-[#fafafa] hover:bg-[#262626]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 bg-[#171717] border border-[#404040] rounded-[14px] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-[#a3a3a3] truncate">{displayName}</span>
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
        {/* Desktop Breadcrumb & Context Header */}
        <div className="hidden lg:flex items-center justify-between gap-4 px-8 pt-6 pb-2 w-full max-w-[1220px] shrink-0">
          <div className="text-[13px] text-[#a3a3a3]">
            {t('nav.account')}  /  <span className="text-[#a3a3a3]">{sectionTitleMap[currentTab]}</span>
          </div>

          <div className="flex items-center gap-3 text-[13px] text-[#a3a3a3]">
            <PWAInstallButton className="hidden xl:flex" />
            <LanguageSwitchToggle variant="header" />
            <button
              type="button"
              onClick={() => setIsFeedbackOpen(true)}
              className="min-h-[44px] px-2 inline-flex items-center rounded-[8px] text-[13px] text-[#a3a3a3] hover:text-[#fafafa] hover:bg-[#171717] transition-colors cursor-pointer"
              title={t('nav.feedbackTitle') || 'Feedback'}
            >
              {t('nav.feedback') || 'Feedback'}
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('profile')}
              className="min-h-[44px] px-2 inline-flex items-center rounded-[8px] text-[13px] text-[#a3a3a3] hover:text-[#fafafa] hover:bg-[#171717] transition-colors cursor-pointer"
            >
              {language.toUpperCase()} · {displayName}
            </button>
          </div>
        </div>

        {/* Main Workspace Canvas */}
        <main
          className={
            isCoachView
              ? 'flex-1 min-h-0 w-full max-w-[1220px] px-4 sm:px-6 lg:px-8 py-2 lg:py-4 flex flex-col overflow-hidden relative'
              : 'flex-1 w-full max-w-[1220px] px-4 sm:px-6 lg:px-8 pt-3 lg:pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-12'
          }
        >
          {!isCoachView && <PWAInstallBanner />}
          {children}
        </main>
      </div>

      {/* Bottom Mobile Navigation Bar (5 core tabs matching Figma) */}
      <nav
        className={`${
          isCoachView ? 'shrink-0' : 'fixed bottom-0 left-0 right-0'
        } z-40 bg-[#0a0a0a] border-t border-[#262626] lg:hidden flex items-center justify-around px-1 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))]`}
        aria-label="Mobile Navigation"
      >
        {mobileBottomItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={`flex flex-col items-center justify-center gap-1 min-h-[44px] py-1 px-1 flex-1 min-w-0 transition-colors cursor-pointer ${
                isActive ? 'text-[#34d399]' : 'text-[#a3a3a3] hover:text-[#fafafa]'
              }`}
            >
              {item.icon}
              <span className="text-[11px] font-medium tracking-tight truncate max-w-full">
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
