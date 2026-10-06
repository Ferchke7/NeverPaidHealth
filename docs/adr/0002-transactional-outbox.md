# ADR 0002: Transactional Outbox for Asynchronous Events

## Context
When a workout finishes in `training-service`, `progress-service` must compute Personal Records and progression charts. Direct synchronous HTTP calls or dual-writing to message brokers risk data inconsistency if the network fails midway.

## Decision
We implement the **Transactional Outbox Pattern**:
1. `training-service` writes the finished workout state and the `WorkoutFinished` event into the same Postgres transaction.
2. A background worker reads unpublished outbox rows and publishes them to NATS JetStream (`WORKOUT.finished`).
3. `progress-service` consumes events idempotently by checking a `processed_events` table.

## Consequences
- Guarantees at-least-once delivery without distributed transactions (2PC).
- Zero dual-write data loss.
