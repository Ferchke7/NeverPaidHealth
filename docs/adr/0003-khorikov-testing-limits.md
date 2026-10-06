# ADR 0003: Vladimir Khorikov Testing Limits (No Integration Tests)

## Context
Integration tests that spin up databases, run migrations, and start HTTP servers are slow, flaky, and expensive to maintain.

## Decision
Following Vladimir Khorikov's *Unit Testing: Principles, Practices, and Patterns*:
1. Focus 100% of testing effort on **Quadrant 2 (Domain Models & Mathematical Algorithms)**.
2. Limit tests to **2–3 high-value unit tests per business rule**.
3. **No integration tests.** Controllers, SQL queries, and HTTP routing are humble objects.
4. Correctness of humble layers is enforced at compile time via `sqlc` (type-safe SQL) and `oapi-codegen` (strictly typed HTTP stubs).
5. BDD feature scenarios (`godog`) execute against in-memory fake repositories.

## Consequences
- Fast test execution (< 3 seconds for entire repo).
- High refactoring resistance and maintainability.
