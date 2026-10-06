---
name: add-domain-event
description: Recipe for creating, persisting, and consuming async domain events across microservices.
---

# Recipe: Adding a Domain Event

1. **Define Event JSON Schema:**
   Create or update schema in `contracts/events/<event-name>.v1.schema.json`.

2. **Define Pure Domain Event:**
   In emitting service domain `internal/domain/<aggregate>/events.go`, define the Go event struct.

3. **Emit Event in Aggregate:**
   Aggregate records event on state change (e.g. `aggregate.record(Event{...})`).

4. **Transactional Outbox Writer:**
   Ensure application use case saves event to the `outbox` table within the same database transaction.

5. **Outbox Worker & Publisher:**
   Worker publishes envelope to NATS JetStream subject `<SERVICE>.<event-name>`.

6. **Consumer Handling (Subscribing Service):**
   - Create idempotent handler verifying against `processed_events` table.
   - Run domain logic and update read models.
