# Frontend Architecture & Feature-Sliced Design Rules

## 1. Feature-Sliced Design (FSD) Layers
Directory hierarchy (strictly top-to-bottom imports):
1. `app`: App-level providers (QueryProvider, AuthProvider, RouterProvider), global css.
2. `pages`: Routing screens that compose widgets and features (zero low-level UI styling).
3. `widgets`: Self-contained UI blocks (e.g. `ActiveWorkoutSheet`, `ExerciseProgressChart`).
4. `features`: User actions (e.g. `log-set`, `finish-workout`, `auth-google`, `switch-units`).
5. `entities`: Business domain models, pure selectors, cache keys, presentational cards (e.g. `workout`, `exercise`, `user`, `progress`, `body`).
6. `shared`: Generic UI kit, API clients, math/unit utilities, config.

## 2. State Management Partitioning
- **Server State:** Owned exclusively by **TanStack Query v5**.
- **Active Workout In-Gym State:** Owned by **Zustand** with `persist` middleware storing to `localStorage` key `neverpaid_active_workout_v1`.
- **Auth State:** Access token held strictly in memory in `authStore`. Silent token refresh via `POST /auth/refresh` on 401s.
- **Form State:** `react-hook-form` + Orval-generated `zod` schemas.

## 3. Mathematical & Calculation Parity
- All calculations for 1RM, volume, and BMI in `entities/*/model/` must strictly match the output from `contracts/calculation-vectors.json`.
- Tested via Vitest.
