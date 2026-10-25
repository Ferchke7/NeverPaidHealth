import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../entities/user/model/authStore.ts';
import { DashboardLayout } from '../pages/dashboard/ui/DashboardLayout.tsx';
import { ActiveWorkoutSheet } from '../widgets/active-workout-panel/ui/ActiveWorkoutSheet.tsx';
import { FloatingFocusTimer } from '../features/focus-timer/ui/FloatingFocusTimer.tsx';
import { ErrorBoundary } from '../shared/ui/ErrorBoundary.tsx';

// Lazy-loaded routes for instant initial page loads and zero navigation lag
const LoginPage = lazy(() => import('../pages/login/ui/LoginPage.tsx').then((m) => ({ default: m.LoginPage })));
const WorkoutsPage = lazy(() => import('../pages/workouts/ui/WorkoutsPage.tsx').then((m) => ({ default: m.WorkoutsPage })));
const ProgramsPage = lazy(() => import('../pages/programs/ui/ProgramsPage.tsx').then((m) => ({ default: m.ProgramsPage })));
const HistoryPage = lazy(() => import('../pages/history/ui/HistoryPage.tsx').then((m) => ({ default: m.HistoryPage })));
const ExercisesPage = lazy(() => import('../pages/exercises/ui/ExercisesPage.tsx').then((m) => ({ default: m.ExercisesPage })));
const ProgressPage = lazy(() => import('../pages/progress/ui/ProgressPage.tsx').then((m) => ({ default: m.ProgressPage })));
const BodyPage = lazy(() => import('../pages/body/ui/BodyPage.tsx').then((m) => ({ default: m.BodyPage })));
const AICoachPage = lazy(() => import('../pages/coach/ui/AICoachPage.tsx').then((m) => ({ default: m.AICoachPage })));
const NutritionPage = lazy(() => import('../pages/nutrition/ui/NutritionPage.tsx').then((m) => ({ default: m.NutritionPage })));
const TodoCalendarPage = lazy(() => import('../pages/todo/ui/TodoCalendarPage.tsx').then((m) => ({ default: m.TodoCalendarPage })));
const ProfilePage = lazy(() => import('../pages/profile/ui/ProfilePage.tsx'));

const PageFallback: React.FC = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
  </div>
);

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
          <Suspense fallback={<PageFallback />}>
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
          </Suspense>
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
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to="/workouts" replace /> : <LoginPage />}
          />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
