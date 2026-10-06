# Stage 8 — Body Measurements Bounded Context & Trend Analytics

## 1. Goal & Context
Implement the **Body Metrics Microservice** (`backend/services/body`). Manages daily physical measurements (body weight, body fat percentage, body circumferences), calculates BMI, and computes a **7-day Simple Moving Average (SMA)** trend to smooth out natural daily water weight fluctuations.

---

## 2. Deliverables & File Manifest

```
NeverPaidHealth/backend/services/body/
├── go.mod
├── cmd/server/main.go                       # Composition root
├── migrations/
│   ├── 000001_create_body_tables.up.sql    # body_logs table (user_id + log_date UNIQUE)
│   └── 000001_create_body_tables.down.sql
├── sqlc.yaml
├── queries.sql                              # Upsert daily log, query date range, delete log
├── oapi-codegen.yaml
├── internal/
│   ├── domain/                              # PURE DOMAIN
│   │   └── body/
│   │       ├── body_log.go                  # BodyLog aggregate root (date-keyed)
│   │       ├── body_log_test.go             # Khorikov tests: daily upsert, bounds validation
│   │       ├── weight.go                    # BodyWeight VO (20kg - 400kg)
│   │       ├── body_fat.go                  # BodyFatPercentage VO (2.0% - 70.0%)
│   │       ├── circumferences.go            # Circumferences VO (waist, chest, arms, thighs, neck)
│   │       ├── bmi.go                       # Pure BMI calculation (kg / m^2)
│   │       ├── trend.go                     # 7-day Simple Moving Average (SMA) calculation
│   │       └── errors.go
│   ├── application/
│   │   ├── ports.go                         # BodyLogRepo, Clock
│   │   ├── command/
│   │   │   ├── log_body_measurement.go      # Add or update log for date
│   │   │   └── delete_body_measurement.go   # Remove log for date
│   │   └── query/
│   │       ├── get_body_history.go          # Range queries for charting
│   │       └── get_body_trend.go            # Computes SMA trend and 30/90 day delta
│   ├── adapters/
│   │   ├── postgres/                        # sqlc generated code + repository
│   │   │   ├── db.go
│   │   │   ├── queries.sql.go
│   │   │   └── body_repository.go
│   │   └── memory/                          # In-memory fakes for BDD
│   │       └── fake_body_repo.go
│   └── transport/http/                      # oapi-codegen strict server handlers
│       ├── handler.go
│       └── mapper.go
└── features/
    ├── body_tracking.go                     # Godog BDD step definitions
    └── body_tracking.feature                # Copied/symlinked from docs/specs/body/body_tracking.feature
```

---

## 3. Technical Specifications

### 3.1 Domain Invariants & Calculations
1. **Date Invariant:** Exactly **one** `BodyLog` per user per calendar date (UTC). Submitting a new measurement for an existing date updates the existing log (upsert).
2. **Measurement Bounds:**
   - Body Weight: $20.0\text{ kg} \le \text{weight} \le 400.0\text{ kg}$.
   - Body Fat: $2.0\% \le \text{fat} \le 70.0\%$.
   - Circumferences: $10.0\text{ cm} \le \text{circumference} \le 250.0\text{ cm}$.
3. **BMI Formula:**
   $$\text{BMI} = \frac{\text{weight in kg}}{(\text{height in meters})^2}$$
   Rounded to 1 decimal place ($0.1$).
4. **7-Day Simple Moving Average (SMA):**
   $$\text{SMA}_t = \frac{1}{N} \sum_{i=0}^{N-1} W_{t-i} \quad (N \le 7)$$
   Smooths out daily spikes for clear progress trend lines.

---

## 4. Khorikov Unit Testing & BDD for Stage 8

### Khorikov Unit Tests:
1. `body_log_test.go`:
   - `TestBodyLog_WeightOutOfRange_ReturnsError`: Rejects 15 kg and 500 kg with `ErrWeightOutOfRange`.
   - `TestBodyLog_BodyFatOutOfRange_ReturnsError`: Rejects 1% and 75% with `ErrBodyFatOutOfRange`.
2. `bmi_test.go` (reading `contracts/calculation-vectors.json`):
   - `TestBMI_GoldenVectors`: 80 kg @ 180 cm -> BMI 24.7.
3. `trend_test.go` (reading `contracts/calculation-vectors.json`):
   - `TestTrend_7DaySMA_GoldenVectors`: Verifies moving average calculation across test vectors.

### Godog BDD Scenarios (`features/body_tracking.feature`):
- `Scenario: Logging body weight updates BMI and 7-day trend`
- `Scenario: Logging a second measurement on the same day updates the previous record`

---

## 5. Step-by-Step Execution Checklist

- [ ] 1. Create `backend/services/body` module and add to `go.work`.
- [ ] 2. Implement domain models (`BodyLog`, `BodyWeight`, `BodyFat`, `BMI`, `Trend`) with Khorikov tests.
- [ ] 3. Write SQL migrations for `body_logs` table (with `UNIQUE(user_id, log_date)` constraint).
- [ ] 4. Write application use cases, queries, and in-memory fakes.
- [ ] 5. Implement sqlc postgres adapter and OpenAPI strict server handler.
- [ ] 6. Implement Godog BDD step definitions in `features/`.
- [ ] 7. Run `go test ./...` and verify Clean Architecture compliance via `archtest`.

---

## 6. Definition of Done
- `body-service` fully implemented and tested.
- All calculation vectors match Go domain calculations.
- Clean Architecture verified (`archtest` passes).
