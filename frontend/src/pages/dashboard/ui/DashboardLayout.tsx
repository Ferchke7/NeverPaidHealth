import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Dumbbell,
  LineChart,
  LogOut,
  Bot,
  Utensils,
  ListTodo,
  MessageSquarePlus,
  BookOpen,
  Layers,
  History,
  Scale,
} from 'lucide-react';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { UserAvatar } from '../../../entities/user/ui/UserAvatar.tsx';
import { Button } from '../../../shared/ui/button.tsx';
import { LanguageSwitchToggle } from '../../../features/switch-language/ui/LanguageSwitchToggle.tsx';
import { PWAInstallBanner } from '../../../features/pwa-install/ui/PWAInstallBanner.tsx';
import { PWAInstallButton } from '../../../features/pwa-install/ui/PWAInstallButton.tsx';
import { FeedbackModal } from '../../../features/feedback/ui/FeedbackModal.tsx';
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
  const { t } = useTranslation();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  // Derive active tab from URL path
  const pathSegment = location.pathname.replace(/^\//, '').split('/')[0] as NavTab;
  const currentTab: NavTab = explicitActiveTab || pathSegment || 'workouts';
  const isCoachView = currentTab === 'coach';

  const handleNavClick = (tabId: NavTab) => {
    if (onSelectTab) {
      onSelectTab(tabId);
    }
    navigate(`/${tabId}`);
  };

  // Primary bottom mobile tabs (5 high-frequency actions)
  const mobileBottomItems: {
    id: NavTab;
    label: string;
    icon: React.ReactNode;
  }[] = [
    { id: 'workouts', label: t('nav.workouts') || 'Тренировка', icon: <Dumbbell className="w-4 h-4" /> },
    { id: 'todo', label: t('nav.todo') || 'План', icon: <ListTodo className="w-4 h-4" /> },
    { id: 'nutrition', label: t('nav.nutrition') || 'Питание', icon: <Utensils className="w-4 h-4" /> },
    { id: 'coach', label: t('nav.coach') || 'Тренер', icon: <Bot className="w-4 h-4" /> },
    { id: 'progress', label: t('nav.progress') || 'Прогресс', icon: <LineChart className="w-4 h-4" /> },
  ];

  // Full desktop navbar tabs (strictly 1:1 with pages)
  const desktopNavItems: {
    id: NavTab;
    label: string;
    icon: React.ReactNode;
  }[] = [
    { id: 'workouts', label: t('nav.workouts') || 'Тренировки', icon: <Dumbbell className="w-4 h-4" /> },
    { id: 'programs', label: t('nav.programs') || 'Программы', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'exercises', label: t('exercises.title') || 'Упражнения', icon: <Layers className="w-4 h-4" /> },
    { id: 'todo', label: t('nav.todo') || 'План', icon: <ListTodo className="w-4 h-4" /> },
    { id: 'nutrition', label: t('nav.nutrition') || 'Питание', icon: <Utensils className="w-4 h-4" /> },
    { id: 'coach', label: t('nav.coach') || 'AI Тренер', icon: <Bot className="w-4 h-4" /> },
    { id: 'progress', label: t('nav.progress') || 'Прогресс', icon: <LineChart className="w-4 h-4" /> },
    { id: 'history', label: t('history.title') || 'История', icon: <History className="w-4 h-4" /> },
    { id: 'body', label: t('body.title') || 'Тело', icon: <Scale className="w-4 h-4" /> },
  ];

  // Secondary mobile quick navigation pills (accessible under header on mobile)
  const secondaryMobilePills: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'programs', label: t('nav.programs') || 'Programs', icon: <BookOpen className="w-3 h-3" /> },
    { id: 'exercises', label: t('exercises.title') || 'Exercises', icon: <Layers className="w-3 h-3" /> },
    { id: 'history', label: t('history.title') || 'History', icon: <History className="w-3 h-3" /> },
    { id: 'body', label: t('body.title') || 'Body', icon: <Scale className="w-3 h-3" /> },
  ];

  return (
    <div
      className={
        isCoachView
          ? 'fixed inset-0 h-[100dvh] max-h-[100dvh] w-screen flex flex-col bg-dark-950 text-zinc-100 selection:bg-brand-500 selection:text-black overflow-hidden'
          : 'min-h-screen flex flex-col bg-dark-950 text-zinc-100 selection:bg-brand-500 selection:text-black'
      }
    >
      {/* Top App Header */}
      <header
        className={`${
          isCoachView ? 'shrink-0' : 'sticky top-0'
        } z-40 bg-dark-900/90 backdrop-blur-md border-b border-dark-800/80 px-3 sm:px-6 py-2.5 pt-[calc(0.625rem+env(safe-area-inset-top,0px))] flex items-center justify-between transition-colors`}
      >
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          {/* Brand Logo */}
          <button
            onClick={() => handleNavClick('workouts')}
            className="flex items-center gap-2.5 hover:opacity-90 transition-opacity cursor-pointer shrink-0"
          >
            <div className="w-8 h-8 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold shadow-sm">
              <Dumbbell className="w-4 h-4" />
            </div>
            <span className="font-black text-base tracking-tight text-white hidden sm:inline">
              duda<span className="text-brand-400">.uz</span>
            </span>
          </button>

          {/* Desktop Clean Navigation Links (1 page = 1 item) */}
          <nav className="hidden xl:flex items-center gap-1 min-w-0">
            {desktopNavItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30 shadow-sm font-bold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-800/60'
                  }`}
                >
                  <span className={isActive ? 'text-brand-400' : 'text-zinc-400'}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Medium Desktop (lg) Compact Nav */}
          <nav className="hidden md:flex xl:hidden items-center gap-1 min-w-0">
            {desktopNavItems.slice(0, 6).map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`px-2 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30 font-bold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-800/60'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Header Utilities: Feedback, Language, Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFeedbackOpen(true)}
            className="gap-1 text-xs font-semibold"
            title={t('nav.feedbackTitle') || 'Feedback'}
          >
            <MessageSquarePlus className="w-3.5 h-3.5 text-brand-400" />
            <span className="hidden sm:inline">{t('nav.feedback') || 'Feedback'}</span>
          </Button>

          <PWAInstallButton className="hidden lg:flex" />
          <LanguageSwitchToggle variant="header" />

          <div className="flex items-center gap-1.5 sm:gap-2 pl-2 border-l border-dark-800">
            <button
              onClick={() => handleNavClick('profile')}
              className={`flex items-center gap-2 p-1 rounded-xl transition-all cursor-pointer ${
                currentTab === 'profile'
                  ? 'ring-2 ring-brand-500/50 bg-dark-800'
                  : 'hover:bg-dark-800/60'
              }`}
              title={t('nav.profile')}
            >
              <UserAvatar user={user} size="sm" />
              <span className="text-xs font-medium text-zinc-300 hidden sm:inline max-w-[90px] truncate">
                {user?.display_name}
              </span>
            </button>

            <Button
              isIconOnly
              size="xs"
              variant="ghost"
              onClick={logout}
              className="text-zinc-500 hover:text-red-400"
              title={t('nav.logout')}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Secondary Mobile Quick-Pill Bar (For mobile discovery of Programs, Exercises, History, Body) */}
      {!isCoachView && (
        <div className="md:hidden border-b border-dark-800/60 bg-dark-900/60 px-3 py-1.5 overflow-x-auto flex items-center gap-1.5 scrollbar-none">
          {secondaryMobilePills.map((pill) => {
            const isActive = currentTab === pill.id;
            return (
              <Button
                key={pill.id}
                size="xs"
                variant={isActive ? 'primary' : 'outline'}
                onClick={() => handleNavClick(pill.id)}
                className="gap-1 text-[11px] whitespace-nowrap font-semibold"
              >
                {pill.icon}
                <span>{pill.label}</span>
              </Button>
            );
          })}
        </div>
      )}

      {/* Main Page Canvas (spacious, breathable, centered) */}
      <main
        className={
          isCoachView
            ? 'flex-1 min-h-0 w-full max-w-5xl mx-auto flex flex-col p-0 md:py-2 md:px-4 overflow-hidden relative'
            : 'flex-1 max-w-4xl w-full mx-auto p-3.5 sm:p-6 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-12'
        }
      >
        {!isCoachView && <PWAInstallBanner />}
        {children}
      </main>

      {/* Bottom Mobile Navigation Bar (5 core high-frequency tabs) */}
      <nav
        className={`${
          isCoachView ? 'shrink-0' : 'fixed bottom-0 left-0 right-0'
        } z-40 bg-dark-900/95 backdrop-blur-lg border-t border-dark-800/80 md:hidden flex items-center justify-around py-1.5 px-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))]`}
      >
        {mobileBottomItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`flex flex-col items-center gap-0.5 py-1 px-1 rounded-xl transition-all relative min-w-0 flex-1 group cursor-pointer ${
                isActive ? 'text-brand-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className={`transition-transform ${isActive ? 'scale-110' : ''}`}>
                {item.icon}
              </div>
              <span
                className={`text-[10px] tracking-tight truncate max-w-full ${
                  isActive ? 'text-brand-400 font-bold' : 'text-zinc-400'
                }`}
              >
                {item.label}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 absolute -bottom-0.5" />
              )}
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
