# Stage 2 — Single Source of Truth & Contracts-First Domain Design

## 1. Goal & Context
Establish the formal **Single Source of Truth** for all APIs, Domain Events, and Behavior Specifications before any implementation code is written. By strictly defining OpenAPI 3.1 contracts, JSON Schemas for events, and Gherkin `.feature` specifications, we eliminate API drift, contract guessing, and cross-team hallucinations.

---

## 2. Deliverables & File Manifest

```
NeverPaidHealth/
├── contracts/
│   ├── openapi/
│   │   ├── identity.yaml                    # /auth/google, /auth/dev-login, /auth/refresh, /me, /profile
│   │   ├── exercise.yaml                    # /exercises (GET, POST), /exercises/{id}, /muscle-groups, /equipment
│   │   ├── training.yaml                    # /routines (CRUD), /workouts (CRUD, /finish, /sets CRUD)
│   │   ├── progress.yaml                    # /progress/records, /progress/history/{exerciseId}, /progress/summary
│   │   └── body.yaml                        # /body/logs (CRUD, date-keyed), /body/trend
│   └── events/
│       └── workout-finished.v1.schema.json  # Schema for async NATS event emitted by training-service
├── docs/
│   └── specs/
│       ├── identity/
│       │   └── auth.feature                 # BDD specs for Google auth, dev-login, token refresh
│       ├── exercise/
│       │   └── catalog.feature              # BDD specs for listing, filtering, seed immutability, custom creation
│       ├── training/
│       │   ├── workout_logging.feature      # BDD specs for logging sets, RPE, completing, finishing
│       │   └── routines.feature             # BDD specs for routine creation, starting workout from template
│       ├── progress/
│       │   └── pr_detection.feature         # BDD specs for record book updates & history tracking
│       └── body/
│           └── body_tracking.feature        # BDD specs for body logs, BMI, and 7-day trend calculations
├── backend/
│   └── (service configs)/
│       ├── services/identity/oapi-codegen.yaml
│       ├── services/exercise/oapi-codegen.yaml
│       ├── services/training/oapi-codegen.yaml
│       ├── services/progress/oapi-codegen.yaml
│       └── services/body/oapi-codegen.yaml
└── frontend/
    └── orval.config.ts                      # Orval configuration generating TS client, TanStack Query hooks & Zod schemas
```

---

## 3. Technical Specifications

### 3.1 OpenAPI Contracts Design
- Strict adherence to OpenAPI 3.1.
- All request/response schemas must be fully typed (no `type: object` with unspecified properties).
- Standardized error schema (`ProblemDetails` RFC 7807):
  ```yaml
  ProblemDetails:
    type: object
    required: [type, title, status, detail]
    properties:
      type: { type: string, example: "https://neverpaidhealth.dev/errors/workout-not-in-progress" }
      title: { type: string, example: "Workout Not In Progress" }
      status: { type: integer, example: 400 }
      detail: { type: string, example: "Cannot log a set to a finished workout" }
      code: { type: string, example: "ERR_WORKOUT_NOT_IN_PROGRESS" }
  ```

### 3.2 Event Contract (`contracts/events/workout-finished.v1.schema.json`)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "WorkoutFinishedV1",
  "type": "object",
  "required": ["event_id", "occurred_at", "user_id", "workout_id", "duration_seconds", "total_volume_kg", "completed_sets_count", "exercises"],
  "properties": {
    "event_id": { "type": "string", "format": "uuid" },
    "occurred_at": { "type": "string", "format": "date-time" },
    "user_id": { "type": "string", "format": "uuid" },
    "workout_id": { "type": "string", "format": "uuid" },
    "duration_seconds": { "type": "integer", "minimum": 0 },
    "total_volume_kg": { "type": "number", "minimum": 0 },
    "completed_sets_count": { "type": "integer", "minimum": 1 },
    "exercises": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["exercise_id", "exercise_name", "sets"],
        "properties": {
          "exercise_id": { "type": "string", "format": "uuid" },
          "exercise_name": { "type": "string" },
          "sets": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["set_type", "weight_kg", "reps", "completed"],
              "properties": {
                "set_type": { "type": "string", "enum": ["normal", "warmup", "drop", "failure"] },
                "weight_kg": { "type": "number" },
                "reps": { "type": "integer" },
                "rpe": { "type": ["number", "null"] },
                "completed": { "type": "boolean" },
                "calculated_e1rm_kg": { "type": ["number", "null"] }
              }
            }
          }
        }
      }
    }
  }
}
```

### 3.3 BDD Gherkin Specifications
Each `.feature` file maps directly to user-facing behavior in the Ubiquitous Language:
- Given / When / Then steps.
- Zero technical implementation details (no HTTP codes or database references inside `.feature` steps).

---

## 4. Khorikov Unit Testing & Quality Checks for Stage 2

1. **OpenAPI Schema Linting:** Validate all OpenAPI documents using a schema linter or standard yaml parser.
2. **Event Schema Validation:** Validate `workout-finished.v1.schema.json` against JSON Schema draft 2020-12 meta-schema.
3. **Feature File Syntax Check:** Verify all `.feature` files parse correctly with standard Gherkin parsers (`godog --dry-run`).
4. **Codegen Dry-Run Test:** Ensure `oapi-codegen` and `orval` configs are valid and point to existing YAML paths.

---

## 5. Step-by-Step Execution Checklist

- [ ] 1. Create `contracts/openapi/identity.yaml` with Google auth, dev-login, refresh, profile endpoints.
- [ ] 2. Create `contracts/openapi/exercise.yaml` with catalog retrieval, filtering, and custom exercise creation.
- [ ] 3. Create `contracts/openapi/training.yaml` with routine management and live workout logging endpoints.
- [ ] 4. Create `contracts/openapi/progress.yaml` with PR queries and exercise history charts.
- [ ] 5. Create `contracts/openapi/body.yaml` with daily body metrics and trend analytics.
- [ ] 6. Create `contracts/events/workout-finished.v1.schema.json`.
- [ ] 7. Create all Gherkin specifications in `docs/specs/**/*.feature`.
- [ ] 8. Configure `oapi-codegen.yaml` for each Go microservice and `orval.config.ts` for the frontend.
- [ ] 9. Add `task gen` and `task gen:check` tasks to `Taskfile.yml`.

---

## 6. Definition of Done
- All 5 OpenAPI files, event schema, and 6 BDD `.feature` specs created.
- `task gen` generates Go strict server interfaces and TypeScript client code without errors.
- `task gen:check` validates zero uncommitted codegen drift.
