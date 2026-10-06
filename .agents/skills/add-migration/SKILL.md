---
name: add-migration
description: Recipe for authoring database migrations and compiling sqlc queries.
---

# Recipe: Adding a Database Migration

1. **Locate Target Service:**
   `backend/services/<service>/migrations/`

2. **Create Sequential Migration Files:**
   - `00000X_<name>.up.sql`
   - `00000X_<name>.down.sql`

3. **Define Type-Safe SQL Queries:**
   Update `backend/services/<service>/queries.sql` with sqlc annotations (e.g. `-- name: GetUserByID :one`).

4. **Compile SQL to Go:**
   Run `task gen` (which executes `sqlc generate` across all services).

5. **Verify Clean Architecture:**
   Ensure only `internal/adapters/postgres/` imports the generated sqlc code.
