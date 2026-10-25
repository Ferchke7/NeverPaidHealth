# AI Skills & Architecture Guidelines for NeverPaidHealth

## Core Directives for All AI Coding Agents

### 1. Single Responsibility Per Page (One Task Per Page)
- Every screen, page, and route has strictly **ONE** job and focus.
- **NEVER** overload pages with secondary side widgets, mini-calendars, or unrelated dashboards.
- Examples:
  - **Todo Page (`/todo`)**: Dedicated strictly to daily planning, task execution for the selected day, and its audit activity log. No side mini-calendars or sidebar widgets.
  - **Workouts Page (`/workouts`)**: Dedicated strictly to active workouts and saved workout routines.
  - **Progress Page (`/progress`)**: Dedicated strictly to charts and athletic progression.

### 2. Strict Design System Usage (Zero Custom Wheels)
- AI agents must **NEVER** write ad-hoc custom buttons, custom styled cards, raw inputs, or custom modal wrappers.
- You must **ALWAYS** use the existing, verified design system primitives located in `frontend/src/shared/ui/`:
  - `Button` from `@/shared/ui/button.tsx`
  - `Card`, `CardContent`, `CardHeader`, `CardTitle`, `Badge`, `Chip` from `@/shared/ui/card.tsx`
  - `Input`, `Textarea` from `@/shared/ui/input.tsx`
  - `Modal` from `@/shared/ui/modal.tsx`
  - `ProgressBar`, `CircularProgress` from `@/shared/ui/progress.tsx`
  - `Skeleton` from `@/shared/ui/skeleton.tsx`
  - `Tabs` from `@/shared/ui/tabs.tsx`

### 3. State & Day Isolation
- Daily tasks must maintain strict temporal isolation:
  - Completing a task on day $D$ affects only day $D$.
  - On day $D+1$ (tomorrow), the task must remain pending unless explicitly completed on day $D+1$.
  - Every completion must generate a transparent, timestamped `ActivityLog` entry.
  - Unchecking a task cleanly removes its completion log entry.
