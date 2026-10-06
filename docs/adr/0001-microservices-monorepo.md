# ADR 0001: Go Microservices in a Monorepo

## Context
NeverPaidHealth requires clear separation between user authentication, public exercise catalogs, high-throughput in-gym workout logging, asynchronous analytics, and personal body tracking.

## Decision
We organize the project as a **Monorepo** containing:
1. Five independent Go microservices (`identity`, `exercise`, `training`, `progress`, `body`).
2. An API Gateway (`gateway`) managing CORS, rate-limiting, and JWT verification.
3. A React single-page frontend application (`frontend`).
4. Shared contracts, documentation, and tooling at the repository root.

## Consequences
- **Positive:** Clear bounded contexts, independent database isolation, fast focused builds.
- **Negative:** Operational overhead of running multiple processes in production, managed locally via `docker-compose.yml`.
