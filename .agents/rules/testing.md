# Vladimir Khorikov Testing Rules

## Core Principles

1. **Detroit / Classical School of Unit Testing:**
   - A unit is a **unit of behavior**, not a single class or function.
   - Real domain objects work together in tests; never mock internal domain collaborators.

2. **The 4 Pillars of a Good Unit Test:**
   - Protection against regressions.
   - Resistance to refactoring (test observable behavior, never implementation details or private methods).
   - Fast feedback (< 1 ms per test).
   - Maintainability (clear Arrange-Act-Assert structure, concise setup).

3. **Code Quadrants & Test Allocation:**
   - **Quadrant 2 (Domain Model & Algorithms):** High domain complexity, few out-of-process dependencies. -> **100% of testing effort lives here.**
   - **Quadrant 4 (Controllers & Gateways):** Humble objects. -> **Zero tests / verify by compilation and contracts.**
   - **Quadrant 3 (Trivial code):** DTOs, getters, one-line mappers. -> **Zero tests.**

4. **Test Budget (Rule of 2-3):**
   - Exactly **2 to 3 tests per business rule**:
     1. Happy path (valid input produces expected domain state or event).
     2. Primary edge case / boundary error (e.g. rep limit, invalid unit).
     3. Invariant violation error (e.g. modifying finished workout).
   - Never write redundant tests that test the same code path under trivial variations.

5. **BDD with Godog:**
   - Feature specs in `docs/specs/**/*.feature` are executed against in-memory repository fakes.
   - This keeps BDD tests completely in-memory, deterministic, and blazing fast without requiring a running database.
