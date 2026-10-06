# Stage 1 — AI Anti-Hallucination Pipeline & Monorepo Foundation

## 1. Goal & Context
Set up the monorepo foundation, developer tooling, multi-database infrastructure, and the **AI Anti-Hallucination Pipeline**. Any AI agent (or developer) operating on this repository will be bound by machine-enforced architectural rules, explicit glossary terms, golden calculation vectors, and a single-command verification suite (`task verify`).

---

## 2. Deliverables & File Manifest

```
NeverPaidHealth/
├── AGENTS.md                                # Root AI instructions (always active)
├── .agents/
│   ├── rules/
│   │   ├── ddd.md                           # DDD layers, aggregates, value objects & boundary rules
│   │   ├── testing.md                       # Khorikov testing laws (2-3 tests/rule, no mocks of in-process code, no integration tests)
│   │   ├── go-backend.md                    # Go 1.26 idioms, stdlib-only domain, error handling, slog
│   │   └── frontend.md                      # Feature-Sliced Design, state split (TanStack Query vs Zustand), zero hand-written types
│   └── skills/
│       ├── add-use-case/SKILL.md            # Step-by-step guide for implementing an application command/query
│       ├── add-endpoint/SKILL.md            # Contract-first workflow: OpenAPI -> task gen -> transport adapter
│       ├── add-domain-event/SKILL.md        # Event schema -> Outbox -> NATS publisher/consumer workflow
│       ├── add-frontend-feature/SKILL.md    # FSD slice scaffolding: entity -> feature -> widget -> page
│       ├── write-khorikov-test/SKILL.md     # Red-Green-Refactor recipe for unit & BDD tests
│       └── add-migration/SKILL.md           # SQL migration workflow per microservice
├── docs/
│   ├── architecture.md                      # C4 Context & Container diagrams, bounded contexts, async event flows
│   ├── glossary.md                          # Ubiquitous Language definitions (User, Workout, Set, Exercise, PR, Routine, BodyLog, etc.)
│   ├── calculations.md                      # Mathematical definitions (Volume, E1RM Epley, Moving Average, BMI, PR comparisons)
│   └── adr/
│       ├── 0001-microservices-monorepo.md   # Decision record: Microservices monorepo with Go & React
│       ├── 0002-transactional-outbox.md     # Decision record: Outbox pattern over dual-writes
│       ├── 0003-khorikov-testing-limits.md  # Decision record: Unit tests only, no integration tests
│       └── 0004-fsd-frontend.md             # Decision record: Feature-Sliced Design for React UI
├── contracts/
│   └── calculation-vectors.json             # Golden test vectors shared between Go domain tests & Vitest frontend tests
├── deploy/
│   ├── docker-compose.yml                   # Postgres 17 (5 DBs initialized) + NATS JetStream
│   └── init-db.sql                          # Postgres initialization script creating isolated databases
├── .editorconfig
├── .gitignore
├── .golangci.yml                            # Linting with depguard forbidding domain external imports
├── lefthook.yml                             # Fast pre-commit git hook running formatting & lint checks
└── Taskfile.yml                             # Master automation: task verify, task dev, task gen, task test
```

---

## 3. Technical Specifications

### 3.1 Ubiquitous Language (`docs/glossary.md`)
Must strictly define:
- `Workout`: An active or completed training session consisting of logged exercises and sets.
- `Routine`: A reusable template/blueprint for starting workouts (e.g., "Push Day A").
- `Exercise`: A physical movement catalog item with a defined `MeasurementType` and target `MuscleGroup`.
- `Set`: A discrete performance record within an exercise, categorized by `SetType` (`normal`, `warmup`, `drop`, `failure`).
- `Personal Record (PR)`: The all-time strictly superior achievement for an exercise across 4 dimensions: `heaviest_weight`, `best_e1rm`, `max_volume_set`, `max_reps`.
- `BodyLog`: A single-day record of body weight, body fat %, and circumference measurements.
- `Weight`: Stored strictly as integer **grams** in backend domain and database to eliminate floating-point errors.

### 3.2 Golden Calculation Vectors (`contracts/calculation-vectors.json`)
```json
{
  "e1rm": [
    { "weight_kg": 100.0, "reps": 1, "expected_e1rm_kg": 100.0, "description": "1 rep exact weight" },
    { "weight_kg": 100.0, "reps": 5, "expected_e1rm_kg": 116.7, "description": "Epley formula 100*(1 + 5/30)" },
    { "weight_kg": 80.0, "reps": 10, "expected_e1rm_kg": 106.7, "description": "Epley formula 80*(1 + 10/30)" },
    { "weight_kg": 100.0, "reps": 15, "expected_e1rm_kg": null, "description": "Reps > 12 are unreliable, returns null" }
  ],
  "volume": [
    {
      "sets": [
        { "weight_kg": 100.0, "reps": 5, "type": "normal", "completed": true },
        { "weight_kg": 100.0, "reps": 5, "type": "warmup", "completed": true },
        { "weight_kg": 100.0, "reps": 5, "type": "normal", "completed": false }
      ],
      "expected_volume_kg": 500.0,
      "description": "Warmup and uncompleted sets are excluded from total volume"
    }
  ],
  "bmi": [
    { "weight_kg": 80.0, "height_cm": 180.0, "expected_bmi": 24.7 }
  ],
  "moving_average_7day": [
    { "weights_kg": [80.0, 80.5, 80.2, 79.8, 80.1, 79.9, 80.3], "expected_avg_kg": 80.1 }
  ]
}
```

### 3.3 Database Scaffolding (`deploy/docker-compose.yml` & `init-db.sql`)
Multi-DB Postgres container initializing 5 isolated databases:
- `identity_db`
- `exercise_db`
- `training_db`
- `progress_db`
- `body_db`
Along with NATS Server with JetStream enabled (`nats:latest` with `-js`).

### 3.4 Automation & Quality Gate (`Taskfile.yml`)
Key tasks:
- `task gen`: Run `sqlc generate`, `oapi-codegen`, and `orval`.
- `task gen:check`: Verify that `git diff` on generated files is clean (anti-drift gate).
- `task lint`: Run `golangci-lint run ./...` and `npm run lint`.
- `task test`: Run `go test ./...` and `npm test`.
- `task verify`: Combined pipeline: `gen:check` + `lint` + `test` + `tsc --noEmit`.

---

## 4. Khorikov Unit Testing & Quality Checks for Stage 1

1. **Rule File Completeness Test:** Ensure all 4 rule files and 6 skill files exist and contain non-empty YAML frontmatter or headers.
2. **Schema Validation:** Ensure `contracts/calculation-vectors.json` is strictly valid JSON conforming to the calculation definitions in `docs/calculations.md`.
3. **Lint Configuration Test:** Ensure `.golangci.yml` contains `depguard` configured to forbid `backend/services/*/internal/domain` from importing any external packages (stdlib only).

---

## 5. Step-by-Step Execution Checklist

- [ ] 1. Create root `AGENTS.md` specifying anti-hallucination non-negotiables.
- [ ] 2. Create `.agents/rules/` (`ddd.md`, `testing.md`, `go-backend.md`, `frontend.md`).
- [ ] 3. Create `.agents/skills/` (`add-use-case`, `add-endpoint`, `add-domain-event`, `add-frontend-feature`, `write-khorikov-test`, `add-migration`).
- [ ] 4. Create `docs/architecture.md`, `docs/glossary.md`, `docs/calculations.md`, and ADRs.
- [ ] 5. Create `contracts/calculation-vectors.json` with golden calculation test cases.
- [ ] 6. Create `deploy/docker-compose.yml` and `deploy/init-db.sql`.
- [ ] 7. Create `.golangci.yml`, `lefthook.yml`, `Taskfile.yml`, `.editorconfig`, `.gitignore`.

---

## 6. Definition of Done
- All files created and verified.
- `Taskfile.yml` syntax validated.
- Docker compose config validated (`docker compose -f deploy/docker-compose.yml config`).
