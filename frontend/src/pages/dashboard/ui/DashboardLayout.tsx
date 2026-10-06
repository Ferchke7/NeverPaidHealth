import React from 'react';
import { Dumbbell, History, LineChart, BookOpen, LogOut, Bot, User, Activity } from 'lucide-react';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { UserAvatar } from '../../../entities/user/ui/UserAvatar.tsx';
import { UnitSwitchToggle } from '../../../features/switch-units/ui/UnitSwitchToggle.tsx';

export type NavTab = 'workouts' | 'programs' | 'exercises' | 'history' | 'coach' | 'progress' | 'body' | 'profile';

interface DashboardLayoutProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  activeTab,
  onSelectTab,
  children,
}) => {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const navItems: { id: NavTab; label: string; icon: React.ReactNode; isAI?: boolean }[] = [
    { id: 'workouts', label: 'Workouts', icon: <Dumbbell className="w-4 h-4 md:w-5 md:h-5" /> },
    { id: 'programs', label: 'Programs', icon: <BookOpen className="w-4 h-4 md:w-5 md:h-5" /> },
    { id: 'exercises', label: 'Exercises', icon: <Activity className="w-4 h-4 md:w-5 md:h-5" /> },
    { id: 'history', label: 'History', icon: <History className="w-4 h-4 md:w-5 md:h-5" /> },
    { id: 'coach', label: 'AI Coach', icon: <Bot className="w-4 h-4 md:w-5 md:h-5 text-brand-400" />, isAI: true },
    { id: 'progress', label: 'Progress', icon: <LineChart className="w-4 h-4 md:w-5 md:h-5" /> },
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4 md:w-5 md:h-5" /> },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-dark-900 text-zinc-100">
      {/* Top App Header */}
      <header className="sticky top-0 z-40 bg-dark-900/90 backdrop-blur border-b border-dark-800 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button
            onClick={() => onSelectTab('workouts')}
            className="flex items-center gap-2.5 hover:opacity-90 transition-opacity"
          >
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-500 font-bold">
              <Dumbbell className="w-4 h-4" />
            </div>
            <span className="font-bold text-base tracking-tight hidden sm:inline">
              duda<span className="text-brand-500">.uz</span>
            </span>
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    isActive
                      ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-800'
                  }`}
                >
                  {item.icon}
                  {item.label}
                  {item.isAI && (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <UnitSwitchToggle />
          <div className="flex items-center gap-2 pl-2 border-l border-dark-700">
            <button
              onClick={() => onSelectTab('profile')}
              className={`flex items-center gap-2 p-1 rounded-lg transition-colors ${
                activeTab === 'profile' ? 'ring-2 ring-brand-500/50 bg-dark-800' : 'hover:bg-dark-800'
              }`}
              title="Open Profile"
            >
              <UserAvatar user={user} size="sm" />
              <span className="text-xs font-medium text-zinc-300 hidden sm:inline max-w-[100px] truncate">
                {user?.display_name}
              </span>
            </button>
            <button
              onClick={logout}
              className="text-zinc-500 hover:text-red-400 p-1.5 rounded-md transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 pb-24 md:pb-8">
        {children}
      </main>

      {/* Bottom Mobile Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-dark-900/95 backdrop-blur border-t border-dark-800 md:hidden flex items-center justify-around py-1.5 px-1">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center gap-0.5 py-1 px-1 rounded-xl transition-all relative min-w-0 flex-1 ${
                isActive ? 'text-brand-500 font-bold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {item.icon}
              <span className="text-[9px] tracking-tight truncate">{item.label}</span>
              {item.isAI && (
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 absolute top-1 right-2 animate-pulse" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
