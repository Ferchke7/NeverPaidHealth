# AI Skills & Architecture Guidelines for NeverPaidHealth

## Core Directives for All AI Coding Agents

### 1. Single Responsibility Per Page (One Task Per Page)
- Every screen, page, and route has strictly **ONE** job and focus.
- **NEVER** embed entire other pages inside tabs or sub-sections (e.g., do not embed `ProgramsPage` or `ExercisesPage` inside `WorkoutsPage`; do not embed `HistoryPage` or `BodyPage` inside `ProgressPage`).
- **NEVER** overload pages with secondary side widgets, mini-calendars, or unrelated dashboards.
- Examples:
  - **Workouts Page (`/workouts`)**: Strictly for running a quick workout, executing the current split day, and managing personal routines.
  - **Programs Page (`/programs`)**: Dedicated to split catalog, community splits, and split details.
  - **Exercises Page (`/exercises`)**: Dedicated to movement library, technique guides, and muscle filters.
  - **Progress Page (`/progress`)**: Strictly for strength progression (charts, PR hall of fame, muscle load balance, 1RM calculator).
  - **History Page (`/history`)**: Dedicated to past workout session calendar and log timeline.
  - **Body Page (`/body`)**: Dedicated to weight tracking, BMI, and body circumference measurements.
  - **Todo Page (`/todo`)**: Dedicated strictly to daily planning, task execution for the selected day, and its audit activity log.

---

### 2. Strict Third-Party Component Library Enforcement (@heroui/react)
- AI agents must **NEVER** write ad-hoc custom buttons, custom styled cards, raw inputs, raw spans for badges/chips, or hand-rolled modal overlays.
- We use the ready-made **HeroUI (`@heroui/react`)** component library across the entire project!
- You must **ALWAYS** import and use the verified design system primitives located in `frontend/src/shared/ui/` (which wrap and expose `@heroui/react`):
  - **Buttons:** `Button`, `ButtonGroup` from `@/shared/ui/button.tsx` (supports variants `primary`, `secondary`, `outline`, `ghost`, `flat`, sizes `xs`, `sm`, `md`, `lg`, and `isIconOnly`).
    - ❌ **DO NOT:** `<button className="px-3 py-1.5 rounded-xl bg-dark-800 ...">`
    - ✅ **DO:** `<Button variant="outline" size="sm">...</Button>`
  - **Cards & Surfaces:** `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` from `@/shared/ui/card.tsx`.
    - ❌ **DO NOT:** `<div className="p-4 rounded-2xl bg-dark-900 border border-dark-700 ...">`
    - ✅ **DO:** `<Card isHoverable className="...">...</Card>`
  - **Badges & Chips:** `Badge`, `Chip` from `@/shared/ui/card.tsx`.
    - ❌ **DO NOT:** `<span className="px-2 py-0.5 rounded-md bg-brand-500/15 text-brand-400 ...">`
    - ✅ **DO:** `<Badge variant="brand" size="sm">...</Badge>` or `<Chip variant="bordered" size="sm">...</Chip>`
  - **Inputs:** `Input`, `Textarea` from `@/shared/ui/input.tsx`.
  - **Modals:** `Modal` from `@/shared/ui/modal.tsx` (powered by `@heroui/react` `Modal.Root`, `Modal.Dialog`, `Modal.Body`).
    - ❌ **DO NOT:** Hand-roll `<div className="fixed inset-0 ...">` modal overlays.
    - ✅ **DO:** `<Modal isOpen={isOpen} onClose={onClose} title="...">...</Modal>`
  - **Progress Bars:** `ProgressBar` from `@/shared/ui/progress.tsx`.
  - **Navigation Tabs:** `Tabs` from `@/shared/ui/tabs.tsx`.
  - **Loading Skeletons:** `Skeleton` from `@/shared/ui/skeleton.tsx`.

---

### 3. State & Day Isolation
- Daily tasks must maintain strict temporal isolation:
  - Completing a task on day $D$ affects only day $D$.
  - On day $D+1$ (tomorrow), the task must remain pending unless explicitly completed on day $D+1$.
  - Every completion must generate a transparent, timestamped `ActivityLog` entry (`session_type = 'task_completed'`).
  - Unchecking a task cleanly removes its completion log entry.
