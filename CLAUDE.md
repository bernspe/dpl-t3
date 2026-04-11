# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ShiftWisher** — a Vue 3 deployable component for shift planning. Displays a month-based calendar where users express shift preferences (preferred / available / unavailable) per date, with multi-date selection (click or drag), infinite scroll, and undo/redo.
If the user makes no selection for a specific date, he will be marked available.

## Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # Type-check + build in parallel (production)
npm run build-only   # Build without type checking
npm run type-check   # vue-tsc --build
npm run test:unit    # Run unit tests (Vitest + jsdom)
npm run preview      # Preview production build
```

Run a single test file:
```bash
npx vitest run src/__tests__/App.spec.ts
```

## Reference Project

Types, composables, and components should be sourced or adapted from the **dpl-t2** project:
- GitHub: https://github.com/bernspe/dpl-t2.git
- npm: `@dienzt/shift-planner`

Key assets to reuse:
- **Types:** `planner.types.ts`
- **Composables:** `useInfiniteScroll`, `useCellModel`, `useDateHelpers`, `useProgress`, `useToast`
- **Components:** `CalendarView.vue`, `ProgressIndicator.vue`, `ToastNotification.vue`

## Architecture Notes

- Path alias `@/*` resolves to `./src/*` (configured in both `tsconfig.app.json` and `vite.config.ts`)
- Undo/redo uses `useRefHistory(data, { deep: true, capacity: 50 })` from VueUse — **pause history during init/load** to avoid spurious entries
- The component emits wishes rather than persisting directly; storage adapters (localStorage, Supabase) are wired externally and require config input comparable to dpl-t2

## Testing

- Framework: Vitest with jsdom environment
- Config merges `vite.config.ts` via `vitest.config.ts`
- Vue Test Utils (`@vue/test-utils`) for component testing
