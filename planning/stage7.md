# Stage 7 — Training Application, Outbox & Async Progress Service

## 1. Goal & Context
Implement the **Training Application Layer** (`backend/services/training`) with Transactional Outbox publishing to NATS JetStream, and the **Progress Microservice** (`backend/services/progress`) which consumes `WorkoutFinished` events asynchronously to detect Personal Records (PRs) and build exercise progression history charts.

---

## 2. Deliverables & File Manifest

```
NeverPaidHealth/backend/
├── services/training/
│   ├── migrations/
│   │   ├── 000001_create_training_tables.up.sql  # routines, workouts, workout_sets, outbox tables
│   │   └── 000001_create_training_tables.down.sql
│   ├── sqlc.yaml
│   ├── queries.sql
│   ├── internal/
│   │   ├── application/                          # Use cases & orchestration
│   │   │   ├── ports.go                          # WorkoutRepo, RoutineRepo, ExerciseCatalogACL, OutboxRepo, Clock
│   │   │   ├── command/                          # StartWorkout, LogSet, CompleteSet, FinishWorkout, CreateRoutine...
│   │   │   └── query/                            # GetActiveWorkout, ListWorkoutHistory, GetRoutine
│   │   ├── adapters/
│   │   │   ├── postgres/                         # sqlc repo + outbox writer
│   │   │   ├── exercisecatalog/                  # HTTP client to exercise-service (Anti-Corruption Layer)
│   │   │   ├── memory/                           # In-memory repositories for BDD
│   │   │   └── outboxworker/                     # Background outbox publisher -> NATS JetStream
│   │   └── transport/http/                       # oapi-codegen strict server handlers
│   └── features/                                 # Godog BDD step definitions
└── services/progress/
    ├── go.mod
    ├── cmd/server/main.go
    ├── migrations/
    │   ├── 000001_create_progress_tables.up.sql  # personal_records, exercise_history, processed_events
    │   └── 000001_create_progress_tables.down.sql
    ├── sqlc.yaml
    ├── queries.sql
    ├── internal/
    │   ├── domain/                               # PURE DOMAIN
    │   │   ├── record/                           # RecordBook aggregate & PR calculation logic
    │   │   │   ├── record_book.go
    │   │   │   ├── record_book_test.go           # Khorikov tests: PR detection, strictly greater rule
    │   │   │   └── pr_type.go                    # heaviest_weight, best_e1rm, max_volume_set, max_reps
    │   │   └── history/                          # ExerciseHistory aggregate
    │   ├── application/                          # Event handler: HandleWorkoutFinished (idempotent)
    │   │   ├── ports.go                          # RecordBookRepo, HistoryRepo, IdempotencyStore
    │   │   └── handler/
    │   │       └── on_workout_finished.go
    │   ├── adapters/
    │   │   ├── postgres/                         # Progress sqlc repo
    │   │   ├── nats/                             # NATS JetStream durable consumer
    │   │   └── memory/                           # In-memory fakes
    │   └── transport/http/                       # Query endpoints (/progress/records, /progress/history/{id})
    └── features/                                 # Godog BDD step definitions
```

---

## 3. Technical Specifications

### 3.1 Transactional Outbox Pattern (`training-service`)
When `FinishWorkout` completes:
1. In a single Postgres transaction:
   - `workouts` row status updated to `finished`.
   - `outbox` row inserted with payload conforming to `contracts/events/workout-finished.v1.schema.json`.
2. Outbox worker polls `outbox` table, publishes message to NATS subject `WORKOUT.finished`, and marks outbox row `published_at = NOW()`.

### 3.2 Progress PR Detection Engine (`progress-service`)
```go
// progress/internal/domain/record/record_book.go
func (rb *ExerciseRecordBook) ApplySet(set PerformanceSet) []PersonalRecord {
    var newPRs []PersonalRecord
    // 1. Heaviest Weight: must be strictly greater than previous best
    if set.WeightKg > rb.BestWeightKg {
        rb.BestWeightKg = set.WeightKg
        newPRs = append(newPRs, PersonalRecord{Type: PRHeaviestWeight, Value: set.WeightKg})
    }
    // 2. Best e1RM: must be strictly greater
    if set.E1RMKg != nil && *set.E1RMKg > rb.BestE1RMKg {
        rb.BestE1RMKg = *set.E1RMKg
        newPRs = append(newPRs, PersonalRecord{Type: PRBestE1RM, Value: *set.E1RMKg})
    }
    return newPRs
}
```

### 3.3 Idempotent Event Consumer
- `progress-service` checks `processed_events` table before executing `HandleWorkoutFinished`.
- If `event_id` already exists, ACK message and skip processing without error.

---

## 4. Khorikov Unit Testing & BDD for Stage 7

### Khorikov Unit Tests:
1. `record_book_test.go`:
   - `TestRecordBook_Apply_FirstWorkout_SetsAllInitialPRs`: Empty record book gains PRs for weight, e1RM, reps, volume.
   - `TestRecordBook_Apply_LighterWeight_DoesNotCreatePR`: Lifting 80 kg when best is 100 kg creates 0 new PRs.
   - `TestRecordBook_Apply_EqualWeight_DoesNotCreatePR`: Lifting 100 kg when best is 100 kg creates 0 new PRs (must be strictly greater).
2. `progress_application_test.go`:
   - `TestHandler_DuplicateEvent_IsIdempotent`: Processing identical event twice results in single record set.
3. `training_application_test.go`:
   - `TestFinishWorkout_WritesToOutboxInSameUoW`: Verifies outbox repository receives event envelope upon finish.

### Godog BDD Scenarios:
- `Scenario: Completing a heavier set records a new Heaviest Weight PR`
- `Scenario: Finishing workout appends data point to Exercise History chart series`

---

## 5. Step-by-Step Execution Checklist

- [ ] 1. Create `training-service` application commands, queries, and outbox publisher.
- [ ] 2. Create `training-service` SQL migrations and sqlc repositories.
- [ ] 3. Create `progress-service` domain model (`RecordBook`, PR types) with Khorikov tests.
- [ ] 4. Implement `progress-service` idempotent event handler and in-memory fakes.
- [ ] 5. Implement `progress-service` SQL migrations, sqlc repositories, and HTTP query endpoints.
- [ ] 6. Implement NATS JetStream consumer in `progress-service`.
- [ ] 7. Implement Godog BDD step definitions for both training and progress services.

---

## 6. Definition of Done
- `training-service` and `progress-service` compile and pass all unit/BDD tests.
- Outbox publishing and NATS event schema compliance verified.
- `task verify` passes.
