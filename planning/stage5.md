# Stage 5 — Exercise Catalog Bounded Context (Exercise Microservice)

## 1. Goal & Context
Implement the **Exercise Catalog Microservice** (`backend/services/exercise`). Manages the comprehensive standard exercise library (~120 pre-seeded exercises with primary/secondary muscle groups and equipment classifications), custom user exercises, measurement types, and high-performance HTTP ETag caching.

---

## 2. Deliverables & File Manifest

```
NeverPaidHealth/backend/services/exercise/
├── go.mod
├── cmd/server/main.go                       # Composition root
├── migrations/
│   ├── 000001_create_exercises_table.up.sql# Exercises table, custom user index, unique constraints
│   ├── 000001_create_exercises_table.down.sql
│   ├── 000002_seed_exercises.up.sql        # ~120 standard gym movements (Barbell, Dumbbell, Machine, etc.)
│   └── 000002_seed_exercises.down.sql
├── sqlc.yaml
├── queries.sql                              # Queries: list with filters (muscle/equipment), get by ID, insert custom
├── oapi-codegen.yaml
├── internal/
│   ├── domain/                              # PURE DOMAIN
│   │   └── exercise/
│   │       ├── exercise.go                  # Exercise aggregate root
│   │       ├── exercise_test.go             # Khorikov tests: seed immutability, name validation, invariants
│   │       ├── muscle_group.go              # MuscleGroup VO (Chest, Back, Quads, Shoulders, etc.)
│   │       ├── equipment.go                 # Equipment VO (Barbell, Dumbbell, Cable, Machine, etc.)
│   │       ├── measurement_type.go          # MeasurementType VO (weight_reps, bodyweight_reps, duration, distance)
│   │       └── errors.go
│   ├── application/
│   │   ├── ports.go                         # ExerciseRepo, Clock
│   │   ├── command/
│   │   │   ├── create_custom_exercise.go    # Add user-specific exercise
│   │   │   └── delete_custom_exercise.go    # Soft-delete or archive user-specific exercise
│   │   └── query/
│   │       ├── list_exercises.go            # Filter by muscle group, equipment, search query + ETag calculation
│   │       └── get_exercise.go              # Single exercise lookup
│   ├── adapters/
│   │   ├── postgres/                        # sqlc generated code + repository implementation
│   │   │   ├── db.go
│   │   │   ├── queries.sql.go
│   │   │   └── exercise_repository.go
│   │   └── memory/                          # In-memory fakes for BDD specs
│   │       └── fake_exercise_repo.go
│   └── transport/http/                      # oapi-codegen strict server
│       ├── handler.go                       # Maps OpenAPI endpoints -> Application commands/queries
│       └── etag_middleware.go               # Computes MD5 hash/catalog version for HTTP 304 Not Modified
└── features/
    ├── exercise_catalog.go                  # Godog BDD step definitions
    └── catalog.feature                      # Copied/symlinked from docs/specs/exercise/catalog.feature
```

---

## 3. Technical Specifications

### 3.1 Domain Invariants
- `Exercise`:
  - `Name`: 2–80 characters, trimmed.
  - `IsCustom`: boolean. If `false`, `UserID` must be nil (Global Seed). If `true`, `UserID` must be present.
  - `Seeded Exercises`: Read-only, cannot be updated or deleted by any user.
  - `MeasurementType`:
    - `weight_reps`: Standard strength training (Bench Press, Squat).
    - `bodyweight_reps`: Calisthenics with optional added weight (Pull-ups, Dips).
    - `duration`: Timed exercises (Plank).
    - `distance_duration`: Cardio (Running, Rowing).
  - `TargetMuscle`: Primary muscle group required; secondary muscle groups optional list.

### 3.2 Performance & HTTP ETag Caching
- Exercise catalog is read frequently and modified rarely.
- `GET /exercises` generates an `ETag` based on the system catalog version + user custom exercise timestamp.
- If client sends `If-None-Match: <etag>`, handler immediately returns `304 Not Modified` with empty body.

---

## 4. Khorikov Unit Testing & BDD for Stage 5

### Khorikov Unit Tests (max 2-3 per rule):
1. `TestExercise_CreateSeeded_CannotBeMutatedOrDeleted`:
   - Asserts seeded exercise rejects update/delete operations.
2. `TestExercise_CreateCustom_RequiresValidNameAndMuscle`:
   - Validates name length bounds (1 char fails, 2 chars succeeds, 81 chars fails).
3. `TestExercise_MeasurementType_ValidValues`:
   - Asserts unknown measurement type returns domain error.

### Godog BDD Scenarios (`features/catalog.feature`):
- `Scenario: User filters exercise library by Chest muscle group and Barbell equipment`
- `Scenario: User creates a custom exercise and retrieves it alongside standard exercises`
- `Scenario: Attempting to delete a standard seeded exercise is rejected`

---

## 5. Step-by-Step Execution Checklist

- [ ] 1. Create `backend/services/exercise` module and add to `go.work`.
- [ ] 2. Implement domain entities and value objects with unit tests (`exercise_test.go`).
- [ ] 3. Write SQL migrations for table creation and ~120 exercise seeds.
- [ ] 4. Write application use cases, queries, and in-memory fakes.
- [ ] 5. Generate sqlc database access code and wire postgres repository.
- [ ] 6. Implement OpenAPI strict server handler with ETag support.
- [ ] 7. Implement Godog BDD step definitions in `features/`.
- [ ] 8. Verify compilation and test suite pass (`go test ./...`).

---

## 6. Definition of Done
- `exercise-service` completely functional with ~120 seeded exercises.
- Khorikov unit tests and Godog BDD scenarios passing.
- Clean Architecture verified by `archtest`.
