# ADR 0004: Feature-Sliced Design (FSD) for React UI

## Context
Standard React applications often degenerate into tangled component trees, circular imports, and ambiguous state ownership.

## Decision
We adopt **Feature-Sliced Design (FSD)**:
- Six strict layers: `app`, `pages`, `widgets`, `features`, `entities`, `shared`.
- Unidirectional top-to-bottom imports enforced by `eslint-plugin-boundaries`.
- Slices expose public interfaces via `index.ts`.
- Server state managed by TanStack Query; active in-gym workout state managed by Zustand with `localStorage` persistence.

## Consequences
- High modularity and predictability.
- AI code generation tools cannot create circular component dependencies.
