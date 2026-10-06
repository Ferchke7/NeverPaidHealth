# Stage 10 — Complete Workout UX, Offline Resilience & End-to-End Verification

## 1. Goal & Context
Complete the entire frontend user experience with **Hevy-grade functionality**: offline-resilient active workout logger (persisted in `localStorage`), background-accurate rest timer, live in-gym volume/1RM calculations, PR celebration modal, Recharts analytics, infinite-scroll workout history, and the full multi-service end-to-end verification (`task verify` + `task smoke`).

---

## 2. Deliverables & File Manifest

```
NeverPaidHealth/frontend/src/
├── entities/
│   ├── exercise/
│   │   ├── model/types.ts
│   │   └── ui/ExerciseCard.tsx, MuscleBadge.tsx
│   ├── workout/
│   │   ├── model/
│   │   │   ├── activeWorkoutStore.ts        # Zustand + persist(localStorage) for active workout session
│   │   │   ├── restTimerStore.ts            # Timestamp-based rest timer (accurate in background tabs)
│   │   │   └── calculations.ts              # Live UI volume & e1RM calculation
│   │   └── ui/SetRow.tsx, WorkoutHeader.tsx
│   ├── routine/
│   │   └── ui/RoutineCard.tsx
│   ├── progress/
│   │   └── ui/PRBadge.tsx, TrophyCard.tsx
│   └── body/
│       └── ui/BodyMetricInput.tsx
├── features/
│   ├── exercise-picker/
│   │   └── ui/ExercisePickerModal.tsx       # Virtualized list, search, muscle & equipment filters
│   ├── routine-builder/
│   │   └── ui/RoutineEditorModal.tsx        # Add exercises, set target rep ranges, save routine
│   ├── workout-logging/
│   │   ├── ui/LogSetInput.tsx               # Fast numeric steppers for weight & reps, RPE toggle
│   │   └── ui/FinishWorkoutDialog.tsx       # Validation check and submission trigger
│   ├── rest-timer/
│   │   └── ui/RestTimerBanner.tsx           # Floating countdown timer with +30s / -15s buttons & sound chime
│   ├── body-logger/
│   │   └── ui/AddBodyMeasurementDialog.tsx
│   └── custom-exercise/
│       └── ui/CreateCustomExerciseDialog.tsx
├── widgets/
│   ├── active-workout-panel/
│   │   └── ui/ActiveWorkoutSheet.tsx        # Full workout logging sheet
│   ├── workout-summary-modal/
│   │   └── ui/WorkoutSummaryModal.tsx       # Celebration modal showing PR badges, volume, and duration
│   ├── progress-charts/
│   │   └── ui/ExerciseProgressChart.tsx     # Recharts lazy-loaded 1RM & volume timeline
│   └── body-trend-chart/
│       └── ui/BodyTrendChart.tsx            # Recharts 7-day Simple Moving Average overlay
└── pages/
    ├── workouts/ui/WorkoutsPage.tsx         # Routines grid + Start Empty Workout button
    ├── history/ui/HistoryPage.tsx           # Infinite scroll past workouts
    ├── exercises/ui/ExercisesPage.tsx       # Full exercise catalog view
    ├── progress/ui/ProgressPage.tsx         # Personal records & exercise chart selection
    └── body/ui/BodyPage.tsx                 # Daily logs & body weight trend view
```

---

## 3. Technical Specifications

### 3.1 Active Workout Persistence & Resilience (`activeWorkoutStore.ts`)
- Stored in `localStorage` under key `neverpaid_active_workout_v1`.
- If the browser crashes, reloads, or device goes to sleep, the active workout state (exercises, sets, weights, completed checks, elapsed time) is restored immediately.
- On `finishWorkout` success, the local storage key is safely cleared.

### 3.2 Background-Accurate Rest Timer (`restTimerStore.ts`)
- Instead of simple `setInterval` tick decrementing (which throttles in background tabs):
  $$\text{Remaining Time} = \text{TargetEndTime} - \text{CurrentTimestamp}$$
- Web Audio API short chime sound played when timer reaches zero.

### 3.3 Live In-Workout Domain Calculations
- As the user types weight or reps, the set row dynamically displays:
  - Live calculated e1RM (e.g. `80 kg x 5 reps -> e1RM: 93.3 kg`).
  - Total workout volume live counter at the top of the sheet.

---

## 4. Khorikov Unit Testing for Stage 10

### Frontend Unit Tests (Vitest):
1. `activeWorkoutStore.test.ts`:
   - `testAddExercise_AppendsToWorkout`: Adds exercise block with default empty set.
   - `testCompleteSet_TogglesStateAndComputesVolume`: Toggling set complete updates running volume.
   - `testDiscardWorkout_ClearsState`: Resets active workout store.
2. `restTimerStore.test.ts`:
   - `testTimerStart_SetsTargetEndTime`: Verifies target end time calculation.

---

## 5. Step-by-Step Execution Checklist

- [ ] 1. Implement `activeWorkoutStore` and `restTimerStore` with Vitest tests.
- [ ] 2. Implement `ExercisePickerModal` with virtualized search & filtering.
- [ ] 3. Implement `ActiveWorkoutSheet`, `SetRow`, and live calculation displays.
- [ ] 4. Implement `WorkoutSummaryModal` with PR celebration badge rendering.
- [ ] 5. Implement `RoutineEditorModal` and `WorkoutsPage`.
- [ ] 6. Implement `HistoryPage` with infinite scroll pagination.
- [ ] 7. Implement `ProgressPage` and lazy-loaded Recharts `ExerciseProgressChart`.
- [ ] 8. Implement `BodyPage` and `BodyTrendChart` with 7-day moving average visualization.
- [ ] 9. Run full-stack test suite (`task verify`).
- [ ] 10. Run Docker Compose smoke test (`task smoke`) hitting all service health endpoints.
- [ ] 11. Create comprehensive user guide in `walkthrough.md`.

---

## 6. Definition of Done
- Complete workout tracking application is operational with all required features.
- Zero TypeScript errors (`tsc --noEmit`), zero ESLint boundary violations.
- Backend Khorikov unit tests (Go) and Frontend unit tests (Vitest) 100% passing.
- `task verify` succeeds.
