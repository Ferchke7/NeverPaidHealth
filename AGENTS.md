# NeverPaidHealth AI Development Rules & Guardrails

You are developing **NeverPaidHealth**, a free, local-first and microservices-based workout tracking application (Hevy alternative) built with Clean Architecture, Domain-Driven Design (DDD), Vladimir Khorikov's Unit Testing philosophy, and Feature-Sliced Design (FSD).

## Non-Negotiable Core Laws

1. **NEVER INVENT ANYTHING UNCONTRACTED:**
   - Do not invent HTTP endpoints, query params, DTO fields, database columns, or domain event schemas.
   - The single source of truth for APIs is `contracts/openapi/*.yaml`.
   - The single source of truth for events is `contracts/events/*.json`.
   - The single source of truth for formulas is `docs/calculations.md` and `contracts/calculation-vectors.json`.
   - If a new field or endpoint is needed: edit the contract in `contracts/` FIRST, then run `task gen`.

2. **UBIQUITOUS LANGUAGE ONLY:**
   - All domain identifiers, types, methods, and variables must strictly adhere to the terms defined in [`docs/glossary.md`](file:///c:/Users/ferda/Desktop/NeverPaidHealth/docs/glossary.md).
   - Never mix synonyms (e.g. do NOT use `session` when the ubiquitous term is `Workout`, do NOT use `template` when the term is `Routine`).

3. **CLEAN ARCHITECTURE & PURE DOMAIN (GO):**
   - All business logic belongs strictly in `internal/domain/`.
   - Domain code MUST ONLY import Go standard library packages. No 3rd-party web frameworks, ORMs, or external drivers in `domain`.
   - Dependency direction: `transport -> application -> domain` and `adapters -> application -> domain`.
   - Services must NEVER import another service's `internal` packages. Cross-service communication is asynchronous via NATS JetStream or synchronous via Anti-Corruption Layer (ACL) HTTP ports.

4. **KHORIKOV UNIT TESTING LAWS:**
   - Unit tests only. Target the Domain Model and Domain Services (Quadrant 2).
   - Maximum 2 to 3 tests per business rule (1 happy path, 1-2 edge/invariant error cases).
   - No mocking of in-process code. No testing of trivial getters/setters/DTOs.
   - ZERO integration tests. Handlers, database queries, and transport layers are humble objects verified at compile-time via `sqlc` and `oapi-codegen`.
   - BDD feature specs (`docs/specs/**/*.feature`) run against in-memory fake repositories, making them pure unit tests.

5. **FEATURE-SLICED DESIGN (FRONTEND):**
   - Layer hierarchy: `app -> pages -> widgets -> features -> entities -> shared`.
   - Slices on the same layer must never import from each other. Imports flow strictly downwards.
   - Slices expose public interfaces exclusively through `index.ts`.
   - Calculation logic in `entities/*/model` must produce identical numerical outputs to `contracts/calculation-vectors.json`.

6. **AUTOMATED VERIFICATION GATE:**
   - Always run `task verify` before declaring work complete.
   - Generated code must never be edited manually.

7. **SINGLE RESPONSIBILITY PER PAGE (ONE PRIMARY JOB PER PAGE):**
   - Every view, page, and screen must have strictly ONE clear, dedicated purpose.
   - Do NOT clutter pages with auxiliary widgets, side mini-calendars, or secondary feature overloads.
   - The user must be able to focus 100% on the single task of the page (e.g. Daily Todo checklist = daily tasks and activity for the selected day, nothing extraneous).
   - If a feature is secondary or auxiliary (like a full-month matrix or long-term analytics), it belongs in a dedicated tab or separate route, never squeezed into a side column.

8. **STRICT DESIGN SYSTEM & HEROUI COMPONENT ENFORCEMENT:**
   - The project uses the ready-made **HeroUI (`@heroui/react`)** component library!
   - AI agents and developers must strictly reuse the existing ready-made components from `@/shared/ui/`:
     - `Button`, `ButtonGroup` (`@/shared/ui/button.tsx`)
     - `Card`, `CardContent`, `CardHeader`, `CardTitle`, `Badge`, `Chip` (`@/shared/ui/card.tsx`)
     - `Input`, `Textarea` (`@/shared/ui/input.tsx`)
     - `Modal` (`@/shared/ui/modal.tsx`)
     - `ProgressBar`, `CircularProgress` (`@/shared/ui/progress.tsx`)
     - `Skeleton` (`@/shared/ui/skeleton.tsx`)
     - `Tabs` (`@/shared/ui/tabs.tsx`)
   - Absolutely **NEVER** write raw HTML `<button className="...">`, raw styled `<div>` cards, raw `<span>` chips, or hand-rolled `<div className="fixed inset-0...">` modal overlays.
   - Always compose cleanly using the design system primitives with consistent spacing and typography tokens.
