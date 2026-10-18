import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Dumbbell, LineChart, LogOut, Bot, Utensils, ListTodo } from 'lucide-react';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { UserAvatar } from '../../../entities/user/ui/UserAvatar.tsx';
import { LanguageSwitchToggle } from '../../../features/switch-language/ui/LanguageSwitchToggle.tsx';
import { PWAInstallBanner } from '../../../features/pwa-install/ui/PWAInstallBanner.tsx';
import { PWAInstallButton } from '../../../features/pwa-install/ui/PWAInstallButton.tsx';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

export type NavTab =
  | 'workouts'
  | 'programs'
  | 'todo'
  | 'exercises'
  | 'history'
  | 'coach'
  | 'nutrition'
  | 'progress'
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

  const isNavItemActive = (itemId: NavTab): boolean => {
    if (itemId === 'workouts') {
      return currentTab === 'workouts' || currentTab === 'programs' || currentTab === 'exercises';
    }
    if (itemId === 'progress') {
      return currentTab === 'progress' || currentTab === 'history' || currentTab === 'body';
    }
    return currentTab === itemId;
  };

  const navItems: {
    id: NavTab;
    label: string;
    renderIcon: (active: boolean) => React.ReactNode;
  }[] = [
    {
      id: 'workouts',
      label: t('nav.workouts'),
      renderIcon: (active) => (
        <Dumbbell
          className={`w-4 h-4 md:w-5 md:h-5 transition-colors ${
            active ? 'text-brand-400' : 'text-zinc-400 group-hover:text-zinc-200'
          }`}
        />
      ),
    },
    {
      id: 'todo',
      label: t('nav.todo'),
      renderIcon: (active) => (
        <ListTodo
          className={`w-4 h-4 md:w-5 md:h-5 transition-colors ${
            active ? 'text-brand-400' : 'text-zinc-400 group-hover:text-zinc-200'
          }`}
        />
      ),
    },
    {
      id: 'nutrition',
      label: t('nav.nutrition'),
      renderIcon: (active) => (
        <Utensils
          className={`w-4 h-4 md:w-5 md:h-5 transition-colors ${
            active ? 'text-brand-400' : 'text-zinc-400 group-hover:text-zinc-200'
          }`}
        />
      ),
    },
    {
      id: 'coach',
      label: t('nav.coach'),
      renderIcon: (active) => (
        <Bot
          className={`w-4 h-4 md:w-5 md:h-5 transition-colors ${
            active ? 'text-brand-400' : 'text-zinc-400 group-hover:text-zinc-200'
          }`}
        />
      ),
    },
    {
      id: 'progress',
      label: t('nav.progress'),
      renderIcon: (active) => (
        <LineChart
          className={`w-4 h-4 md:w-5 md:h-5 transition-colors ${
            active ? 'text-brand-400' : 'text-zinc-400 group-hover:text-zinc-200'
          }`}
        />
      ),
    },
  ];

  return (
    <div
      className={
        isCoachView
          ? 'fixed inset-0 h-[100dvh] max-h-[100dvh] w-screen flex flex-col bg-dark-900 text-zinc-100 selection:bg-brand-500 selection:text-black overflow-hidden'
          : 'min-h-screen flex flex-col bg-dark-900 text-zinc-100 selection:bg-brand-500 selection:text-black'
      }
    >
      {/* Top App Header */}
      <header
        className={`${
          isCoachView ? 'shrink-0' : 'sticky top-0'
        } z-40 bg-dark-900/95 backdrop-blur border-b border-dark-800 px-3 sm:px-4 py-2.5 pt-[calc(0.625rem+env(safe-area-inset-top,0px))] flex items-center justify-between`}
      >
        <div className="flex items-center gap-4 sm:gap-6">
          <button
            onClick={() => handleNavClick('workouts')}
            className="flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-500 font-bold shadow-sm">
              <Dumbbell className="w-4 h-4" />
            </div>
            <span className="font-bold text-base tracking-tight hidden sm:inline">
              duda<span className="text-brand-500">.uz</span>
            </span>
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = isNavItemActive(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30 shadow-sm font-bold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-800'
                  }`}
                >
                  {item.renderIcon(isActive)}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3">
          <PWAInstallButton className="hidden lg:flex" />
          <LanguageSwitchToggle variant="header" />
          <div className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 border-l border-dark-700">
            <button
              onClick={() => handleNavClick('profile')}
              className={`flex items-center gap-2 p-1 rounded-lg transition-colors cursor-pointer ${
                currentTab === 'profile' ? 'ring-2 ring-brand-500/50 bg-dark-800' : 'hover:bg-dark-800'
              }`}
              title={t('nav.profile')}
            >
              <UserAvatar user={user} size="sm" />
              <span className="text-xs font-medium text-zinc-300 hidden sm:inline max-w-[100px] truncate">
                {user?.display_name}
              </span>
            </button>
            <button
              onClick={logout}
              className="text-zinc-500 hover:text-red-400 p-1.5 rounded-md transition-colors cursor-pointer"
              title={t('nav.logout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main
        className={
          isCoachView
            ? 'flex-1 min-h-0 w-full max-w-5xl mx-auto flex flex-col p-0 md:py-2 md:px-4 overflow-hidden relative'
            : 'flex-1 max-w-4xl w-full mx-auto p-3.5 sm:p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-8'
        }
      >
        {!isCoachView && <PWAInstallBanner />}
        {children}
      </main>

      {/* Bottom Mobile Navigation Bar (5 clean core items) */}
      <nav
        className={`${
          isCoachView ? 'shrink-0' : 'fixed bottom-0 left-0 right-0'
        } z-40 bg-dark-900/95 backdrop-blur border-t border-dark-800 md:hidden flex items-center justify-around py-1.5 px-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))]`}
      >
        {navItems.map((item) => {
          const isActive = isNavItemActive(item.id);
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`flex flex-col items-center gap-0.5 py-1 px-1.5 rounded-xl transition-all relative min-w-0 flex-1 group cursor-pointer ${
                isActive ? 'text-brand-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {item.renderIcon(isActive)}
              <span
                className={`text-[10px] tracking-tight truncate max-w-full ${
                  isActive ? 'text-brand-400 font-bold' : 'text-zinc-400'
                }`}
              >
                {item.label}
              </span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-brand-400 absolute -bottom-0.5" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

