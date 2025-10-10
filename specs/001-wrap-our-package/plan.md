# Implementation Plan: Wrap package for runner and extract CLI entry

**Branch**: `001-wrap-our-package` | **Date**: 2025-10-10 | **Spec**: /home/activadee/Desktop/projects/kanbanAI/specs/001-wrap-our-package/spec.md
**Input**: Feature specification from `/specs/001-wrap-our-package/spec.md`

## Summary

Primary requirement: Invoking our package via the standard package runner should start the packaged CLI living in `dist/` without a global install. Additional directive: Extract `server/src/app.ts` out of the `server` workspace so this becomes the main CLI entry.

Technical approach (from research): Introduce a new top‑level workspace `cli/` that owns the CLI entry (`cli/src/main.ts`) and defers server construction to `server`'s exported `createApp`. Move the current CLI bootstrap (flag parsing, server start, help/version) out of `server/src/app.ts` into `cli/src/main.ts`, leaving `server` as a pure library (`createApp`, routers, adapters). Package cross‑platform binaries to `dist/` and expose a `bin` wrapper that selects the correct binary at runtime when executed via the runner.

## Technical Context

**Language/Version**: TypeScript (workspace), Bun runtime 1.2.x  
**Primary Dependencies**: Monorepo using `turbo`; server uses `hono`, `drizzle-orm`; client uses React/Vite; no new runtime dependency required for CLI wrapper  
**Storage**: SQLite via drizzle (unchanged; used by server)  
**Testing**: Vitest in `core/`; extend with focused unit/integration tests for CLI bootstrap and argument pass‑through  
**Target Platform**: Linux, macOS, Windows (x64 and arm64 where applicable)  
**Project Type**: Multi‑package monorepo (`client/`, `server/`, `shared/`, `core/`, new `cli/`)  
**Performance Goals**: CLI starts and outputs visible text within 2 seconds on a typical developer laptop (aligns with spec SC‑001)  
**Constraints**: No global install required; arguments/exit code/stdio parity with underlying process; friendly errors when binary missing  
**Scale/Scope**: Developer‑facing CLI used locally and in CI; no backend scale impact from this change

## Constitution Check

Gate evaluation against /.specify/memory/constitution.md:
- Code Quality: Boundaries clarified by extracting CLI to new `cli/` workspace; types preserved; small, focused PRs planned.
- Testing Standards: Add unit tests for CLI arg forwarding and exit code parity; no `core/` coverage gates impacted.
- UX Consistency: Not a UI change; CLI help copy will be concise and consistent.
- Performance Requirements: Startup target ≤ 2 s; no new polling or heavy background work.
- Workflow & Gates: Lint/type‑check/build/tests will run for affected workspaces; any temporary deviations require owners and follow‑ups.

Result: No violations anticipated. Proceed to Phase 0 research.

Post‑Design Re‑Check (after Phase 1): Still compliant; no gates violated.

## Project Structure

### Documentation (this feature)

```
specs/001-wrap-our-package/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
```

### Source Code (repository root)

```
client/
core/
server/
  src/
    app.ts            # will export createApp only (no CLI bootstrap)
    ...               # routers, db, ws, embed helpers
shared/
cli/                  # NEW workspace (main CLI entry)
  src/
    main.ts           # CLI bootstrap (flags, server start, help/version)
  package.json        # publishes bin wrapper and depends on server
dist/                 # packaged binaries (kanbanai*, platform‑specific)
scripts/
specs/
```

**Structure Decision**: Introduce `cli/` workspace to own the CLI entrypoint while keeping `server/` as a framework/library exposing `createApp`. `dist/` continues to host compiled binaries selected by the published `bin` wrapper when invoked via the runner.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | — | Keeping CLI inside `server/` couples app composition with packaging; extracting simplifies publishing and testing |
