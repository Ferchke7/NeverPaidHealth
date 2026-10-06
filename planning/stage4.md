# Stage 4 — Identity & Access Bounded Context (Auth Microservice)

## 1. Goal & Context
Implement the **Identity & Access Microservice** (`backend/services/identity`). Handles user authentication (Google ID Token verification + local dev-mode fallback), JWT issuance/refresh, user profiles, and unit preference management (`kg` vs `lb`) following Clean Architecture & DDD.

---

## 2. Deliverables & File Manifest

```
NeverPaidHealth/backend/services/identity/
├── go.mod
├── cmd/server/main.go                       # Composition root
├── migrations/
│   ├── 000001_create_users_table.up.sql    # Users table, refresh_tokens table, indexes
│   └── 000001_create_users_table.down.sql
├── sqlc.yaml
├── queries.sql                              # sqlc type-safe queries for user CRUD & tokens
├── oapi-codegen.yaml
├── internal/
│   ├── domain/                              # PURE DOMAIN (stdlib only)
│   │   └── user/
│   │       ├── user.go                      # User aggregate root
│   │       ├── user_test.go                 # Khorikov unit tests: creation, unit switch, invariants
│   │       ├── email.go                     # Email Value Object (validation)
│   │       ├── unit_preference.go           # UnitPreference VO ("kg" | "lb")
│   │       └── errors.go                    # Domain error constants
│   ├── application/                         # Use cases and port interfaces
│   │   ├── ports.go                         # UserRepo, RefreshTokenRepo, TokenIssuer, GoogleVerifier, Clock
│   │   ├── command/
│   │   │   ├── authenticate_google.go       # Verify ID token, get/create user, issue tokens
│   │   │   ├── dev_login.go                 # Development login bypass (guarded by AUTH_DEV_MODE)
│   │   │   ├── refresh_token.go             # Rotate refresh token & issue new access token
│   │   │   └── update_unit_preference.go    # Change kg <-> lb
│   │   └── query/
│   │       └── get_profile.go               # Fetch user profile & preferences
│   ├── adapters/
│   │   ├── postgres/                        # sqlc generated code + repository implementation
│   │   │   ├── db.go
│   │   │   ├── models.go
│   │   │   ├── queries.sql.go
│   │   │   └── user_repository.go
│   │   ├── google/                          # Google ID Token verifier adapter
│   │   │   └── verifier.go
│   │   └── memory/                          # In-memory fakes for BDD & application tests
│   │       ├── fake_user_repo.go
│   │       └── fake_google_verifier.go
│   └── transport/http/                      # Humble HTTP adapter (oapi-codegen strict server)
│       ├── handler.go                       # Maps OpenAPI endpoints -> Application commands
│       └── mapper.go                        # Domain/App models -> HTTP DTOs
└── features/
    ├── identity_auth.go                     # Godog BDD step definitions
    └── auth.feature                         # Copied/symlinked from docs/specs/identity/auth.feature
```

---

## 3. Technical Specifications

### 3.1 Domain Model & Invariants
- `User`:
  - `ID`: UUIDv4
  - `GoogleSub`: string (unique, indexed)
  - `Email`: `Email` VO (rfc5322 regex validation)
  - `DisplayName`: string (1–100 characters)
  - `AvatarURL`: string (valid URI or empty)
  - `UnitPreference`: `UnitPreference` VO (`kg` default, or `lb`)
  - `CreatedAt`, `UpdatedAt`: `time.Time`

```go
// internal/domain/user/unit_preference.go
type UnitPreference string
const (
    UnitKg UnitPreference = "kg"
    UnitLb UnitPreference = "lb"
)
func NewUnitPreference(val string) (UnitPreference, error) {
    switch strings.ToLower(val) {
    case "kg": return UnitKg, nil
    case "lb": return UnitLb, nil
    default: return "", ErrInvalidUnitPreference
    }
}
```

### 3.2 Authentication Strategy
1. **Google ID Token (`POST /auth/google`):**
   - Receives `{ "id_token": "..." }`.
   - Adapter validates token against Google public certs via `google.golang.org/api/idtoken`.
   - Fetches or creates user in single transaction.
   - Generates 15-minute Ed25519 Access Token (returned in JSON) and 30-day cryptographically secure Refresh Token (set as `httpOnly; SameSite=Strict; Secure` cookie).
2. **Dev Login (`POST /auth/dev-login`):**
   - Only active if `AUTH_DEV_MODE=true` environment variable is set. Returns HTTP 403 Forbidden in production mode.

---

## 4. Khorikov Unit Testing & BDD for Stage 4

### Khorikov Unit Tests (max 2-3 per rule):
1. `TestUser_Create_NewUser_SetsDefaults`:
   - New user starts with `UnitKg` preference and valid creation timestamp.
2. `TestUser_UpdateUnitPreference_ValidAndInvalid`:
   - Setting "lb" succeeds; setting "invalid" returns `ErrInvalidUnitPreference`.
3. `TestApplication_AuthenticateGoogle_FirstLoginRegisters_SubsequentLoginReturnsExisting`:
   - Verifies user repository receives create on first login, and lookup on second login.
4. `TestApplication_RefreshToken_InvalidOrExpired_ReturnsError`:
   - Refreshing with revoked/unknown token fails.

### Godog BDD Scenarios (`features/auth.feature`):
- `Scenario: First-time Google login registers a new user with default kg units`
- `Scenario: Existing user logging in maintains their unit preferences`
- `Scenario: User updates unit preference to pounds`

---

## 5. Step-by-Step Execution Checklist

- [ ] 1. Create `backend/services/identity` module and wire into `go.work`.
- [ ] 2. Write domain entities and value objects with Khorikov unit tests (`user_test.go`).
- [ ] 3. Write application use cases, ports, and in-memory fakes.
- [ ] 4. Create Postgres migrations and `queries.sql`, generate sqlc repository.
- [ ] 5. Implement Google ID token verifier adapter with dev-mode switch.
- [ ] 6. Implement OpenAPI strict server transport handlers.
- [ ] 7. Implement Godog BDD tests in `features/` executing against in-memory fakes.
- [ ] 8. Verify service compiles and tests pass (`go test ./...`).

---

## 6. Definition of Done
- `identity-service` domain, application, adapter, and transport layers complete.
- Khorikov unit tests and Godog BDD tests pass.
- Clean Architecture boundaries intact (verified by `archtest`).
