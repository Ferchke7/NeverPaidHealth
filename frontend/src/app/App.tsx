import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../entities/user/model/authStore.ts';
import { LoginPage } from '../pages/login/ui/LoginPage.tsx';
import { DashboardLayout } from '../pages/dashboard/ui/DashboardLayout.tsx';
import { WorkoutsPage } from '../pages/workouts/ui/WorkoutsPage.tsx';
import { ProgramsPage } from '../pages/programs/ui/ProgramsPage.tsx';
import { HistoryPage } from '../pages/history/ui/HistoryPage.tsx';
import { ExercisesPage } from '../pages/exercises/ui/ExercisesPage.tsx';
import { ProgressPage } from '../pages/progress/ui/ProgressPage.tsx';
import { BodyPage } from '../pages/body/ui/BodyPage.tsx';
import { AICoachPage } from '../pages/coach/ui/AICoachPage.tsx';
import { NutritionPage } from '../pages/nutrition/ui/NutritionPage.tsx';
import { TodoCalendarPage } from '../pages/todo/ui/TodoCalendarPage.tsx';
import ProfilePage from '../pages/profile/ui/ProfilePage.tsx';
import { ActiveWorkoutSheet } from '../widgets/active-workout-panel/ui/ActiveWorkoutSheet.tsx';
import { FloatingFocusTimer } from '../features/focus-timer/ui/FloatingFocusTimer.tsx';
import { ErrorBoundary } from '../shared/ui/ErrorBoundary.tsx';

const ProtectedLayout: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const navigate = useNavigate();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <ErrorBoundary>
      <DashboardLayout>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Navigate to="/workouts" replace />} />
            <Route path="/workouts" element={<WorkoutsPage onNavigateToPrograms={() => navigate('/programs')} />} />
            <Route path="/todo" element={<TodoCalendarPage />} />
            <Route path="/programs" element={<ProgramsPage onNavigateToWorkouts={() => navigate('/workouts')} />} />
            <Route path="/nutrition" element={<NutritionPage />} />
            <Route path="/coach" element={<AICoachPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/exercises" element={<ExercisesPage />} />
            <Route path="/body" element={<BodyPage />} />
            <Route path="/profile" element={<ProfilePage onNavigateToBody={() => navigate('/body')} />} />
            <Route path="*" element={<Navigate to="/workouts" replace />} />
          </Routes>
        </ErrorBoundary>

        {/* Global floating active workout sheet */}
        <ActiveWorkoutSheet />

        {/* Global floating / fullscreen Pomodoro & Focus Timer */}
        <FloatingFocusTimer />
      </DashboardLayout>
    </ErrorBoundary>
  );
};

export const App: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const checkSession = useAuthStore((s) => s.checkSession);

  React.useEffect(() => {
    void checkSession();
  }, [checkSession]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/workouts" replace /> : <LoginPage />}
        />
        <Route path="/*" element={<ProtectedLayout />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
