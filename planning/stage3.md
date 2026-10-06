# Stage 3 — Shared Platform Packages, API Gateway & Clean Architecture Tests

## 1. Goal & Context
Build the shared backend infrastructure foundation (`backend/pkg/`), the API Gateway reverse proxy, and **automated Clean Architecture tests**. This establishes the core security boundary (Ed25519 JWT verification, header propagation) and programmatically prevents layer violations across the Go microservices.

---

## 2. Deliverables & File Manifest

```
NeverPaidHealth/
├── backend/
│   ├── go.work                              # Multi-module workspace linking pkg, gateway, and all 5 services
│   ├── pkg/
│   │   ├── go.mod
│   │   ├── jwtauth/                         # Ed25519 token signer, verifier, claims parsing & middleware
│   │   │   ├── jwt.go
│   │   │   ├── jwt_test.go                  # Khorikov tests: valid token, expired token, signature tamper
│   │   │   └── keys.go                      # Dev & production Ed25519 keypair loader
│   │   ├── httpx/                           # HTTP utilities: RFC 7807 ProblemDetails, recovery, request ID
│   │   │   ├── errors.go
│   │   │   ├── middleware.go
│   │   │   └── response.go
│   │   ├── logx/                            # Structured logging via log/slog with trace & user correlation
│   │   │   └── logger.go
│   │   ├── outbox/                          # Transactional Outbox pattern interfaces & processor
│   │   │   ├── outbox.go
│   │   │   └── outbox_test.go               # In-memory outbox state transitions test
│   │   ├── natsx/                           # NATS JetStream publisher, stream provisioning, consumer helper
│   │   │   ├── publisher.go
│   │   │   └── consumer.go
│   │   └── pgxutil/                         # pgx connection pool setup, healthcheck, migration runner
│   │       ├── pool.go
│   │       └── migrate.go
│   ├── gateway/                             # API Gateway microservice
│   │   ├── go.mod
│   │   ├── cmd/server/main.go               # Gateway composition root
│   │   ├── internal/config/config.go        # Port, CORS origins, service URLs, JWT public key
│   │   ├── internal/proxy/router.go         # Chi reverse proxy with route table & header injection
│   │   └── internal/proxy/auth_middleware.go# JWT auth -> X-User-Id header injection
│   └── archtest/                            # Automated layer dependency verification test suite
│       ├── go.mod
│       └── arch_test.go                     # Go tests inspecting AST/import graph against Clean Arch rules
```

---

## 3. Technical Specifications

### 3.1 JWT Authentication Engine (`backend/pkg/jwtauth`)
- Asymmetric Ed25519 signatures (Identity service holds private key; Gateway & services hold public key).
- Token Claims:
  ```go
  type UserClaims struct {
      jwt.RegisteredClaims
      UserID   uuid.UUID `json:"uid"`
      Email    string    `json:"email"`
      Role     string    `json:"role"`
  }
  ```
- Gateway validates JWT and injects `X-User-Id: <uuid>` into downstream HTTP requests.

### 3.2 Automated Clean Architecture Tests (`backend/archtest/arch_test.go`)
Programmatically verifies through Go's `go/parser` and `go/build`:
1. `services/*/internal/domain/**` must **NEVER** import any third-party package outside the Go standard library (e.g., no chi, no pgx, no gorm, no json/http unless pure stdlib).
2. `services/*/internal/domain/**` must **NEVER** import `internal/application`, `internal/adapters`, or `internal/transport`.
3. `services/*/internal/application/**` must **NEVER** import `internal/adapters` or `internal/transport`.
4. No microservice under `services/A` may import anything from `services/B/internal`.

---

## 4. Khorikov Unit Testing for Stage 3

### Test Catalog:
1. `jwtauth_test.go`:
   - `TestJWT_IssueAndVerify_ValidToken`: Generates token with claims, verifies claims match exactly.
   - `TestJWT_Verify_ExpiredToken_ReturnsErrExpired`: Generates expired token, asserts error is `ErrTokenExpired`.
   - `TestJWT_Verify_TamperedSignature_ReturnsErrInvalid`: Mutates payload bytes, asserts verification failure.
2. `outbox_test.go`:
   - `TestOutbox_EnqueueAndMarkPublished`: In-memory outbox state machine transitions from `Pending` -> `Published`.
3. `arch_test.go`:
   - `TestCleanArchitecture_DomainLayer_HasNoExternalDependencies`: Asserts 0 violations across all service domains.
   - `TestCleanArchitecture_ServiceIsolation_NoCrossServiceInternalImports`: Asserts 0 violations.

---

## 5. Step-by-Step Execution Checklist

- [ ] 1. Initialize `backend/go.work` and create `backend/pkg/` module.
- [ ] 2. Implement `backend/pkg/jwtauth` with Ed25519 signing, verification, and tests.
- [ ] 3. Implement `backend/pkg/httpx` with RFC 7807 error formatting and middleware.
- [ ] 4. Implement `backend/pkg/logx`, `backend/pkg/outbox`, `backend/pkg/natsx`, and `backend/pkg/pgxutil`.
- [ ] 5. Implement `backend/gateway` with routing, CORS, and `X-User-Id` injection.
- [ ] 6. Implement `backend/archtest/arch_test.go` and integrate into `task test`.

---

## 6. Definition of Done
- `backend/pkg` and `backend/gateway` compile cleanly.
- Khorikov unit tests for `jwtauth`, `outbox`, and `archtest` pass (`go test ./...`).
- Clean Architecture tests verify zero import rule violations.
