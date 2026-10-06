# Stage 6 — Training Domain Engine & Calculations (DDD Core)

## 1. Goal & Context
Implement the core **Training Domain Model and Calculation Engine** (`backend/services/training/internal/domain`). This is the mathematical and structural heart of NeverPaidHealth. It contains zero database dependencies, zero HTTP dependencies (stdlib only), and guarantees exact calculation correctness verified against `contracts/calculation-vectors.json`.

---

## 2. Deliverables & File Manifest

```
NeverPaidHealth/backend/services/training/
├── go.mod
├── internal/
│   └── domain/                              # PURE GO DOMAIN (stdlib only)
│       ├── measure/                         # Immutable Value Objects
│       │   ├── weight.go                    # Integer grams, conversion to/from kg and lb
│       │   ├── weight_test.go               # Khorikov unit tests for exact gram conversion
│       │   ├── reps.go                      # Rep count VO (1-200)
│       │   ├── rpe.go                       # Rate of Perceived Exertion (6.0-10.0, step 0.5)
│       │   ├── set_type.go                  # SetType VO ("normal", "warmup", "drop", "failure")
│       │   └── duration.go                  # Duration in seconds
│       ├── calc/                            # Pure domain calculation services
│       │   ├── e1rm.go                      # Epley estimated 1RM calculator
│       │   ├── volume.go                    # Total workout & set volume calculation
│       │   ├── summary.go                   # Full workout summary aggregator
│       │   └── calc_test.go                 # Table-driven Khorikov tests verifying calculation-vectors.json
│       ├── routine/                         # Routine aggregate
│       │   ├── routine.go                   # Routine aggregate root
│       │   ├── routine_exercise.go          # Template exercise & target sets/reps
│       │   ├── routine_test.go              # Khorikov tests: minimum exercises, rep range bounds
│       │   └── errors.go
│       └── workout/                         # Workout aggregate
│           ├── workout.go                   # Workout aggregate root
│           ├── workout_exercise.go          # Logged exercise in workout
│           ├── workout_set.go               # Individual set state machine (log, edit, complete)
│           ├── events.go                    # Domain event: WorkoutFinished
│           ├── workout_test.go              # Khorikov tests: state transitions, invariants, finish requirements
│           └── errors.go
```

---

## 3. Technical Specifications

### 3.1 Immutable Value Objects (`measure/`)
```go
// measure/weight.go
type Weight struct { grams int64 }

func NewWeightKg(kg float64) (Weight, error) {
    if kg < 0 || kg > 1000 { return Weight{}, ErrWeightOutOfRange }
    return Weight{grams: int64(math.Round(kg * 1000))}, nil
}
func NewWeightLb(lb float64) (Weight, error) {
    return NewWeightKg(lb * 0.45359237)
}
func (w Weight) Kg() float64 { return float64(w.grams) / 1000 }
func (w Weight) Lb() float64 { return (float64(w.grams) / 1000) * 2.20462262 }
```

### 3.2 Pure Calculation Services (`calc/`)
- **Estimated 1RM (Epley Formula):**
  $$\text{1RM} = \text{weight} \times \left(1 + \frac{\text{reps}}{30}\right)$$
  - For $\text{reps} = 1 \implies \text{1RM} = \text{weight}$.
  - For $\text{reps} > 12 \implies \text{returns nil}$ (Epley is empirically invalid beyond 12 reps).
  - Rounded to 1 decimal place ($0.1\text{ kg}$).
- **Volume Calculation:**
  $$\text{Total Volume} = \sum_{\text{completed working sets}} (\text{weight} \times \text{reps})$$
  - Excludes sets where `SetType == SetTypeWarmup`.
  - Excludes sets where `Completed == false`.
  - Bodyweight sets count as $0\text{ kg}$ volume unless additional weight was logged.

### 3.3 Aggregate Invariants (`workout/` & `routine/`)
- `Workout`:
  - Starts in state `WorkoutStatusInProgress`.
  - Sets can only be added, modified, or marked complete while `InProgress`.
  - `Workout.Finish(now time.Time)` requires $\ge 1$ completed working set.
  - Upon finish, status transitions to `WorkoutStatusFinished`, and domain event `WorkoutFinished` is recorded.
- `Routine`:
  - `Name` must be non-empty and $\le 100$ characters.
  - Must contain at least 1 exercise.
  - `StartWorkout(workoutID, now)` constructs a new `Workout` instance pre-populated with template exercises.

---

## 4. Khorikov Unit Testing for Stage 6

### Unit Test Catalog:
1. `weight_test.go`:
   - `TestWeight_KgToGramsAndBack_IsExact`: Tests 100.5 kg -> 100500 grams -> 100.5 kg.
   - `TestWeight_NegativeWeight_ReturnsError`: Rejects -5 kg with `ErrWeightOutOfRange`.
2. `calc_test.go` (reading `contracts/calculation-vectors.json`):
   - `TestCalc_E1RM_GoldenVectors`: Runs all vectors in `e1rm` array.
   - `TestCalc_Volume_GoldenVectors`: Runs all vectors in `volume` array.
3. `workout_test.go`:
   - `TestWorkout_LogSet_WhenNotInProgress_ReturnsError`: Logging to finished workout returns `ErrWorkoutNotInProgress`.
   - `TestWorkout_Finish_WithoutCompletedSets_ReturnsError`: Finishing with 0 completed sets returns `ErrNothingToFinish`.
   - `TestWorkout_Finish_EmitsWorkoutFinishedEvent`: Finishing records event containing exact summary volume & duration.
4. `routine_test.go`:
   - `TestRoutine_Create_EmptyExercises_ReturnsError`: Creating routine without exercises returns `ErrRoutineRequiresExercises`.
   - `TestRoutine_StartWorkout_CopiesExercisesInExactOrder`: Starting workout matches routine structure.

---

## 5. Step-by-Step Execution Checklist

- [ ] 1. Create `measure/` package with `Weight`, `Reps`, `RPE`, `SetType`, and unit tests.
- [ ] 2. Implement `calc/` calculation engine (`e1rm.go`, `volume.go`, `summary.go`).
- [ ] 3. Implement test harness in `calc_test.go` loading `contracts/calculation-vectors.json`.
- [ ] 4. Implement `routine/` aggregate and invariants.
- [ ] 5. Implement `workout/` aggregate, set state machine, and `WorkoutFinished` event.
- [ ] 6. Run `go test ./...` and ensure all tests pass with zero external dependencies.

---

## 6. Definition of Done
- Pure domain models and calculation engines implemented.
- 100% of calculation test vectors match Go calculations.
- Clean Architecture verified (`archtest` passes).
