# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**WishCraft** — a Vue 3 deployable component for shift planning. Displays a month-based calendar where users express shift preferences (preferred / available / unavailable) per date, with multi-date selection (click or drag), infinite scroll, and undo/redo.
If the user makes no selection for a specific date, he will be marked available.

The user can save his wishes to the server, which will be used by ShiftCraft Planner.
The Specs for the wish payload and URL encoding can be found in docs/IO_SPECS.md.

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

## Architecture Notes

- Path alias `@/*` resolves to `./src/*` (configured in both `tsconfig.app.json` and `vite.config.ts`)
- Undo/redo uses `useRefHistory(data, { deep: true, capacity: 50 })` from VueUse — **pause history during init/load** to avoid spurious entries

## Testing

- Framework: Vitest with jsdom environment
- Config merges `vite.config.ts` via `vitest.config.ts`
- Vue Test Utils (`@vue/test-utils`) for component testing
