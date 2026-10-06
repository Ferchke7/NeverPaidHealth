---
name: add-use-case
description: Recipe for implementing a new application use case (command or query) in Go microservices.
---

# Recipe: Adding an Application Use Case

1. **Verify Ubiquitous Language:**
   Check `docs/glossary.md` to ensure the action and entities use standard terminology.

2. **Define Port Interfaces:**
   If a new repository or external client is needed, add the interface in `internal/application/ports.go`.

3. **Implement Pure Domain Logic (if new):**
   Add methods to Aggregate Root in `internal/domain/<aggregate>/` with Khorikov unit tests.

4. **Implement Application Command / Query:**
   Create file `internal/application/command/<action>.go` or `internal/application/query/<query>.go`.
   - Take dependencies in constructor (e.g. `NewStartWorkoutHandler(repo ports.WorkoutRepo, clock ports.Clock)`).
   - Coordinate domain aggregates without placing business rules in the handler.

5. **Update In-Memory Fake Adapters:**
   Add fake implementation methods in `internal/adapters/memory/`.

6. **Add Khorikov Unit Test or BDD Step:**
   Add test verifying the command using in-memory fake adapters.
