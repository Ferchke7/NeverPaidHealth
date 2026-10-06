# Go Backend Architectural Rules

## 1. Go Idioms & Quality Standards
- Go version: `1.26+`.
- Structured logging using standard `log/slog` with contextual fields (trace ID, user ID).
- Error handling: Sentinel errors in `internal/domain/*/errors.go` (e.g. `var ErrWorkoutNotInProgress = errors.New(...)`). Use `errors.Is` for checking.
- Do not use panic for control flow.
- Pure domain packages must never import `net/http`, `database/sql`, `pgx`, `chi`, `gorm`, etc.

## 2. Multi-Module Monorepo Structure
- Backend workspace managed with `go.work`.
- Modules:
  - `backend/pkg`: Reusable platform utilities (no domain models).
  - `backend/gateway`: Reverse proxy & auth middleware.
  - `backend/services/identity`: Auth & user profile microservice.
  - `backend/services/exercise`: Exercise catalog microservice.
  - `backend/services/training`: Routines, workouts & sets microservice.
  - `backend/services/progress`: PRs & progression history microservice.
  - `backend/services/body`: Body measurements & trend microservice.
  - `backend/archtest`: AST-based Clean Architecture verification suite.

## 3. Database Access
- Use `sqlc` to generate type-safe Go from raw SQL queries.
- Schema migrations managed by `golang-migrate` files (`*.up.sql`, `*.down.sql`).
