---
name: add-frontend-feature
description: Recipe for adding a frontend feature following Feature-Sliced Design.
---

# Recipe: Adding a Frontend Feature (FSD)

1. **Determine Layer:**
   - Business data & model: `src/entities/<name>/`
   - User interaction: `src/features/<name>/`
   - Composite UI block: `src/widgets/<name>/`
   - View/Screen: `src/pages/<name>/`

2. **Generate API Hooks (if contract updated):**
   Run `npm run generate:api` or `task gen`.

3. **Implement Feature Slice:**
   - Create UI components inside `ui/`.
   - Create hooks or state stores inside `model/`.
   - Export public interface exclusively from `index.ts`.

4. **Verify Boundary Rules:**
   Run `npm run lint` to ensure no cross-slice or upwards layer imports occur.
