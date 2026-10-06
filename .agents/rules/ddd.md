# Domain-Driven Design (DDD) & Clean Architecture Rules

## 1. Domain Layer (`internal/domain/`)
- **Isolation:** Contains Entities, Value Objects, Domain Events, Domain Services, and Domain Errors.
- **Zero External Dependencies:** Only Go standard library packages (e.g. `time`, `math`, `errors`, `strings`, `slices`) are allowed.
- **Value Objects:**
  - Immutable structures.
  - Constructed via validation functions (e.g. `NewWeightKg(float64) (Weight, error)`).
  - Encapsulate invariant logic. Unrepresentable states cannot be constructed.
- **Aggregates:**
  - Control their own internal invariants.
  - State changes occur exclusively via methods on the Aggregate Root.
  - Record Domain Events for side-effects (e.g. `aggregate.recordEvent(WorkoutFinished{...})`).

## 2. Application Layer (`internal/application/`)
- **Use Cases:** Orchestrate domain models and invoke ports (commands & queries).
- **Ports:** Interfaces defined by the application layer for what it needs from the outside world:
  - Repository interfaces (`WorkoutRepo`, `UserRepo`).
  - External service ports (`ExerciseCatalogPort`).
  - Infrastructure ports (`Clock`, `IDGen`, `OutboxRepo`).
- **No Domain Logic:** Application services contain no business rules or mathematical calculations; they only coordinate.

## 3. Adapters Layer (`internal/adapters/`)
- Implements application port interfaces:
  - `postgres/`: sqlc-generated queries and repository structs.
  - `memory/`: In-memory fakes for BDD specs and unit testing.
  - `nats/` or `outboxworker/`: Event publishing and subscription handling.
  - `exercisecatalog/`: HTTP client with Anti-Corruption Layer (ACL).

## 4. Transport Layer (`internal/transport/`)
- Humble delivery layer:
  - `http/`: Handlers implementing `oapi-codegen` generated strict server interfaces.
  - Mappers between HTTP request/response DTOs and Application command/query models.
  - Zero business decision-making.
