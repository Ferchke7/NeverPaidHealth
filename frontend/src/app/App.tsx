import React, { useState } from 'react';
import { useAuthStore } from '../entities/user/model/authStore.ts';
import { LoginPage } from '../pages/login/ui/LoginPage.tsx';
import { DashboardLayout, NavTab } from '../pages/dashboard/ui/DashboardLayout.tsx';
import { WorkoutsPage } from '../pages/workouts/ui/WorkoutsPage.tsx';
import { ProgramsPage } from '../pages/programs/ui/ProgramsPage.tsx';
import { HistoryPage } from '../pages/history/ui/HistoryPage.tsx';
import { ExercisesPage } from '../pages/exercises/ui/ExercisesPage.tsx';
import { ProgressPage } from '../pages/progress/ui/ProgressPage.tsx';
import { BodyPage } from '../pages/body/ui/BodyPage.tsx';
import { AICoachPage } from '../pages/coach/ui/AICoachPage.tsx';
import { NutritionPage } from '../pages/nutrition/ui/NutritionPage.tsx';
import { TodoCalendarPage } from '../pages/todo/ui/TodoCalendarPage.tsx';
import { ProfilePage } from '../pages/profile/ui/ProfilePage.tsx';
import { ActiveWorkoutSheet } from '../widgets/active-workout-panel/ui/ActiveWorkoutSheet.tsx';
import { FloatingFocusTimer } from '../features/focus-timer/ui/FloatingFocusTimer.tsx';

export const App: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [activeTab, setActiveTab] = useState<NavTab>('workouts');

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <DashboardLayout activeTab={activeTab} onSelectTab={setActiveTab}>
      {activeTab === 'workouts' && (
        <WorkoutsPage onNavigateToPrograms={() => setActiveTab('programs')} />
      )}
      {activeTab === 'todo' && <TodoCalendarPage />}
      {activeTab === 'programs' && (
        <ProgramsPage onNavigateToWorkouts={() => setActiveTab('workouts')} />
      )}
      {activeTab === 'nutrition' && <NutritionPage />}
      {activeTab === 'history' && <HistoryPage />}
      {activeTab === 'coach' && <AICoachPage />}
      {activeTab === 'progress' && <ProgressPage />}
      {activeTab === 'exercises' && <ExercisesPage />}
      {activeTab === 'body' && <BodyPage />}
      {activeTab === 'profile' && <ProfilePage onNavigateToBody={() => setActiveTab('body')} />}

      {/* Floating / Fullsheet Active Workout Logger */}
      <ActiveWorkoutSheet />

      {/* Floating / Fullscreen Focus & Pomodoro Timer */}
      <FloatingFocusTimer />
    </DashboardLayout>
  );
};
export default App;
