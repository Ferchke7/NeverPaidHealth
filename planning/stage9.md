# Stage 9 — Frontend Foundation & Feature-Sliced Architecture

## 1. Goal & Context
Set up the frontend application (`frontend/`) using React 19, TypeScript strict, Vite, Tailwind CSS, and **Feature-Sliced Design (FSD)**. Configure automated contract-based API client generation (Orval), memory-safe Google OAuth with silent token refresh, the unit conversion engine (`kg` <-> `lb`), and lint-enforced architectural layer boundaries.

---

## 2. Deliverables & File Manifest

```
NeverPaidHealth/frontend/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── .eslintrc.cjs                            # Configured with eslint-plugin-boundaries for FSD
├── orval.config.ts                          # Codegen for OpenAPI -> TypeScript hooks + Zod schemas
└── src/
    ├── app/
    │   ├── App.tsx                          # Root application component
    │   ├── providers/                       # QueryClientProvider, AuthProvider, RouterProvider
    │   │   ├── QueryProvider.tsx
    │   │   └── AuthProvider.tsx
    │   ├── routes/                          # TanStack Router route tree definitions
    │   │   └── router.tsx
    │   └── styles/
    │       └── globals.css                  # Tailwind styles & theme variables
    ├── shared/
    │   ├── api/
    │   │   ├── client.ts                    # Fetch wrapper: auth header, 401 refresh, RFC 7807 error parsing
    │   │   └── generated/                   # Orval generated code (never edited by hand)
    │   ├── ui/                              # Reusable Radix + Tailwind primitives
    │   │   ├── button.tsx
    │   │   ├── input.tsx
    │   │   ├── dialog.tsx
    │   │   ├── sheet.tsx
    │   │   ├── card.tsx
    │   │   ├── badge.tsx
    │   │   └── stepper.tsx
    │   ├── lib/
    │   │   ├── units.ts                     # kg <-> lb conversion & formatting
    │   │   ├── units.test.ts                # Vitest parity tests with backend calculations
    │   │   └── dates.ts
    │   └── config/
    │       └── env.ts                       # Environment variables & runtime constants
    ├── entities/
    │   └── user/
    │       ├── model/
    │       │   ├── authStore.ts             # Zustand store: accessToken (memory), user profile
    │       │   └── types.ts
    │       └── ui/
    │           └── UserAvatar.tsx
    ├── features/
    │   ├── auth-google/
    │   │   ├── ui/GoogleSignInButton.tsx    # Google OAuth GIS integration
    │   │   └── ui/DevLoginModal.tsx         # Dev mode bypass login UI (if AUTH_DEV_MODE)
    │   └── switch-units/
    │       └── ui/UnitSwitchToggle.tsx      # Global kg / lb toggle button
    └── pages/
        ├── login/
        │   └── ui/LoginPage.tsx             # Responsive login landing page
        └── dashboard/
            └── ui/DashboardLayout.tsx       # Main app layout with navigation bar & unit switcher
```

---

## 3. Technical Specifications

### 3.1 Feature-Sliced Design Import Rules
Enforced strictly by `eslint-plugin-boundaries`:
- Layers: `app` -> `pages` -> `widgets` -> `features` -> `entities` -> `shared`.
- A layer may **only** import from layers strictly below it.
- Slices within the same layer (e.g. `features/auth-google` and `features/switch-units`) cannot import each other directly.
- Slices must expose public interfaces via `index.ts`.

### 3.2 State Management Architecture
1. **Server State (TanStack Query v5):**
   - Query keys generated via type-safe factories.
   - Default `staleTime: 5 * 60 * 1000` (5 min), `gcTime: 30 * 60 * 1000` (30 min).
2. **Client State (Zustand):**
   - `authStore`: holds `accessToken` (in memory only, never written to `localStorage` for XSS safety) and current user details.
   - Silent token refresh automatically intercepts HTTP 401s, calls `POST /auth/refresh` (cookie-based), and retries the failed request seamlessly.

### 3.3 Unit Conversion Parity (`shared/lib/units.ts`)
Must match backend gram-level calculations:
```typescript
export const KG_TO_LB = 2.20462262;

export function kgToLb(kg: number): number {
  return Number((kg * KG_TO_LB).toFixed(1));
}

export function lbToKg(lb: number): number {
  return Number((lb / KG_TO_LB).toFixed(1));
}

export function formatWeight(kg: number, unit: 'kg' | 'lb'): string {
  if (unit === 'lb') return `${kgToLb(kg)} lbs`;
  return `${kg.toFixed(1)} kg`;
}
```

---

## 4. Khorikov Unit Testing for Stage 9

### Frontend Unit Test Catalog (Vitest):
1. `units.test.ts`:
   - `testKgToLbConversion`: Verifies 100 kg = 220.5 lbs.
   - `testLbToKgConversion`: Verifies 220.5 lbs = 100 kg.
   - `testParityWithCalculationVectors`: Loads `contracts/calculation-vectors.json` and verifies BMI and 1RM formulas match TS implementations.
2. `authStore.test.ts`:
   - `testSetAccessToken_UpdatesMemoryState`: Verifies token is stored in memory and cleared on logout.

---

## 5. Step-by-Step Execution Checklist

- [ ] 1. Scaffold `frontend/` project with Vite, React 19, TypeScript, Tailwind CSS.
- [ ] 2. Configure `eslint-plugin-boundaries` for Feature-Sliced Design.
- [ ] 3. Configure Orval and run code generation from `contracts/openapi/`.
- [ ] 4. Implement `shared/api/client.ts` with silent 401 token refresh.
- [ ] 5. Implement `shared/ui/` design system components (Button, Input, Dialog, etc.).
- [ ] 6. Implement `shared/lib/units.ts` with Vitest unit tests.
- [ ] 7. Implement `entities/user/` and `features/auth-google/` with Google OAuth & Dev mode login.
- [ ] 8. Implement `pages/login/` and `pages/dashboard/DashboardLayout.tsx`.
- [ ] 9. Verify with `npm run lint && npm run typecheck && npm run test`.

---

## 6. Definition of Done
- Frontend scaffolds and builds cleanly (`npm run build`).
- Google OAuth & Dev mode login functioning.
- Unit conversion tests pass.
- FSD architecture boundary linter reports 0 violations.
