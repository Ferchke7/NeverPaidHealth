---
name: write-khorikov-test
description: Recipe for authoring Khorikov-compliant unit tests and BDD specs.
---

# Recipe: Writing Khorikov Unit Tests

1. **Identify Business Rule:**
   Find the exact domain rule from `docs/calculations.md` or `docs/specs/`.

2. **Select Test Scope:**
   Target purely `internal/domain/` or `internal/application/` with in-memory fakes. Do not mock internal collaborators.

3. **Limit to 2-3 Tests per Rule:**
   - **Test 1:** Happy path behavior.
   - **Test 2:** Primary boundary or edge condition.
   - **Test 3 (Optional):** Invariant violation error condition.

4. **Structure Test (AAA):**
   - **Arrange:** Set up domain entities directly.
   - **Act:** Execute the domain method.
   - **Assert:** Check resulting state and emitted domain events.

5. **Execute Fast:**
   Run `go test -v ./...` or `npm test`. Execution must complete in under 5 seconds.
