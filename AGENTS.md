# AGENTS.md

## Commands

```bash
pnpm test            # run all tests (vitest run)
pnpm build           # build with tsdown --dts (outputs dist/index.mjs + dist/index.d.mts)
pnpm format          # prettier --write .
```

No lint or typecheck scripts exist. Run `npx tsc --noEmit` for type checking.

## Package manager

pnpm 10.23.0 (pinned via `packageManager` in package.json). Use pnpm, not npm or yarn.

## Project structure

Single-package TypeScript library (not a monorepo). All source in `src/`, all tests in `test/`.

- `src/index.ts` — public API barrel export
- `src/isomorphic-store.ts` — main `IsomorphicStore` class
- `src/types.ts` — enums, interfaces, type helpers
- `src/errors.ts` — custom error classes
- `src/factory.ts` — `StorageAdapterFactory` creates adapters by strategy
- `src/registry.ts` — `globalNamespaceRegistry` singleton (Map<string, StorageStrategy>)
- `src/adapters/` — one file per strategy: `local.ts`, `session.ts`, `memory.ts`, `history.ts`, `navigation.ts`

## TypeScript quirks

- `verbatimModuleSyntax: true` — type-only imports MUST use `import type { ... }` syntax or the `type` keyword inline. The existing code uses `import { type Foo }` inline style.
- `noUncheckedIndexedAccess: true` — indexed access returns `T | undefined`, not `T`.
- `exactOptionalPropertyTypes: true` — `undefined` must be explicitly provided for optional properties when the type includes `undefined`.
- `strict: true` with all strict checks enabled.

## Testing

- Framework: vitest 4.x
- Browser APIs: tests use jsdom (not happy-dom). Each test file needs `/** @vitest-environment jsdom */` pragma at the top.
- Tests import directly from `../src` (not from the built package).
- Namespace registry is global state. Every test must call `globalNamespaceRegistry.clear()` in `beforeEach` to avoid `NamespaceConflictError` from prior tests.
- Always call `store.destroy()` in `afterEach` (or when done) to unregister namespaces.
- Adapters like HISTORY and NAVIGATION depend on `window.history` / `window.navigation` APIs which jsdom partially supports.

## Build

- Entry: `src/index.ts`
- Output: ESM only (`dist/index.mjs`) with declarations (`dist/index.d.mts`)
- Tool: tsdown 0.21.0-beta.2
- `files` field in package.json limits published package to `dist/`

## Key design facts

- `globalNamespaceRegistry` is a process-global singleton. Creating two `IsomorphicStore` instances with the same namespace throws `NamespaceConflictError`. This is the main source of test interdependence bugs.
- Data is wrapped in `DataWithVersion<T>` for versioning/migration. The adapter stores `{ version, data }`, not raw values.
- NAVIGATION strategy auto-falls back to HISTORY adapter if `window.navigation` is unavailable (see `factory.ts:37-41`).
- Migration chains must be contiguous (v1→v2, v2→v3). Missing a step throws `MigrationError`.
- HISTORY/NAVIGATION adapters require a namespace parameter (factory enforces this).
